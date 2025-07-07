-- Emergency fix for user_profiles RLS issues
-- This will temporarily disable RLS to allow login, then rebuild it properly

-- 1. Disable RLS temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies to ensure clean slate
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create a single, simple policy for authenticated users
CREATE POLICY "authenticated_users_full_access" 
ON user_profiles 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Create service role policy
CREATE POLICY "service_role_bypass" 
ON user_profiles 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- This gives all authenticated users full access to user_profiles temporarily
-- We'll add proper restrictions once login is working