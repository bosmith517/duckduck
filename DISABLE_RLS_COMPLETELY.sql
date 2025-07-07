-- NUCLEAR OPTION: Completely disable RLS to allow login
-- This is temporary just to get you back into the system

-- 1. Disable RLS on ALL tables
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_logs DISABLE ROW LEVEL SECURITY;

-- 2. Verify RLS is disabled
SELECT 
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'contacts', 'accounts', 'jobs', 'leads')
ORDER BY tablename;

-- 3. Test query
SELECT 'RLS is now DISABLED. You should be able to log in!' as message;

-- 4. Grant permissions to ensure access
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON contacts TO authenticated;
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON jobs TO authenticated;
GRANT ALL ON leads TO authenticated;