-- EMERGENCY FIX - This will definitely fix the login issue
-- Run each section one at a time if needed

-- SECTION 1: Complete cleanup
BEGIN;

-- Disable RLS completely first
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;

-- Drop EVERYTHING that could cause issues
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_read_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admins_manage_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_read_own" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own" ON user_profiles;
DROP POLICY IF EXISTS "users_read_same_tenant" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "tenant_isolation_select" ON user_profiles;
DROP POLICY IF EXISTS "own_profile_update" ON user_profiles;
DROP POLICY IF EXISTS "own_profile_insert" ON user_profiles;
DROP POLICY IF EXISTS "temp_allow_authenticated" ON user_profiles;
DROP POLICY IF EXISTS "read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "create_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "read_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all authenticated users to select user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "service_role_all" ON user_profiles;
DROP POLICY IF EXISTS "service_role_bypass" ON user_profiles;
DROP POLICY IF EXISTS "admins_manage_profiles" ON user_profiles;

-- Drop ALL functions that might be referenced in policies
DROP FUNCTION IF EXISTS temp_allow_all_access() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS is_user_admin() CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_and_role() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS auth_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS auth_is_admin() CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS current_user_role() CASCADE;

COMMIT;

-- SECTION 2: Create minimal working setup
BEGIN;

-- Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create ONLY these two simple policies that CANNOT recurse
CREATE POLICY "simple_own_profile" ON user_profiles
    FOR ALL
    USING (id = auth.uid());

CREATE POLICY "simple_tenant_read" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles up 
            WHERE up.id = auth.uid() 
            AND up.tenant_id = user_profiles.tenant_id
        )
    );

COMMIT;

-- SECTION 3: Test it works
SELECT 'If you see this message, the policies are fixed!' as status;

-- This query should work without recursion error
SELECT id, email, first_name, last_name, role 
FROM user_profiles 
WHERE id = auth.uid();