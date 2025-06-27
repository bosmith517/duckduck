-- STEP 2: Create the other tracking tables (run after step 1 succeeds)

-- Create job_status_updates table
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

-- Create location_logs table
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