-- Fix job_technician_locations table step by step

-- 1. First, let's see what columns currently exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations'
ORDER BY ordinal_position;

-- 2. Add all missing columns at once
ALTER TABLE job_technician_locations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);

-- 3. Update existing records with safe column references
UPDATE job_technician_locations 
SET 
  is_active = COALESCE(is_active, true),
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, created_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW()),
  expires_at = COALESCE(expires_at, 
    CASE 
      WHEN created_at IS NOT NULL THEN created_at + INTERVAL '4 hours'
      ELSE NOW() + INTERVAL '4 hours'
    END
  ),
  tracking_token = COALESCE(tracking_token, 'track_' || encode(gen_random_bytes(16), 'hex'))
WHERE expires_at IS NULL OR tracking_token IS NULL OR is_active IS NULL 
   OR started_at IS NULL OR last_updated IS NULL OR updated_at IS NULL;

-- 4. Add unique constraint for tracking_token
DO $$ 
BEGIN
    ALTER TABLE job_technician_locations ADD CONSTRAINT tracking_token_unique UNIQUE(tracking_token);
EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- 5. Add indexes
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_technician ON job_technician_locations(technician_id);

-- 6. Enable RLS if not already enabled
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies safely
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

-- 8. Grant permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;

-- 9. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;

-- 10. Verify the final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations'
ORDER BY ordinal_position;