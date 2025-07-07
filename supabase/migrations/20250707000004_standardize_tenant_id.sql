-- Standardize tenant_id across database for proper multi-tenant isolation

-- 1. Add tenant_id to notification_preferences table
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant_id 
ON notification_preferences(tenant_id);

-- Populate tenant_id from user_profiles for existing records
UPDATE notification_preferences np
SET tenant_id = up.tenant_id
FROM user_profiles up
WHERE np.user_id = up.id
AND np.tenant_id IS NULL;

-- Make tenant_id NOT NULL after population
ALTER TABLE notification_preferences 
ALTER COLUMN tenant_id SET NOT NULL;

-- Update the unique constraint to include tenant_id
ALTER TABLE notification_preferences 
DROP CONSTRAINT IF EXISTS notification_preferences_user_id_key;

ALTER TABLE notification_preferences 
ADD CONSTRAINT notification_preferences_user_tenant_unique 
UNIQUE (user_id, tenant_id);

-- Drop and recreate RLS policies for notification_preferences with tenant isolation
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;

CREATE POLICY "Users can view own tenant notification preferences" ON notification_preferences
    FOR SELECT USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update own tenant notification preferences" ON notification_preferences
    FOR UPDATE USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own tenant notification preferences" ON notification_preferences
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own tenant notification preferences" ON notification_preferences
    FOR DELETE USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- 2. Ensure all business tables have proper tenant_id indexes
-- These should already exist, but let's make sure
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_id ON estimates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant_id ON sms_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_tenant_id ON email_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_tenant_id ON client_portal_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_id ON chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_tenant_id ON job_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_companies_tenant_id ON subcontractor_companies(parent_tenant_id);

-- 3. Create a helper function to validate tenant_id consistency
CREATE OR REPLACE FUNCTION validate_tenant_id_consistency()
RETURNS TABLE (
    table_name TEXT,
    issue_type TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check for NULL tenant_ids in business tables
    RETURN QUERY
    SELECT 'leads'::TEXT, 'null_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM leads WHERE tenant_id IS NULL
    HAVING COUNT(*) > 0;
    
    RETURN QUERY
    SELECT 'contacts'::TEXT, 'null_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM contacts WHERE tenant_id IS NULL
    HAVING COUNT(*) > 0;
    
    RETURN QUERY
    SELECT 'accounts'::TEXT, 'null_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM accounts WHERE tenant_id IS NULL
    HAVING COUNT(*) > 0;
    
    RETURN QUERY
    SELECT 'jobs'::TEXT, 'null_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM jobs WHERE tenant_id IS NULL
    HAVING COUNT(*) > 0;
    
    -- Check for orphaned tenant_ids (referencing non-existent tenants)
    RETURN QUERY
    SELECT 'leads'::TEXT, 'orphaned_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM leads l
    WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = l.tenant_id)
    HAVING COUNT(*) > 0;
    
    RETURN QUERY
    SELECT 'contacts'::TEXT, 'orphaned_tenant_id'::TEXT, COUNT(*)::TEXT
    FROM contacts c
    WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = c.tenant_id)
    HAVING COUNT(*) > 0;
    
    -- Check for cross-tenant references (e.g., contact referencing account from different tenant)
    RETURN QUERY
    SELECT 'contacts'::TEXT, 'cross_tenant_reference'::TEXT, COUNT(*)::TEXT
    FROM contacts c
    JOIN accounts a ON c.account_id = a.id
    WHERE c.tenant_id != a.tenant_id
    HAVING COUNT(*) > 0;
    
    RETURN QUERY
    SELECT 'jobs'::TEXT, 'cross_tenant_reference'::TEXT, COUNT(*)::TEXT
    FROM jobs j
    LEFT JOIN contacts c ON j.contact_id = c.id
    WHERE c.id IS NOT NULL AND j.tenant_id != c.tenant_id
    HAVING COUNT(*) > 0;
END;
$$;

-- 4. Create a function to ensure tenant_id is set on insert
CREATE OR REPLACE FUNCTION ensure_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If tenant_id is not set, try to get it from the user's profile
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_profiles
        WHERE id = auth.uid();
        
        IF NEW.tenant_id IS NULL THEN
            RAISE EXCEPTION 'tenant_id must be provided';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. Add triggers to ensure tenant_id is always set for key tables
-- Only add if the trigger doesn't already exist
DO $$
BEGIN
    -- Check and create triggers only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_tenant_id_trigger' AND tgrelid = 'leads'::regclass) THEN
        CREATE TRIGGER ensure_tenant_id_trigger
        BEFORE INSERT ON leads
        FOR EACH ROW
        EXECUTE FUNCTION ensure_tenant_id();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_tenant_id_trigger' AND tgrelid = 'contacts'::regclass) THEN
        CREATE TRIGGER ensure_tenant_id_trigger
        BEFORE INSERT ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION ensure_tenant_id();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_tenant_id_trigger' AND tgrelid = 'accounts'::regclass) THEN
        CREATE TRIGGER ensure_tenant_id_trigger
        BEFORE INSERT ON accounts
        FOR EACH ROW
        EXECUTE FUNCTION ensure_tenant_id();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_tenant_id_trigger' AND tgrelid = 'jobs'::regclass) THEN
        CREATE TRIGGER ensure_tenant_id_trigger
        BEFORE INSERT ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION ensure_tenant_id();
    END IF;
END $$;

-- 6. Create a view to easily check tenant data distribution
CREATE OR REPLACE VIEW tenant_data_summary AS
SELECT 
    t.id as tenant_id,
    t.company_name,
    t.plan,
    (SELECT COUNT(*) FROM user_profiles WHERE tenant_id = t.id) as user_count,
    (SELECT COUNT(*) FROM leads WHERE tenant_id = t.id) as lead_count,
    (SELECT COUNT(*) FROM contacts WHERE tenant_id = t.id) as contact_count,
    (SELECT COUNT(*) FROM accounts WHERE tenant_id = t.id) as account_count,
    (SELECT COUNT(*) FROM jobs WHERE tenant_id = t.id) as job_count,
    (SELECT COUNT(*) FROM invoices WHERE tenant_id = t.id) as invoice_count,
    (SELECT COUNT(*) FROM estimates WHERE tenant_id = t.id) as estimate_count
FROM tenants t;

-- Grant access to the view
GRANT SELECT ON tenant_data_summary TO authenticated;

-- 7. Update subcontractor_users to have tenant reference
-- This ensures subcontractor users are properly linked to their parent tenant
ALTER TABLE subcontractor_users 
ADD COLUMN IF NOT EXISTS parent_tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Populate parent_tenant_id from their company
UPDATE subcontractor_users su
SET parent_tenant_id = sc.parent_tenant_id
FROM subcontractor_companies sc
WHERE su.subcontractor_company_id = sc.id
AND su.parent_tenant_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_subcontractor_users_parent_tenant_id 
ON subcontractor_users(parent_tenant_id);

-- 8. Add comments for clarity
COMMENT ON COLUMN notification_preferences.tenant_id IS 'Tenant ID for multi-tenant isolation of notification preferences';
COMMENT ON FUNCTION validate_tenant_id_consistency() IS 'Validates tenant_id consistency across all business tables';
COMMENT ON FUNCTION ensure_tenant_id() IS 'Trigger function to ensure tenant_id is always set on insert';
COMMENT ON VIEW tenant_data_summary IS 'Summary view of data distribution across tenants';

-- 9. Create an audit log for tenant_id issues (optional but helpful)
CREATE TABLE IF NOT EXISTS tenant_id_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    issue_type TEXT NOT NULL,
    details JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_tenant_id_audit_log_resolved 
ON tenant_id_audit_log(resolved) 
WHERE resolved = FALSE;

-- Grant permissions
GRANT SELECT ON tenant_id_audit_log TO authenticated;
GRANT INSERT, UPDATE ON tenant_id_audit_log TO service_role;

-- Final validation - Run the consistency check
-- This will help identify any remaining issues
-- SELECT * FROM validate_tenant_id_consistency();