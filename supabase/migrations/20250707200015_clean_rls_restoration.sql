-- Clean RLS restoration - single migration to fix everything
-- This combines all the fixes into one migration without conflicts

-- PART 1: CLEANUP
-- ================

-- 1.1 Drop all problematic functions
DROP FUNCTION IF EXISTS invite_team_member CASCADE;
DROP FUNCTION IF EXISTS create_auth_user_for_profile CASCADE;
DROP FUNCTION IF EXISTS send_password_reset_for_profile CASCADE;
DROP FUNCTION IF EXISTS admin_create_auth_user CASCADE;
DROP FUNCTION IF EXISTS link_orphaned_profile_on_signup CASCADE;
DROP FUNCTION IF EXISTS get_current_user_tenant CASCADE;
DROP FUNCTION IF EXISTS is_user_admin CASCADE;
DROP FUNCTION IF EXISTS temp_allow_all_access CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_and_role CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role CASCADE;
DROP FUNCTION IF EXISTS auth_user_id CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant_id CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant CASCADE;
DROP FUNCTION IF EXISTS current_user_role CASCADE;

-- 1.2 Drop all triggers
DROP TRIGGER IF EXISTS link_orphaned_profile_trigger ON auth.users;

-- 1.3 Drop all policies on user_profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
    END LOOP;
END $$;

-- PART 2: CREATE PROPER RLS POLICIES
-- ===================================

-- 2.1 User profiles policies
CREATE POLICY "users_read_own_profile" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "users_read_tenant_profiles" ON user_profiles
    FOR SELECT  
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

CREATE POLICY "users_update_own_profile" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_insert_own_profile" ON user_profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "admins_manage_tenant_profiles" ON user_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles admin_user
            WHERE admin_user.id = auth.uid()
            AND admin_user.role IN ('admin', 'manager', 'supervisor')
            AND admin_user.tenant_id = user_profiles.tenant_id
            LIMIT 1
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM user_profiles admin_user
            WHERE admin_user.id = auth.uid()
            AND admin_user.role IN ('admin', 'manager', 'supervisor')
            AND admin_user.tenant_id = user_profiles.tenant_id
            LIMIT 1
        )
    );

-- 2.2 Fix other table policies
-- Drop and recreate clean policies for contacts
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "service_role_bypass_contacts" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON contacts;

CREATE POLICY "tenant_isolation" ON contacts
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Drop and recreate clean policies for accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "service_role_bypass_accounts" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON accounts;

CREATE POLICY "tenant_isolation" ON accounts
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Drop and recreate clean policies for jobs
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "service_role_bypass_jobs" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON jobs;

CREATE POLICY "tenant_isolation" ON jobs
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Drop and recreate clean policies for leads
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "service_role_bypass_leads" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON leads;

CREATE POLICY "tenant_isolation" ON leads
    FOR ALL
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- PART 3: CREATE HELPER FUNCTIONS (NO SECURITY DEFINER)
-- =====================================================

-- Helper to get current user's tenant (respects RLS)
CREATE OR REPLACE FUNCTION auth_user_tenant()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Helper to check if user is admin (respects RLS)
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager', 'supervisor')
        LIMIT 1
    );
$$;

-- PART 4: CREATE NECESSARY FUNCTIONS
-- ==================================

-- Function to create team members (respects RLS)
CREATE OR REPLACE FUNCTION create_team_member(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_role TEXT,
    p_phone TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_employee_id TEXT DEFAULT NULL,
    p_hourly_rate DECIMAL DEFAULT NULL,
    p_salary DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_profile_id UUID;
    v_caller_role TEXT;
BEGIN
    -- Get caller's tenant and role
    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Check permissions
    IF v_caller_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;
    
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'Email already exists';
    END IF;
    
    -- Generate new ID
    v_profile_id := gen_random_uuid();
    
    -- Insert profile
    INSERT INTO user_profiles (
        id, tenant_id, email, first_name, last_name, role,
        phone, department, employee_id, hourly_rate, salary
    ) VALUES (
        v_profile_id, v_tenant_id, p_email, p_first_name, p_last_name, p_role,
        p_phone, p_department, p_employee_id, p_hourly_rate, p_salary
    );
    
    RETURN v_profile_id;
END;
$$;

-- PART 5: CREATE TABLES IF MISSING
-- ================================

-- Create team_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES user_profiles(id),
    email TEXT NOT NULL,
    tenant_id UUID REFERENCES tenants(id),
    invited_by UUID REFERENCES user_profiles(id),
    invitation_message TEXT,
    token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email TEXT NOT NULL,
    cc_email TEXT,
    bcc_email TEXT,
    subject TEXT NOT NULL,
    body TEXT,
    template_id TEXT,
    template_data JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    details JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PART 6: ENABLE RLS
-- ==================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Add RLS to team_invitations
CREATE POLICY "users_see_own_invitations" ON team_invitations
    FOR SELECT
    USING (
        email = current_setting('request.jwt.claims', true)::json->>'email'
        OR invited_by = auth.uid()
    );

CREATE POLICY "admins_manage_invitations" ON team_invitations
    FOR ALL
    USING (
        auth_is_admin() 
        AND tenant_id = auth_user_tenant()
    );

-- PART 7: GRANT PERMISSIONS
-- =========================

GRANT EXECUTE ON FUNCTION auth_user_tenant() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_member(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,DECIMAL,DECIMAL) TO authenticated;

GRANT SELECT, INSERT ON email_queue TO authenticated;
GRANT SELECT, INSERT ON team_invitations TO authenticated;
GRANT INSERT ON system_logs TO authenticated;

-- PART 8: CREATE ORPHANED PROFILES VIEW
-- =====================================

CREATE OR REPLACE VIEW v_orphaned_profiles AS
SELECT 
    up.id as profile_id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.tenant_id,
    up.created_at,
    t.company_name,
    NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.id = up.id) as missing_auth
FROM user_profiles up
LEFT JOIN tenants t ON t.id = up.tenant_id
WHERE NOT EXISTS(SELECT 1 FROM auth.users au WHERE au.id = up.id);

GRANT SELECT ON v_orphaned_profiles TO authenticated;

-- Done! This single migration:
-- 1. Cleans up all problematic functions and policies
-- 2. Creates proper RLS policies that enforce tenant isolation
-- 3. Uses helper functions that respect RLS (no SECURITY DEFINER)
-- 4. Creates necessary tables for invitations
-- 5. Preserves legitimate SECURITY DEFINER functions (not touched)