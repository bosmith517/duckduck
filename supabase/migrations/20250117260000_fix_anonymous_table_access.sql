-- Fix anonymous access for job_technician_locations and property_data tables
-- These tables need to be accessible from the customer portal

-- 1. Ensure RLS is enabled on both tables
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_data ENABLE ROW LEVEL SECURITY;

-- 2. Grant SELECT permissions to anonymous users
GRANT SELECT ON job_technician_locations TO anon;
GRANT SELECT ON property_data TO anon;

-- 3. Add anonymous access policy for property_data
-- Allow portal users to read property data for jobs they have access to
CREATE POLICY "Portal users can view property data" ON property_data
    FOR SELECT TO anon
    USING (
        -- Allow access if there's a valid portal token for a job at this property
        EXISTS (
            SELECT 1 
            FROM client_portal_tokens cpt
            JOIN jobs j ON j.id = cpt.job_id
            WHERE cpt.is_active = true 
              AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
              AND j.tenant_id = property_data.tenant_id
              AND (
                  -- Match by address components
                  UPPER(j.location_address) = property_data.normalized_address
                  OR UPPER(j.location_address) LIKE '%' || property_data.normalized_address || '%'
              )
        )
    );

-- 4. Ensure the job_technician_locations policy is set up correctly for anonymous access
-- The existing "Public read access with tracking token" policy should work, but let's make sure
-- it's compatible with how the customer portal queries it
DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;

CREATE POLICY "Public read access with tracking token" ON job_technician_locations
    FOR SELECT TO anon
    USING (
        is_active = true 
        AND expires_at > NOW()
        AND tracking_token IS NOT NULL
    );

-- Also allow portal users to see tracking for their job
CREATE POLICY "Portal users can view job tracking" ON job_technician_locations
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1 
            FROM client_portal_tokens cpt
            WHERE cpt.job_id = job_technician_locations.job_id
              AND cpt.is_active = true 
              AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
        )
    );

-- 5. Add helpful comments
COMMENT ON POLICY "Portal users can view property data" ON property_data IS 
'Allows anonymous portal users to view property data for addresses associated with jobs they have portal access to';

COMMENT ON POLICY "Portal users can view job tracking" ON job_technician_locations IS 
'Allows anonymous portal users to view technician tracking for jobs they have portal access to';