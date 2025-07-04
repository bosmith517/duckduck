-- Fix RLS policies for client_portal_tokens table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view portal tokens for their tenant" ON client_portal_tokens;
DROP POLICY IF EXISTS "Users can create portal tokens for their tenant" ON client_portal_tokens;
DROP POLICY IF EXISTS "Users can update portal tokens for their tenant" ON client_portal_tokens;
DROP POLICY IF EXISTS "authenticated_users_can_manage_tokens" ON client_portal_tokens;
DROP POLICY IF EXISTS "anonymous_can_read_active_tokens" ON client_portal_tokens;
DROP POLICY IF EXISTS "service_role_full_access" ON client_portal_tokens;
DROP POLICY IF EXISTS "Users can manage portal tokens for their tenant" ON client_portal_tokens;
DROP POLICY IF EXISTS "client_portal_tokens_policy" ON client_portal_tokens;

-- Ensure RLS is enabled
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Create updated RLS policies
CREATE POLICY "Users can view portal tokens for their tenant" ON client_portal_tokens
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create portal tokens for their tenant" ON client_portal_tokens
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update portal tokens for their tenant" ON client_portal_tokens
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Also ensure the table exists with proper structure
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID, -- Can be null for some cases
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_job_id ON client_portal_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_tenant_id ON client_portal_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_token ON client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_active ON client_portal_tokens(is_active);

-- Add comment
COMMENT ON TABLE client_portal_tokens IS 'Tokens for customer portal access to specific jobs';