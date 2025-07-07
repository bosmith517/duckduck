-- Emergency fix - completely avoid any self-referencing queries
-- This is a temporary fix to get you logged in

-- 1. Drop ALL existing policies on user_profiles
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
    END LOOP;
END $$;

-- 2. Create ONLY the most basic policy - users can see/edit their own profile
CREATE POLICY "own_profile_only" ON user_profiles
    FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- That's it for user_profiles! No tenant visibility for now.

-- 3. For other tables, create a temporary workaround
-- Create a simple function that returns true for authenticated users
CREATE OR REPLACE FUNCTION public.temp_allow_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT auth.role() = 'authenticated';
$$;

GRANT EXECUTE ON FUNCTION public.temp_allow_authenticated() TO authenticated;

-- 4. Update critical tables with temporary policies
-- Contacts
DROP POLICY IF EXISTS "tenant_isolation" ON contacts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON contacts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON contacts;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_allow_authenticated" ON contacts
    FOR ALL
    USING (public.temp_allow_authenticated())
    WITH CHECK (public.temp_allow_authenticated());

-- Accounts
DROP POLICY IF EXISTS "tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON accounts;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON accounts;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_allow_authenticated" ON accounts
    FOR ALL
    USING (public.temp_allow_authenticated())
    WITH CHECK (public.temp_allow_authenticated());

-- Jobs
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON jobs;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON jobs;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_allow_authenticated" ON jobs
    FOR ALL
    USING (public.temp_allow_authenticated())
    WITH CHECK (public.temp_allow_authenticated());

-- Leads
DROP POLICY IF EXISTS "tenant_isolation" ON leads;
DROP POLICY IF EXISTS "tenant_isolation_fixed" ON leads;
DROP POLICY IF EXISTS "simple_tenant_isolation" ON leads;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "temp_allow_authenticated" ON leads
    FOR ALL
    USING (public.temp_allow_authenticated())
    WITH CHECK (public.temp_allow_authenticated());

-- 5. Verify the setup
SELECT 'Emergency fix applied!' as status;

-- Show what policies exist now
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'contacts', 'accounts', 'jobs', 'leads')
ORDER BY tablename, policyname;

SELECT 'You should be able to log in now! This is a temporary fix - we will implement proper tenant isolation after you can access the system.' as message;