-- Create the system functions for secure tracking management

-- 1. Function for system-only tracking session creation
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
        expires_at,
        is_active,
        started_at,
        last_updated
    ) VALUES (
        p_job_id,
        p_technician_id,
        tracking_token,
        p_initial_latitude,
        p_initial_longitude,
        NOW() + (p_duration_hours || ' hours')::INTERVAL,
        true,
        NOW(),
        NOW()
    );
    
    -- Log initial location
    INSERT INTO location_logs (
        job_id, 
        technician_id, 
        tracking_token, 
        latitude, 
        longitude,
        logged_at
    ) VALUES (
        p_job_id, 
        p_technician_id, 
        tracking_token, 
        p_initial_latitude, 
        p_initial_longitude,
        NOW()
    );
    
    RETURN tracking_token;
END;
$$;

-- 2. Function for system-only location updates
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
DECLARE
    update_count INTEGER;
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
    
    GET DIAGNOSTICS update_count = ROW_COUNT;
    
    -- Only log if we successfully updated
    IF update_count > 0 THEN
        -- Log to permanent history
        INSERT INTO location_logs (
            job_id, 
            technician_id, 
            tracking_token, 
            latitude, 
            longitude, 
            accuracy, 
            speed, 
            heading,
            logged_at
        ) VALUES (
            p_job_id, 
            p_technician_id, 
            p_tracking_token, 
            p_latitude, 
            p_longitude, 
            p_accuracy, 
            p_speed, 
            p_heading,
            NOW()
        );
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- 3. Function to handle job status updates and trigger tracking
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

-- 4. Create trigger for job status updates
DROP TRIGGER IF EXISTS trigger_job_status_update ON job_status_updates;
CREATE TRIGGER trigger_job_status_update
    AFTER INSERT ON job_status_updates
    FOR EACH ROW
    EXECUTE FUNCTION handle_job_status_update();

-- 5. Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to update timestamps on location updates
DROP TRIGGER IF EXISTS update_job_technician_locations_timestamp ON job_technician_locations;
CREATE TRIGGER update_job_technician_locations_timestamp
    BEFORE UPDATE ON job_technician_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_timestamp();

-- 7. Function to clean up expired tracking sessions (DEACTIVATE ONLY, NEVER DELETE)
CREATE OR REPLACE FUNCTION cleanup_expired_tracking_sessions()
RETURNS void AS $$
BEGIN
    -- Deactivate expired sessions (keep records for legal compliance)
    UPDATE job_technician_locations 
    SET is_active = false, updated_at = NOW()
    WHERE expires_at < NOW() AND is_active = true;
    
    -- Archive old location logs (mark as archived but keep forever)
    UPDATE location_logs 
    SET archived_at = NOW()
    WHERE logged_at < NOW() - INTERVAL '90 days' 
    AND archived_at IS NULL;
    
    -- Note: We NEVER delete location logs for legal/compliance reasons
    -- All location data is retained permanently
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function for legal data exports (if needed for compliance)
CREATE OR REPLACE FUNCTION export_technician_location_data(
    technician_uuid UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    log_id UUID,
    job_id UUID,
    latitude DECIMAL,
    longitude DECIMAL,
    logged_at TIMESTAMP WITH TIME ZONE,
    speed DECIMAL,
    heading INTEGER,
    accuracy DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow admins to export data
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'owner')
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;
    
    RETURN QUERY
    SELECT 
        ll.id,
        ll.job_id,
        ll.latitude,
        ll.longitude,
        ll.logged_at,
        ll.speed,
        ll.heading,
        ll.accuracy
    FROM location_logs ll
    WHERE ll.technician_id = technician_uuid
    AND ll.logged_at >= start_date
    AND ll.logged_at <= end_date
    ORDER BY ll.logged_at;
END;
$$;

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION system_start_tracking_session(UUID, UUID, DECIMAL, DECIMAL, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION system_update_technician_location(UUID, UUID, VARCHAR, DECIMAL, DECIMAL, DECIMAL, DECIMAL, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_tracking_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION export_technician_location_data(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 10. Add comments for documentation
COMMENT ON FUNCTION system_start_tracking_session(UUID, UUID, DECIMAL, DECIMAL, INTEGER) IS 'System-only function to start tracking session when technician begins driving';
COMMENT ON FUNCTION system_update_technician_location(UUID, UUID, VARCHAR, DECIMAL, DECIMAL, DECIMAL, DECIMAL, INTEGER) IS 'System-only function to update technician location data via Edge Functions';
COMMENT ON FUNCTION handle_job_status_update() IS 'Automatically triggers location tracking prompts when job status changes to "on_the_way"';
COMMENT ON FUNCTION cleanup_expired_tracking_sessions() IS 'Deactivates expired tracking sessions and archives old logs. NEVER deletes location data for legal compliance.';
COMMENT ON FUNCTION export_technician_location_data(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Admin-only function to export technician location data for legal/compliance purposes';