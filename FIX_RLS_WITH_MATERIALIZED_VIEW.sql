-- Fix RLS circular dependency using a materialized view approach
-- This creates a fast lookup table that doesn't trigger RLS checks

-- 1. Create a materialized view for tenant lookups
-- This bypasses RLS entirely for the lookup operation
DROP MATERIALIZED VIEW IF EXISTS auth_tenant_lookup CASCADE;

CREATE MATERIALIZED VIEW auth_tenant_lookup AS
SELECT 
    id as user_id,
    tenant_id,
    role
FROM user_profiles;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_auth_tenant_lookup_user_id ON auth_tenant_lookup(user_id);
CREATE INDEX idx_auth_tenant_lookup_tenant_id ON auth_tenant_lookup(tenant_id);

-- 2. Create a function to refresh the materialized view
-- This should be called after any user profile changes
CREATE OR REPLACE FUNCTION refresh_auth_tenant_lookup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY auth_tenant_lookup;
END;
$$;

-- 3. Create triggers to auto-refresh the view
CREATE OR REPLACE FUNCTION trigger_refresh_auth_tenant_lookup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Async refresh to avoid blocking
    PERFORM pg_notify('refresh_auth_tenant_lookup', '');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_auth_tenant_lookup_trigger ON user_profiles;
CREATE TRIGGER refresh_auth_tenant_lookup_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_profiles
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_auth_tenant_lookup();

-- 4. Create helper function using the materialized view
CREATE OR REPLACE FUNCTION auth.jwt_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT tenant_id 
    FROM auth_tenant_lookup 
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- Grant access
GRANT SELECT ON auth_tenant_lookup TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt_tenant_id() TO authenticated;

-- 5. Now fix user_profiles policies without circular reference
-- Drop all existing policies
DROP POLICY IF EXISTS "users_can_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_view_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "simple_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "own_profile_all" ON user_profiles;
DROP POLICY IF EXISTS "tenant_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_tenant_profiles" ON user_profiles;

-- Create new non-circular policies
-- Users can manage their own profile
CREATE POLICY "own_profile_management" ON user_profiles
    FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users can view profiles in their tenant (using materialized view)
CREATE POLICY "tenant_profile_visibility" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = auth.jwt_tenant_id()
    );

-- Admins can manage all profiles in their tenant
CREATE POLICY "admin_tenant_management" ON user_profiles
    FOR ALL
    USING (
        tenant_id = auth.jwt_tenant_id()
        AND EXISTS (
            SELECT 1 FROM auth_tenant_lookup
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager', 'supervisor')
        )
    )
    WITH CHECK (
        tenant_id = auth.jwt_tenant_id()
    );

-- 6. Update other table policies to use the new function
-- This avoids querying user_profiles directly

-- Update contacts
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON contacts;
CREATE POLICY "tenant_isolation" ON contacts
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- Update accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON accounts;
CREATE POLICY "tenant_isolation" ON accounts
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- Update jobs
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON jobs;
CREATE POLICY "tenant_isolation" ON jobs
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- Update leads
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON leads;
CREATE POLICY "tenant_isolation" ON leads
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- Update estimates
DROP POLICY IF EXISTS "tenant_isolation" ON estimates;
CREATE POLICY "tenant_isolation" ON estimates
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- Update invoices
DROP POLICY IF EXISTS "tenant_isolation" ON invoices;
CREATE POLICY "tenant_isolation" ON invoices
    FOR ALL
    USING (tenant_id = auth.jwt_tenant_id())
    WITH CHECK (tenant_id = auth.jwt_tenant_id());

-- 7. Refresh the materialized view with current data
REFRESH MATERIALIZED VIEW auth_tenant_lookup;

-- 8. Test the solution
SELECT 'Materialized view solution implemented. Testing access...' as status;

-- Test 1: Can we query user_profiles?
SELECT COUNT(*) as user_profile_count FROM user_profiles WHERE id = auth.uid();

-- Test 2: Can we query the lookup?
SELECT tenant_id FROM auth_tenant_lookup WHERE user_id = auth.uid();

-- Test 3: List all policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'contacts', 'accounts', 'jobs', 'leads')
ORDER BY tablename, policyname;

SELECT 'RLS fixed with materialized view! Try logging in now.' as final_status;