-- STEP 2: Create the other tracking tables (FLEXIBLE VERSION)
-- This version adapts to your existing schema

-- First, let's add the missing job_id column to job_technician_locations if it doesn't exist
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS job_id UUID;

-- Create job_status_updates table
CREATE TABLE IF NOT EXISTS job_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID,
    
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

-- Create location_logs table  
CREATE TABLE IF NOT EXISTS location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID,
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

-- Add foreign key constraints only if the referenced tables exist
DO $$
BEGIN
    -- Add foreign key for job_status_updates.technician_id if user_profiles exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        BEGIN
            ALTER TABLE job_status_updates 
            ADD CONSTRAINT fk_job_status_updates_technician_id 
            FOREIGN KEY (technician_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Constraint already exists
        END;
    END IF;

    -- Add foreign key for location_logs.technician_id if user_profiles exists  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        BEGIN
            ALTER TABLE location_logs 
            ADD CONSTRAINT fk_location_logs_technician_id 
            FOREIGN KEY (technician_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Constraint already exists
        END;
    END IF;

    -- Add foreign key for job_technician_locations.technician_id if not already added
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        BEGIN
            ALTER TABLE job_technician_locations 
            ADD CONSTRAINT fk_job_technician_locations_technician_id 
            FOREIGN KEY (technician_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN
            NULL; -- Constraint already exists
        END;
    END IF;
END
$$;

-- Add indexes for performance
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

-- Enable RLS on all tables
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;
GRANT SELECT, INSERT ON job_status_updates TO authenticated;
GRANT SELECT ON location_logs TO authenticated;

-- Show final table structures
SELECT 
    'job_technician_locations' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations'
UNION ALL
SELECT 
    'job_status_updates' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'job_status_updates'
UNION ALL
SELECT 
    'location_logs' as table_name,
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'location_logs'
ORDER BY table_name, column_name;