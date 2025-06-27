-- Temporarily disable RLS to test if that's the issue
-- Run this to allow inserts to work during signup

-- ========================================
-- STEP 1: DISABLE RLS ON ALL TABLES
-- ========================================

ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: VERIFY RLS IS DISABLED
-- ========================================

SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'user_profiles', 'signalwire_phone_numbers', 'sip_configurations')
ORDER BY tablename;

-- ========================================
-- STEP 3: TEST MANUAL INSERT
-- ========================================

-- Try to manually insert a test tenant to verify it works
INSERT INTO tenants (name, subdomain, plan, is_active) 
VALUES ('Test RLS Disabled', 'testrlsdisabled', 'basic', true)
RETURNING *;

-- ========================================
-- STEP 4: CHECK IF INSERT WORKED
-- ========================================

SELECT * FROM tenants WHERE name = 'Test RLS Disabled';

-- Show message
SELECT 'RLS DISABLED - Try signup again now!' as message;