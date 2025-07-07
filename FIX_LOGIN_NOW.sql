-- IMMEDIATE FIX FOR LOGIN - Run this directly in Supabase SQL Editor
-- This will fix the infinite recursion immediately

-- 1. Disable RLS temporarily
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies
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
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create ONLY these simple, non-recursive policies
CREATE POLICY "allow_user_read_own" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "allow_user_update_own" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "allow_user_read_same_tenant" ON user_profiles
    FOR SELECT
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- 5. Test it works
SELECT 'Policies fixed! You should be able to log in now.' as status;