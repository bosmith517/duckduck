-- COMPLETE TRACKING MIGRATION
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Add missing columns to existing tables
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS technician_id UUID;

-- Add missing columns to location_logs table
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS speed NUMERIC;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS heading INTEGER;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS accuracy NUMERIC;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS data_retention_category VARCHAR(50) DEFAULT 'business_records';
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create job_status_updates table
CREATE TABLE IF NOT EXISTS job_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Status information
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    status_notes TEXT,
    
    -- Location context (captured automatically when status changes)
    location_latitude NUMERIC,
    location_longitude NUMERIC,
    location_accuracy NUMERIC,
    
    -- Timestamps (matching your existing pattern)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Update any NULL values in the tracking table
UPDATE job_technician_locations 
SET 
  is_active = COALESCE(is_active, true),
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, created_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW()),
  technician_id = COALESCE(technician_id, user_id)
WHERE is_active IS NULL OR started_at IS NULL OR last_updated IS NULL OR updated_at IS NULL OR technician_id IS NULL;

-- Step 4: Add foreign key constraints
DO $$
BEGIN
    -- Add foreign key for job_status_updates.job_id to jobs table
    BEGIN
        ALTER TABLE job_status_updates 
        ADD CONSTRAINT fk_job_status_updates_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;

    -- Add foreign key for location_logs.job_id to jobs table  
    BEGIN
        ALTER TABLE location_logs 
        ADD CONSTRAINT fk_location_logs_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;

    -- Add foreign key for job_technician_locations.job_id to jobs table (if not exists)
    BEGIN
        ALTER TABLE job_technician_locations 
        ADD CONSTRAINT fk_job_technician_locations_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;
END
$$;

-- Step 5: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_job_status_updates_job_id ON job_status_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_user ON job_status_updates(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_tenant ON job_status_updates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_location_logs_job_id ON location_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_tracking_token ON location_logs(tracking_token);
CREATE INDEX IF NOT EXISTS idx_location_logs_logged_at ON location_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_location_logs_user_date ON location_logs(user_id, logged_at);

CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_user ON job_technician_locations(user_id);

-- Step 6: Enable RLS on all tables
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- Step 7: Grant permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;
GRANT SELECT, INSERT ON job_status_updates TO authenticated;
GRANT SELECT ON location_logs TO authenticated;

-- Step 8: Create RLS policies
-- Drop all existing tracking policies to start fresh
DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can update their own location" ON job_technician_locations;
DROP POLICY IF EXISTS "Authenticated users can insert tracking data" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can insert status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Admins can view all status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own location history" ON location_logs;
DROP POLICY IF EXISTS "Admins can view all location logs" ON location_logs;

-- Create policies for job_technician_locations
CREATE POLICY "Public read access with tracking token" ON job_technician_locations
    FOR SELECT 
    USING (
        is_active = true 
        AND expires_at > NOW()
        AND tracking_token IS NOT NULL
    );

CREATE POLICY "Technicians can update their own location" ON job_technician_locations
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert tracking data" ON job_technician_locations
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Create policies for job_status_updates
CREATE POLICY "Technicians can insert status updates" ON job_status_updates
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Technicians can view their own status updates" ON job_status_updates
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all status updates" ON job_status_updates
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Create policies for location_logs
CREATE POLICY "Technicians can view their own location history" ON location_logs
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all location logs" ON location_logs
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Step 9: Create system functions
CREATE OR REPLACE FUNCTION system_start_tracking_session(
    p_job_id UUID,
    p_technician_id UUID,
    p_initial_latitude NUMERIC,
    p_initial_longitude NUMERIC,
    p_duration_hours INTEGER DEFAULT 4
) RETURNS VARCHAR
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    tracking_token VARCHAR(255);
    expires_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate a unique tracking token
    tracking_token := 'track_' || encode(gen_random_bytes(16), 'hex');
    
    -- Calculate expiration time
    expires_time := NOW() + (p_duration_hours || ' hours')::interval;
    
    -- Insert or update tracking session
    INSERT INTO job_technician_locations (
        job_id,
        user_id,
        technician_id,
        tracking_token,
        latitude,
        longitude,
        is_active,
        started_at,
        expires_at,
        last_updated,
        updated_at
    ) VALUES (
        p_job_id,
        p_technician_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        true,
        NOW(),
        expires_time,
        NOW(),
        NOW()
    )
    ON CONFLICT (job_id, user_id) 
    DO UPDATE SET
        tracking_token = EXCLUDED.tracking_token,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = true,
        expires_at = EXCLUDED.expires_at,
        last_updated = NOW(),
        updated_at = NOW();
    
    -- Log the initial location
    INSERT INTO location_logs (
        job_id,
        user_id,
        tracking_token,
        latitude,
        longitude,
        logged_at,
        data_retention_category
    ) VALUES (
        p_job_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        NOW(),
        'business_records'
    );
    
    RETURN tracking_token;
END;
$$;

CREATE OR REPLACE FUNCTION system_update_technician_location(
    p_job_id UUID,
    p_technician_id UUID,
    p_tracking_token VARCHAR(255),
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_accuracy NUMERIC DEFAULT NULL,
    p_speed NUMERIC DEFAULT NULL,
    p_heading INTEGER DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update the current tracking session
    UPDATE job_technician_locations 
    SET 
        latitude = p_latitude,
        longitude = p_longitude,
        last_updated = NOW(),
        updated_at = NOW()
    WHERE 
        job_id = p_job_id 
        AND user_id = p_technician_id 
        AND tracking_token = p_tracking_token
        AND is_active = true
        AND expires_at > NOW();
    
    -- Check if update was successful
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Log the location update
    INSERT INTO location_logs (
        job_id,
        user_id,
        tracking_token,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        logged_at,
        data_retention_category
    ) VALUES (
        p_job_id,
        p_technician_id,
        p_tracking_token,
        p_latitude,
        p_longitude,
        p_speed,
        p_heading,
        p_accuracy,
        NOW(),
        'business_records'
    );
    
    RETURN true;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION system_start_tracking_session TO service_role;
GRANT EXECUTE ON FUNCTION system_update_technician_location TO service_role;

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;

-- Success message
SELECT 'Tracking system migration completed successfully!' as result;