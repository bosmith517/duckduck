-- Create the system functions that the Edge Functions are expecting
-- These match the exact function names called by the Edge Functions

-- Function to start a tracking session (called by start-technician-tracking)
CREATE OR REPLACE FUNCTION system_start_tracking_session(
    p_job_id UUID,
    p_technician_id UUID,
    p_initial_latitude NUMERIC,
    p_initial_longitude NUMERIC,
    p_duration_hours INTEGER DEFAULT 4
) RETURNS VARCHAR
SECURITY DEFINER -- Only system can call this function
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
        user_id,           -- Use user_id as per existing schema
        technician_id,     -- Also set technician_id for Edge Function compatibility
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
        p_technician_id,   -- user_id
        p_technician_id,   -- technician_id (same value)
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

-- Function to update technician location (called by update-technician-location)
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
SECURITY DEFINER -- Only system can call this function
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
    
    -- Log the location update (NEVER delete these for legal compliance)
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

-- Grant execution permissions to the service role (for Edge Functions)
GRANT EXECUTE ON FUNCTION system_start_tracking_session TO service_role;
GRANT EXECUTE ON FUNCTION system_update_technician_location TO service_role;

-- Function to safely stop tracking (optional - for when job is complete)
CREATE OR REPLACE FUNCTION system_stop_tracking_session(
    p_job_id UUID,
    p_technician_id UUID
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE job_technician_locations 
    SET 
        is_active = false,
        updated_at = NOW()
    WHERE 
        job_id = p_job_id 
        AND user_id = p_technician_id 
        AND is_active = true;
    
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION system_stop_tracking_session TO service_role;

-- Create a view for easy tracking status queries
CREATE OR REPLACE VIEW active_tracking_sessions AS
SELECT 
    jtl.job_id,
    jtl.user_id as technician_id,
    jtl.tracking_token,
    jtl.latitude,
    jtl.longitude,
    jtl.started_at,
    jtl.expires_at,
    jtl.last_updated,
    j.contact_id,
    c.first_name,
    c.last_name,
    c.phone as customer_phone
FROM job_technician_locations jtl
JOIN jobs j ON j.id = jtl.job_id
JOIN contacts c ON c.id = j.contact_id
WHERE jtl.is_active = true 
AND jtl.expires_at > NOW();

-- Grant access to the view
GRANT SELECT ON active_tracking_sessions TO authenticated;

-- Success message
SELECT 'Tracking system functions created successfully!' as result;