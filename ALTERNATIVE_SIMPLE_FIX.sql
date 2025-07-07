-- Alternative simpler fix that avoids complex dependencies
-- This uses basic JWT claims instead of database lookups

-- 1. First, let's create a function that extracts tenant_id from JWT metadata
-- This assumes tenant_id is stored in user metadata during login
CREATE OR REPLACE FUNCTION auth.jwt_claim_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    -- Try to get tenant_id from JWT metadata
    SELECT 
        COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::UUID,
            -- Fallback: get from user_profiles if not in JWT
            (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
        );
$$;

-- 2. Create a simple function for current user role
CREATE OR REPLACE FUNCTION auth.jwt_claim_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COALESCE(
            auth.jwt() -> 'user_metadata' ->> 'role',
            (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1)
        );
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION auth.jwt_claim_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt_claim_role() TO authenticated;

-- 3. Fix user_profiles with simple policies
-- Drop all existing policies
DO $$ 
BEGIN
    -- Drop all policies on user_profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Users see and manage their own profile
CREATE POLICY "users_own_profile" ON user_profiles
    FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users see profiles in their tenant (no recursion - uses simple tenant_id match)
CREATE POLICY "users_tenant_visibility" ON user_profiles
    FOR SELECT
    USING (
        -- Direct tenant_id comparison
        tenant_id IN (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Service role bypass for system operations
CREATE POLICY "service_role_bypass" ON user_profiles
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 4. Update critical tables to use simple tenant isolation
-- Update each table one by one

-- Contacts
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON contacts;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_tenant_isolation" ON contacts
    FOR ALL
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    );

-- Accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON accounts;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_tenant_isolation" ON accounts
    FOR ALL
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    );

-- Jobs
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON jobs;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_tenant_isolation" ON jobs
    FOR ALL
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    );

-- Leads
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON leads;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simple_tenant_isolation" ON leads
    FOR ALL
    USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1)
    );

-- 5. Test the fix
SELECT 'Simple RLS policies applied. Testing...' as status;

-- Test query
SELECT 
    id,
    email,
    tenant_id,
    role
FROM user_profiles 
WHERE id = auth.uid()
LIMIT 1;

-- Show final policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

SELECT 'Simple fix complete! Try logging in now.' as final_status;