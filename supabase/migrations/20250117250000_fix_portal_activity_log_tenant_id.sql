-- Fix portal_activity_log table by adding missing tenant_id column
-- The table exists but is missing tenant_id which ClientPortalService expects

-- Add tenant_id column if it doesn't exist
ALTER TABLE portal_activity_log 
ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Update the tenant_id for existing records based on their portal token
UPDATE portal_activity_log pal
SET tenant_id = cpt.tenant_id
FROM client_portal_tokens cpt
WHERE pal.portal_token_id = cpt.id
  AND pal.tenant_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'portal_activity_log_tenant_id_fkey'
    ) THEN
        ALTER TABLE portal_activity_log 
        ADD CONSTRAINT portal_activity_log_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_portal_activity_log_tenant_id ON portal_activity_log(tenant_id);

-- Update the RLS policies to check tenant_id consistency
DROP POLICY IF EXISTS "anonymous_can_log_activity" ON portal_activity_log;
DROP POLICY IF EXISTS "anon_can_insert_activity_log" ON portal_activity_log;

-- Create new anonymous insert policy that validates tenant_id matches the portal token
CREATE POLICY "anonymous_can_log_activity" ON portal_activity_log
    FOR INSERT TO anon
    WITH CHECK (
        -- Allow insert if the tenant_id matches the portal token's tenant_id
        EXISTS (
            SELECT 1 FROM client_portal_tokens cpt
            WHERE cpt.id = portal_activity_log.portal_token_id
              AND cpt.tenant_id = portal_activity_log.tenant_id
              AND cpt.is_active = true
              AND (cpt.expires_at IS NULL OR cpt.expires_at > NOW())
        )
    );

-- Update authenticated user policy to check tenant consistency
DROP POLICY IF EXISTS "authenticated_users_can_manage_activity" ON portal_activity_log;

CREATE POLICY "authenticated_users_can_manage_activity" ON portal_activity_log
    FOR ALL TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Add helpful comment
COMMENT ON COLUMN portal_activity_log.tenant_id IS 'Tenant ID for multi-tenant isolation, must match the portal token tenant';