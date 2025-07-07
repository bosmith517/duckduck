-- Add the MISSING policies to user_profiles table
-- The diagnostic showed NO policies on user_profiles, which is why queries fail

-- 1. First check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- 2. Enable RLS if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop any existing policies first (there shouldn't be any based on diagnostic)
DROP POLICY IF EXISTS "users_can_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_can_view_tenant_profiles" ON user_profiles;

-- 4. Add the basic policies that are missing
-- These must be simple and cannot reference other tables

-- Allow users to see their own profile
CREATE POLICY "users_can_view_own_profile" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Allow users to update their own profile
CREATE POLICY "users_can_update_own_profile" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow users to insert their own profile during signup
CREATE POLICY "users_can_insert_own_profile" ON user_profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- Allow users to see other profiles in their tenant
-- This uses a self-join which should not cause recursion
CREATE POLICY "users_can_view_tenant_profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles AS my_profile 
            WHERE my_profile.id = auth.uid() 
            AND my_profile.tenant_id = user_profiles.tenant_id
        )
    );

-- 5. Verify policies were created
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

-- 6. Test the fix
SELECT 'Policies added! Try logging in now.' as status;