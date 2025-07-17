-- Add anonymous access to estimates table for customer portal

-- Enable RLS on estimates table if not already enabled
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- Grant SELECT permission to anonymous users
GRANT SELECT ON estimates TO anon;

-- Create policy for portal users to view estimates for their jobs
CREATE POLICY "Portal users can view estimates for their jobs" ON estimates
    FOR SELECT TO anon
    USING (
        -- Allow access if the estimate is linked to a job that has a valid portal token
        EXISTS (
            SELECT 1 
            FROM jobs j
            JOIN client_portal_tokens cpt ON cpt.job_id = j.id
            WHERE (j.estimate_id = estimates.id OR estimates.job_id = j.id)
              AND cpt.is_active = true 
              AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
        )
    );

-- Create policy for portal users to update estimate status when signing
CREATE POLICY "Portal users can sign estimates" ON estimates
    FOR UPDATE TO anon
    USING (
        -- Can only update if they have portal access to the related job
        EXISTS (
            SELECT 1 
            FROM jobs j
            JOIN client_portal_tokens cpt ON cpt.job_id = j.id
            WHERE (j.estimate_id = estimates.id OR estimates.job_id = j.id)
              AND cpt.is_active = true 
              AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
        )
    );

-- Add helpful comment
COMMENT ON POLICY "Portal users can view estimates for their jobs" ON estimates IS 
'Allows anonymous portal users to view estimates that are linked to jobs they have portal access to';

COMMENT ON POLICY "Portal users can sign estimates" ON estimates IS 
'Allows anonymous portal users to sign/approve estimates for jobs they have portal access to';

-- Create an RPC function to handle estimate signing with proper validation
CREATE OR REPLACE FUNCTION sign_estimate_via_portal(
    p_estimate_id UUID,
    p_portal_token TEXT,
    p_signed_by TEXT,
    p_signature_data TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_id UUID;
    v_token_valid BOOLEAN;
BEGIN
    -- Verify the portal token is valid and get the job_id
    SELECT j.id INTO v_job_id
    FROM jobs j
    JOIN client_portal_tokens cpt ON cpt.job_id = j.id
    WHERE j.estimate_id = p_estimate_id
      AND cpt.token = p_portal_token
      AND cpt.is_active = true
      AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
    LIMIT 1;

    IF v_job_id IS NULL THEN
        RAISE EXCEPTION 'Invalid portal token or estimate access denied';
    END IF;

    -- Update the estimate with signature
    UPDATE estimates
    SET 
        status = 'signed',
        signed_at = NOW(),
        signed_by_name = p_signed_by,
        signature_data = p_signature_data,
        updated_at = NOW()
    WHERE id = p_estimate_id
      AND status IN ('sent', 'draft'); -- Can only sign unsigned estimates

    -- Log the activity
    INSERT INTO portal_activity_log (
        portal_token_id,
        tenant_id,
        activity_type,
        metadata,
        created_at
    )
    SELECT 
        cpt.id,
        cpt.tenant_id,
        'sign_estimate',
        jsonb_build_object(
            'estimate_id', p_estimate_id,
            'signed_by', p_signed_by,
            'job_id', v_job_id
        ),
        NOW()
    FROM client_portal_tokens cpt
    WHERE cpt.token = p_portal_token;

    RETURN TRUE;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION sign_estimate_via_portal TO anon;
GRANT EXECUTE ON FUNCTION sign_estimate_via_portal TO authenticated;

-- Add comment
COMMENT ON FUNCTION sign_estimate_via_portal IS 'Allows portal users to sign estimates with proper validation and activity logging';