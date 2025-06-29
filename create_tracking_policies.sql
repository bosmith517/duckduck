-- STEP 3: Create RLS policies (run after tables are created)

-- Drop all existing tracking policies to start fresh
DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can update their own location" ON job_technician_locations;
DROP POLICY IF EXISTS "Authenticated users can insert tracking data" ON job_technician_locations;
DROP POLICY IF EXISTS "System can deactivate expired sessions" ON job_technician_locations;

DROP POLICY IF EXISTS "Technicians can insert status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Admins can view all status updates" ON job_status_updates;

DROP POLICY IF EXISTS "Technicians can view their own location history" ON location_logs;
DROP POLICY IF EXISTS "Admins can view all location logs" ON location_logs;
DROP POLICY IF EXISTS "Authenticated users can insert location logs" ON location_logs;
DROP POLICY IF EXISTS "Admins can archive location logs" ON location_logs;

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
    USING (auth.uid() = technician_id)
    WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Authenticated users can insert tracking data" ON job_technician_locations
    FOR INSERT 
    WITH CHECK (auth.uid() = technician_id);

-- Create policies for job_status_updates
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

-- Create policies for location_logs
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

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;