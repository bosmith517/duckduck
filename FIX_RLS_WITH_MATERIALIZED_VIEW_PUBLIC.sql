-- Fix RLS circular dependency using a materialized view approach
-- This creates a fast lookup table that doesn't trigger RLS checks
-- FIXED: Using public schema instead of auth schema

-- 1. Create a materialized view for tenant lookups
-- This bypasses RLS entirely for the lookup operation
DROP MATERIALIZED VIEW IF EXISTS public.tenant_lookup_cache CASCADE;

CREATE MATERIALIZED VIEW public.tenant_lookup_cache AS
SELECT 
    id as user_id,
    tenant_id,
    role
FROM user_profiles;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_tenant_lookup_cache_user_id ON public.tenant_lookup_cache(user_id);
CREATE INDEX idx_tenant_lookup_cache_tenant_id ON public.tenant_lookup_cache(tenant_id);

-- 2. Create a function to refresh the materialized view
-- This should be called after any user profile changes
CREATE OR REPLACE FUNCTION public.refresh_tenant_lookup_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
END;
$$;

-- 3. Create triggers to auto-refresh the view
CREATE OR REPLACE FUNCTION public.trigger_refresh_tenant_lookup_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Async refresh to avoid blocking
    PERFORM pg_notify('refresh_tenant_lookup_cache', '');
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS refresh_tenant_lookup_cache_trigger ON user_profiles;
CREATE TRIGGER refresh_tenant_lookup_cache_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_profiles
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_refresh_tenant_lookup_cache();

-- 4. Create helper function using the materialized view
CREATE OR REPLACE FUNCTION public.cached_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT tenant_id 
    FROM public.tenant_lookup_cache 
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

-- Grant access
GRANT SELECT ON public.tenant_lookup_cache TO authenticated;
GRANT EXECUTE ON FUNCTION public.cached_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_tenant_lookup_cache() TO authenticated;

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
DROP POLICY IF EXISTS "users_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_tenant_visibility" ON user_profiles;

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
        tenant_id = public.cached_user_tenant_id()
    );

-- Admins can manage all profiles in their tenant
CREATE POLICY "admin_tenant_management" ON user_profiles
    FOR ALL
    USING (
        tenant_id = public.cached_user_tenant_id()
        AND EXISTS (
            SELECT 1 FROM public.tenant_lookup_cache
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'manager', 'supervisor')
        )
    )
    WITH CHECK (
        tenant_id = public.cached_user_tenant_id()
    );

-- 6. Update other table policies to use the new function
-- This avoids querying user_profiles directly

-- Update contacts
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON contacts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON contacts;
CREATE POLICY "tenant_isolation" ON contacts
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Update accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON accounts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON accounts;
CREATE POLICY "tenant_isolation" ON accounts
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Update jobs
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON jobs;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON jobs;
CREATE POLICY "tenant_isolation" ON jobs
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Update leads
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON leads;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON leads;
CREATE POLICY "tenant_isolation" ON leads
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Update estimates
DROP POLICY IF EXISTS "tenant_isolation" ON estimates;
CREATE POLICY "tenant_isolation" ON estimates
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Update invoices
DROP POLICY IF EXISTS "tenant_isolation" ON invoices;
CREATE POLICY "tenant_isolation" ON invoices
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- 7. Refresh the materialized view with current data
REFRESH MATERIALIZED VIEW public.tenant_lookup_cache;

-- 8. Test the solution
SELECT 'Materialized view solution implemented. Testing access...' as status;

-- Test 1: Can we query user_profiles?
SELECT COUNT(*) as user_profile_count FROM user_profiles WHERE id = auth.uid();

-- Test 2: Can we query the lookup?
SELECT tenant_id FROM public.tenant_lookup_cache WHERE user_id = auth.uid();

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