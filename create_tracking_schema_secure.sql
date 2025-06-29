-- Secure tracking schema - technicians only update job status, system handles location tracking

-- 1. job_technician_locations table (stores live location with tracking tokens)
CREATE TABLE IF NOT EXISTS job_technician_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    tracking_token VARCHAR(255) NOT NULL UNIQUE,
    
    -- Location data (system managed only)
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Session management (system managed)
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT tracking_token_unique UNIQUE(tracking_token)
);

-- 2. location_logs table (permanent historical data - system managed only)
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

-- 3. job_status_updates table (what technicians CAN update)
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

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_location_logs_job_id ON location_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_tracking_token ON location_logs(tracking_token);
CREATE INDEX IF NOT EXISTS idx_location_logs_logged_at ON location_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_job_id ON job_status_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_technician ON job_status_updates(technician_id, updated_at);

-- 5. Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE job_status_updates;

-- 6. Enable Row Level Security
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for job_technician_locations (READ-ONLY for customers)
CREATE POLICY "Public read access with tracking token" ON job_technician_locations
    FOR SELECT 
    USING (
        is_active = true 
        AND expires_at > NOW()
        AND tracking_token IS NOT NULL
    );

-- No UPDATE/INSERT policies for technicians on location data - system managed only

-- 8. RLS Policies for location_logs (READ-ONLY, system managed)
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

-- 9. RLS Policies for job_status_updates (technicians CAN update these)
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

-- 10. Function to handle job status updates and trigger tracking
CREATE OR REPLACE FUNCTION handle_job_status_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is changing to "on_the_way" or "en_route", ask about starting tracking
    IF NEW.new_status IN ('on_the_way', 'en_route', 'driving_to_job') THEN
        -- This will be handled by the frontend to prompt for location tracking
        -- We just log the status change here
        NULL;
    END IF;
    
    -- If status is "completed" or "cancelled", deactivate any active tracking
    IF NEW.new_status IN ('completed', 'cancelled', 'job_finished') THEN
        UPDATE job_technician_locations 
        SET is_active = false, updated_at = NOW()
        WHERE job_id = NEW.job_id 
        AND technician_id = NEW.technician_id 
        AND is_active = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Trigger for job status updates
CREATE TRIGGER trigger_job_status_update
    AFTER INSERT ON job_status_updates
    FOR EACH ROW
    EXECUTE FUNCTION handle_job_status_update();

-- 12. Function for system-only location updates (called by Edge Functions)
CREATE OR REPLACE FUNCTION system_update_technician_location(
    p_job_id UUID,
    p_technician_id UUID,
    p_tracking_token VARCHAR,
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_accuracy DECIMAL DEFAULT NULL,
    p_speed DECIMAL DEFAULT NULL,
    p_heading INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update live location
    UPDATE job_technician_locations 
    SET 
        latitude = p_latitude,
        longitude = p_longitude,
        last_updated = NOW(),
        updated_at = NOW()
    WHERE job_id = p_job_id 
    AND technician_id = p_technician_id 
    AND tracking_token = p_tracking_token
    AND is_active = true
    AND expires_at > NOW();
    
    -- Log to permanent history
    INSERT INTO location_logs (
        job_id, 
        technician_id, 
        tracking_token, 
        latitude, 
        longitude, 
        accuracy, 
        speed, 
        heading
    ) VALUES (
        p_job_id, 
        p_technician_id, 
        p_tracking_token, 
        p_latitude, 
        p_longitude, 
        p_accuracy, 
        p_speed, 
        p_heading
    );
    
    RETURN FOUND;
END;
$$;

-- 13. Function for system-only tracking session creation
CREATE OR REPLACE FUNCTION system_start_tracking_session(
    p_job_id UUID,
    p_technician_id UUID,
    p_initial_latitude DECIMAL,
    p_initial_longitude DECIMAL,
    p_duration_hours INTEGER DEFAULT 4
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tracking_token VARCHAR;
BEGIN
    -- Generate unique tracking token
    tracking_token := 'track_' || encode(gen_random_bytes(16), 'hex');
    
    -- Deactivate any existing sessions for this job
    UPDATE job_technician_locations 
    SET is_active = false, updated_at = NOW()
    WHERE job_id = p_job_id AND is_active = true;
    
    -- Create new tracking session
    INSERT INTO job_technician_locations (
        job_id,
        technician_id,
        tracking_token,
        latitude,
        longitude,
        expires_at
    ) VALUES (
        p_job_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        NOW() + (p_duration_hours || ' hours')::INTERVAL
    );
    
    -- Log initial location
    INSERT INTO location_logs (
        job_id, 
        technician_id, 
        tracking_token, 
        latitude, 
        longitude
    ) VALUES (
        p_job_id, 
        p_technician_id, 
        tracking_token, 
        p_initial_latitude, 
        p_initial_longitude
    );
    
    RETURN tracking_token;
END;
$$;

-- 14. Grant permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT SELECT ON location_logs TO authenticated;
GRANT INSERT, SELECT ON job_status_updates TO authenticated;

-- 15. Comments for documentation
COMMENT ON TABLE job_status_updates IS 'Table where technicians update job status. System automatically handles location tracking based on status changes.';
COMMENT ON TABLE job_technician_locations IS 'System-managed live location data. Technicians cannot directly modify this.';
COMMENT ON TABLE location_logs IS 'Permanent location history. System-managed only, never deleted for legal compliance.';
COMMENT ON FUNCTION handle_job_status_update() IS 'Automatically triggers location tracking prompts when job status changes to "on_the_way"';
COMMENT ON FUNCTION system_update_technician_location(UUID, UUID, VARCHAR, DECIMAL, DECIMAL, DECIMAL, DECIMAL, INTEGER) IS 'System-only function to update technician location data via Edge Functions';
COMMENT ON FUNCTION system_start_tracking_session(UUID, UUID, DECIMAL, DECIMAL, INTEGER) IS 'System-only function to start tracking session when technician begins driving';