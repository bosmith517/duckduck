-- Fix customer portal access for anonymous users
-- The portal should be accessible without authentication using the token

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "anonymous_can_read_active_tokens" ON client_portal_tokens;
DROP POLICY IF EXISTS "public_can_validate_tokens" ON client_portal_tokens;

-- Create policy to allow anonymous users to read active portal tokens
-- This is essential for customers to access their portal without logging in
CREATE POLICY "public_can_validate_tokens" ON client_portal_tokens
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Also ensure jobs table can be read when accessed through a valid portal token
-- This is handled by the portal validation service, but we need to ensure
-- the related data can be accessed

-- Create a function to validate portal tokens that can be called by anonymous users
CREATE OR REPLACE FUNCTION validate_portal_token(token_string TEXT)
RETURNS TABLE (
  token_id UUID,
  job_id UUID,
  customer_id UUID,
  tenant_id UUID,
  is_valid BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cpt.id as token_id,
    cpt.job_id,
    cpt.customer_id,
    cpt.tenant_id,
    (cpt.is_active = true AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())) as is_valid
  FROM client_portal_tokens cpt
  WHERE cpt.token = token_string
    AND cpt.is_active = true
    AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
  LIMIT 1;
  
  -- Update access count if token is valid
  IF FOUND THEN
    UPDATE client_portal_tokens 
    SET 
      access_count = access_count + 1,
      last_accessed = NOW()
    WHERE token = token_string;
  END IF;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION validate_portal_token TO anon;
GRANT EXECUTE ON FUNCTION validate_portal_token TO authenticated;

-- Ensure the jobs table can be accessed through portal tokens
-- Note: The actual data filtering is done in the application layer
-- after validating the portal token

-- Add comment explaining the security model
COMMENT ON POLICY "public_can_validate_tokens" ON client_portal_tokens IS 
'Allows anonymous users to validate portal tokens for customer access. The token acts as authentication for customers to view their job details without creating an account.';

COMMENT ON FUNCTION validate_portal_token IS 
'Validates a portal token and returns associated job information. This function uses SECURITY DEFINER to bypass RLS for token validation, ensuring customers can access their portals without authentication.';