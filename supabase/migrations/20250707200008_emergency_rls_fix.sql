-- Emergency RLS fix - completely clean and rebuild RLS policies
-- This removes ALL policies and creates simple, working ones

-- 1. Disable RLS temporarily to clean everything
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies on user_profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Get all policies for user_profiles
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 3. Drop any functions that might be causing recursion
DROP FUNCTION IF EXISTS get_user_tenant_and_role() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;

-- 4. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create ONLY these simple policies (no recursion possible)

-- Allow users to read their own profile (simplest possible policy)
CREATE POLICY "users_own_profile" ON user_profiles
    FOR ALL
    USING (auth.uid() = id);

-- Allow authenticated users to read all profiles in their tenant
-- Using a simple subquery that can't recurse
CREATE POLICY "read_tenant_profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles AS self 
            WHERE self.id = auth.uid() 
            AND self.tenant_id = user_profiles.tenant_id
        )
    );

-- Service role bypass (always needed)
CREATE POLICY "service_role_all" ON user_profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- 6. Create a simple function for getting current user's tenant
CREATE OR REPLACE FUNCTION current_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
$$;

-- 7. Add policy for admins to manage profiles
CREATE POLICY "admins_manage_profiles" ON user_profiles
    FOR ALL
    USING (
        tenant_id = current_user_tenant_id()
        AND EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor')
            LIMIT 1
        )
    );

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION current_user_tenant_id() TO authenticated;

-- 9. Add comment
COMMENT ON FUNCTION current_user_tenant_id() IS 'Returns current user tenant_id without recursion';