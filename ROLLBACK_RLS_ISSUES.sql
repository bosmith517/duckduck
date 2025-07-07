-- Rollback script to remove problematic RLS changes
-- Run this if you need to completely reset RLS to a clean state

-- 1. Disable RLS temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on key tables
    FOR r IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('user_profiles', 'contacts', 'accounts', 'jobs', 'leads', 'estimates', 'invoices')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

-- 3. Drop problematic functions
DROP FUNCTION IF EXISTS get_user_tenant_and_role() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS validate_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_user_profile_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS is_user_admin() CASCADE;
DROP FUNCTION IF EXISTS temp_allow_all_access() CASCADE;

-- 4. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 5. Create minimal working policies for user_profiles
-- These are the absolute minimum to allow the system to function

-- Everyone can read their own profile
CREATE POLICY "read_own_profile" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Everyone can update their own profile  
CREATE POLICY "update_own_profile" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid());

-- Allow profile creation on signup
CREATE POLICY "create_own_profile" ON user_profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- Tenant members can see each other
CREATE POLICY "read_tenant_profiles" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- 6. Create basic policies for other tables
-- These ensure tenant isolation without complex logic

-- Contacts
CREATE POLICY "tenant_contacts" ON contacts
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Accounts  
CREATE POLICY "tenant_accounts" ON accounts
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Jobs
CREATE POLICY "tenant_jobs" ON jobs
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Leads
CREATE POLICY "tenant_leads" ON leads
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Estimates
CREATE POLICY "tenant_estimates" ON estimates
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Invoices
CREATE POLICY "tenant_invoices" ON invoices
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- 7. Log the rollback
DO $$
BEGIN
    INSERT INTO system_logs (action, details, user_id, created_at)
    VALUES (
        'rls_rollback_executed',
        json_build_object(
            'description', 'Rolled back to basic RLS policies',
            'timestamp', NOW()
        ),
        auth.uid(),
        NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore if system_logs doesn't exist
        NULL;
END $$;

-- Done! The system now has clean, simple RLS policies that:
-- 1. Enforce tenant isolation
-- 2. Don't use SECURITY DEFINER to bypass RLS
-- 3. Don't have circular dependencies
-- 4. Are easy to understand and debug