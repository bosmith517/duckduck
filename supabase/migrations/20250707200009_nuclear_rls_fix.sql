-- Nuclear option: Complete RLS reset for user_profiles
-- This will temporarily disable all security to fix the recursion issue

-- 1. Disable RLS completely
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies (using dynamic SQL to ensure we get everything)
DO $$
DECLARE
    pol RECORD;
    policy_count INTEGER := 0;
BEGIN
    -- Drop all policies
    FOR pol IN 
        SELECT policyname, tablename, schemaname
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
            pol.policyname, pol.schemaname, pol.tablename);
        policy_count := policy_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Dropped % policies', policy_count;
END $$;

-- 3. Drop ALL triggers that might be causing issues
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'user_profiles'::regclass
        AND tgname NOT LIKE 'RI_%'  -- Don't drop foreign key triggers
        AND tgname NOT LIKE '%_update_%_updated_at%'  -- Keep updated_at triggers
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON user_profiles', trig.tgname);
    END LOOP;
END $$;

-- 4. Drop ALL functions that reference user_profiles in RLS context
DROP FUNCTION IF EXISTS get_user_tenant_and_role() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS get_auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS validate_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS ensure_user_profile_tenant_id() CASCADE;

-- 5. Temporarily allow all authenticated users to access user_profiles
-- This is just to get the system working again
CREATE OR REPLACE FUNCTION temp_allow_all_access()
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT true;
$$;

-- 6. Re-enable RLS with a single, simple policy
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create a single policy that allows all authenticated users
-- This is temporary just to get login working
CREATE POLICY "temp_allow_authenticated" ON user_profiles
    FOR ALL
    TO authenticated
    USING (temp_allow_all_access())
    WITH CHECK (temp_allow_all_access());

-- 8. Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION temp_allow_all_access() TO authenticated;

-- 9. Create a status check function
CREATE OR REPLACE FUNCTION check_rls_status()
RETURNS TABLE (
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count BIGINT
)
LANGUAGE sql
AS $$
    SELECT 
        'user_profiles'::TEXT as table_name,
        relrowsecurity as rls_enabled,
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_profiles') as policy_count
    FROM pg_class
    WHERE relname = 'user_profiles';
$$;

GRANT EXECUTE ON FUNCTION check_rls_status() TO authenticated;

-- 10. Add a comment explaining this is temporary
COMMENT ON POLICY "temp_allow_authenticated" ON user_profiles IS 
'TEMPORARY: Allows all authenticated users to access user_profiles to fix login issues. Replace with proper policies once system is stable.';

-- 11. Log what we've done
DO $$
BEGIN
    RAISE NOTICE 'RLS has been reset to a minimal state. Login should now work.';
    RAISE NOTICE 'You must implement proper tenant-based policies after confirming the system works.';
END $$;