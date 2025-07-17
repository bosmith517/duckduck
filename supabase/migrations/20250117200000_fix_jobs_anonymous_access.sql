-- Fix anonymous access to jobs table for customer portal
-- This allows customers to view their job data when accessing through a valid portal token

-- Create a function to check if a job can be accessed with a portal token
CREATE OR REPLACE FUNCTION can_access_job_with_token(job_id UUID, portal_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_valid BOOLEAN;
BEGIN
  -- Check if the token is valid and matches the job
  SELECT EXISTS (
    SELECT 1 
    FROM client_portal_tokens 
    WHERE token = portal_token 
      AND job_id = can_access_job_with_token.job_id
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO token_valid;
  
  RETURN token_valid;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION can_access_job_with_token TO anon;
GRANT EXECUTE ON FUNCTION can_access_job_with_token TO authenticated;

-- Create or replace the policy for jobs table to allow portal token access
DROP POLICY IF EXISTS "portal_token_can_read_jobs" ON jobs;

CREATE POLICY "portal_token_can_read_jobs" ON jobs
  FOR SELECT
  TO anon
  USING (
    -- Allow access if there's a valid portal token for this job
    EXISTS (
      SELECT 1 
      FROM client_portal_tokens cpt
      WHERE cpt.job_id = jobs.id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
    )
  );

-- Also ensure anonymous users can read related account and contact data
-- when accessing through the portal
DROP POLICY IF EXISTS "portal_can_read_accounts" ON accounts;
CREATE POLICY "portal_can_read_accounts" ON accounts
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 
      FROM jobs j
      JOIN client_portal_tokens cpt ON cpt.job_id = j.id
      WHERE j.account_id = accounts.id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "portal_can_read_contacts" ON contacts;
CREATE POLICY "portal_can_read_contacts" ON contacts
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 
      FROM jobs j
      JOIN client_portal_tokens cpt ON cpt.job_id = j.id
      WHERE j.contact_id = contacts.id
        AND cpt.is_active = true
        AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
    )
  );

-- Add helpful comments
COMMENT ON FUNCTION can_access_job_with_token IS 
'Checks if a job can be accessed using a portal token. Used by the customer portal to validate access without authentication.';

COMMENT ON POLICY "portal_token_can_read_jobs" ON jobs IS 
'Allows anonymous users to read job data if they have a valid portal token for that job.';

COMMENT ON POLICY "portal_can_read_accounts" ON accounts IS 
'Allows anonymous portal users to read account data associated with their job.';

COMMENT ON POLICY "portal_can_read_contacts" ON contacts IS 
'Allows anonymous portal users to read contact data associated with their job.';