-- Create missing tracking tables and fix existing ones (FIXED VERSION)

-- 1. Check if job_status_updates table exists, create if not
CREATE TABLE IF NOT EXISTS job_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Status information
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    status_notes TEXT,
    
    -- Location context (captured automatically when status changes)
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_accuracy DECIMAL(10, 2),
    
    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create location_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    tracking_token VARCHAR(255) NOT NULL,
    
    -- Location data
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Timestamp
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional metadata
    speed DECIMAL(5, 2),
    heading INTEGER,
    accuracy DECIMAL(10, 2),
    
    -- Legal/compliance tracking
    data_retention_category VARCHAR(50) DEFAULT 'business_records',
    archived_at TIMESTAMP WITH TIME ZONE
);

-- 3. Add missing columns to existing job_technician_locations table
ALTER TABLE job_technician_locations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);

-- 4. Update existing records with default values
UPDATE job_technician_locations 
SET 
  is_active = COALESCE(is_active, true),
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, updated_at, NOW()),
  expires_at = COALESCE(expires_at, 
    CASE 
      WHEN created_at IS NOT NULL THEN created_at + INTERVAL '4 hours'
      ELSE NOW() + INTERVAL '4 hours'
    END
  ),
  tracking_token = COALESCE(tracking_token, 'track_' || encode(gen_random_bytes(16), 'hex'))
WHERE expires_at IS NULL OR tracking_token IS NULL OR is_active IS NULL;

-- 5. Add constraints and indexes
CREATE INDEX IF NOT EXISTS idx_job_status_updates_job_id ON job_status_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_technician ON job_status_updates(technician_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_location_logs_job_id ON location_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_tracking_token ON location_logs(tracking_token);
CREATE INDEX IF NOT EXISTS idx_location_logs_logged_at ON location_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_location_logs_technician_date ON location_logs(technician_id, logged_at);

CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_technician ON job_technician_locations(technician_id);

-- 6. Add unique constraint for tracking_token
DO $$ 
BEGIN
    ALTER TABLE job_technician_locations ADD CONSTRAINT tracking_token_unique UNIQUE(tracking_token);
EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- 7. Enable RLS on new tables
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for job_status_updates (safe way)
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Technicians can insert status updates" ON job_status_updates;
    DROP POLICY IF EXISTS "Technicians can view their own status updates" ON job_status_updates;
    DROP POLICY IF EXISTS "Admins can view all status updates" ON job_status_updates;
    
    -- Create new policies
    CREATE POLICY "Technicians can insert status updates" ON job_status_updates
        FOR INSERT 
        WITH CHECK (auth.uid() = technician_id);

    CREATE POLICY "Technicians can view their own status updates" ON job_status_updates
        FOR SELECT 
        USING (auth.uid() = technician_id);

    CREATE POLICY "Admins can view all status updates" ON job_status_updates
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'owner')
            )
        );
END
$$;

-- 9. Create RLS policies for location_logs (safe way)
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Technicians can view their own location history" ON location_logs;
    DROP POLICY IF EXISTS "Admins can view all location logs" ON location_logs;
    
    -- Create new policies
    CREATE POLICY "Technicians can view their own location history" ON location_logs
        FOR SELECT 
        USING (auth.uid() = technician_id);

    CREATE POLICY "Admins can view all location logs" ON location_logs
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'owner')
            )
        );
END
$$;

-- 10. Create RLS policies for job_technician_locations (safe way)
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;
    DROP POLICY IF EXISTS "Technicians can update their own location" ON job_technician_locations;
    DROP POLICY IF EXISTS "Authenticated users can insert tracking data" ON job_technician_locations;
    
    -- Create new policies
    CREATE POLICY "Public read access with tracking token" ON job_technician_locations
        FOR SELECT 
        USING (
            is_active = true 
            AND expires_at > NOW()
            AND tracking_token IS NOT NULL
        );

    CREATE POLICY "Technicians can update their own location" ON job_technician_locations
        FOR UPDATE 
        USING (auth.uid() = technician_id)
        WITH CHECK (auth.uid() = technician_id);

    CREATE POLICY "Authenticated users can insert tracking data" ON job_technician_locations
        FOR INSERT 
        WITH CHECK (auth.uid() = technician_id);
END
$$;

-- 11. Grant permissions
GRANT SELECT, INSERT ON job_status_updates TO authenticated;
GRANT SELECT ON location_logs TO authenticated;
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;

-- 12. Verify table structures
SELECT 'job_technician_locations' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations'
UNION ALL
SELECT 'job_status_updates' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_status_updates'
UNION ALL
SELECT 'location_logs' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'location_logs'
ORDER BY table_name, column_name;