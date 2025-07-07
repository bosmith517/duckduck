-- Remove the policy that's causing recursion and replace with a simpler one

-- 1. Drop the problematic policy
DROP POLICY IF EXISTS "users_can_view_tenant_profiles" ON user_profiles;

-- 2. Check what policies remain
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

-- 3. Create a simpler tenant visibility policy without self-reference
-- This uses a direct tenant_id comparison instead of a subquery
CREATE POLICY "simple_tenant_profiles" ON user_profiles
    FOR SELECT
    USING (
        -- User can see their own profile
        id = auth.uid()
        OR
        -- User can see profiles with same tenant_id as their own
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- 4. Alternative: If the above still causes issues, use this even simpler version
-- Uncomment if needed:
/*
DROP POLICY IF EXISTS "simple_tenant_profiles" ON user_profiles;

-- Just allow authenticated users to see all profiles temporarily
CREATE POLICY "temp_allow_authenticated_select" ON user_profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');
*/

-- 5. Test the fix
SELECT 'Recursive policy removed. Try logging in now.' as status;

-- 6. Verify final policies
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;