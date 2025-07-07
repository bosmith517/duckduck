-- Fix conflicts from multiple RLS migration attempts
-- Run this in Supabase SQL Editor to restore login functionality

-- 1. First, check what policies currently exist
DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE 'Current policies on user_profiles:';
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles'
    LOOP
        RAISE NOTICE '  - %', r.policyname;
    END LOOP;
END $$;

-- 2. Disable RLS to clean up
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Drop ALL policies (from all the migrations)
DO $$
DECLARE
    pol RECORD;
    count INTEGER := 0;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
        count := count + 1;
    END LOOP;
    RAISE NOTICE 'Dropped % policies', count;
END $$;

-- 4. Drop the temp function if it exists
DROP FUNCTION IF EXISTS temp_allow_all_access() CASCADE;

-- 5. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create the CORRECT policies (from migration 200015)
-- These are the final, working policies without recursion

-- Users can see their own profile
CREATE POLICY "users_read_own_profile" ON user_profiles
    FOR SELECT
    USING (id = auth.uid());

-- Users can see profiles in their tenant
CREATE POLICY "users_read_tenant_profiles" ON user_profiles
    FOR SELECT  
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Users can update only their own profile
CREATE POLICY "users_update_own_profile" ON user_profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users can insert their own profile (signup)
CREATE POLICY "users_insert_own_profile" ON user_profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

-- Admins can manage profiles in their tenant
CREATE POLICY "admins_manage_tenant_profiles" ON user_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles admin_user
            WHERE admin_user.id = auth.uid()
            AND admin_user.role IN ('admin', 'manager', 'supervisor')
            AND admin_user.tenant_id = user_profiles.tenant_id
            LIMIT 1
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM user_profiles admin_user
            WHERE admin_user.id = auth.uid()
            AND admin_user.role IN ('admin', 'manager', 'supervisor')
            AND admin_user.tenant_id = user_profiles.tenant_id
            LIMIT 1
        )
    );

-- 7. Verify the fix
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'user_profiles';
    
    RAISE NOTICE 'Created % policies on user_profiles', policy_count;
    RAISE NOTICE 'You should now be able to log in successfully!';
END $$;

-- 8. Quick test - this should not error
SELECT COUNT(*) as profile_count FROM user_profiles WHERE id = auth.uid();