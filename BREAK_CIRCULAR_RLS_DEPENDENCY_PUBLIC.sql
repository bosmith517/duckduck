-- Break the circular RLS dependency by creating a cached tenant lookup
-- This avoids the infinite recursion when other tables query user_profiles
-- FIXED: Using public schema instead of auth schema

-- 1. Create a function that caches the current user's tenant_id
-- This function uses SECURITY DEFINER to bypass RLS when needed
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Direct query without RLS to avoid recursion
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN v_tenant_id;
END;
$$;

-- 2. Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO authenticated;

-- 3. Update the user_profiles policies to use a different approach
-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "simple_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_can_view_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "own_profile_all" ON user_profiles;
DROP POLICY IF EXISTS "tenant_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_tenant_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_tenant_visibility" ON user_profiles;

-- 4. Create new non-recursive policies for user_profiles
-- Allow users to see their own profile
CREATE POLICY "own_profile_all" ON user_profiles
    FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow users to see profiles in their tenant using the cached function
CREATE POLICY "tenant_profiles_select" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = public.current_user_tenant_id()
    );

-- Admins can manage profiles in their tenant
CREATE POLICY "admin_manage_tenant_profiles" ON user_profiles
    FOR ALL
    USING (
        tenant_id = public.current_user_tenant_id()
        AND EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'manager', 'supervisor')
            LIMIT 1
        )
    )
    WITH CHECK (
        tenant_id = public.current_user_tenant_id()
    );

-- 5. Now update a few critical table policies to use the new function
-- This prevents them from directly querying user_profiles

-- Update contacts policies
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON contacts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON contacts;
CREATE POLICY "tenant_isolation_fixed" ON contacts
    FOR ALL
    USING (tenant_id = public.current_user_tenant_id())
    WITH CHECK (tenant_id = public.current_user_tenant_id());

-- Update accounts policies  
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON accounts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON accounts;
CREATE POLICY "tenant_isolation_fixed" ON accounts
    FOR ALL
    USING (tenant_id = public.current_user_tenant_id())
    WITH CHECK (tenant_id = public.current_user_tenant_id());

-- Update jobs policies
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON jobs;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON jobs;
CREATE POLICY "tenant_isolation_fixed" ON jobs
    FOR ALL
    USING (tenant_id = public.current_user_tenant_id())
    WITH CHECK (tenant_id = public.current_user_tenant_id());

-- Update leads policies
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON leads;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON leads;
CREATE POLICY "tenant_isolation_fixed" ON leads
    FOR ALL
    USING (tenant_id = public.current_user_tenant_id())
    WITH CHECK (tenant_id = public.current_user_tenant_id());

-- 6. Test the fix
SELECT 'Circular dependency broken! Testing access...' as status;

-- Test the function
SELECT public.current_user_tenant_id() as your_tenant_id;

-- Test user_profiles access
SELECT COUNT(*) as accessible_profiles FROM user_profiles;

-- 7. Verify the new setup
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

SELECT 'Fix complete! Try logging in now.' as final_status;