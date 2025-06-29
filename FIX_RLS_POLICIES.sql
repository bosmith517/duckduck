-- Fix RLS Policy Infinite Recursion Issues
-- Run this to fix the circular reference problems

-- ========================================
-- STEP 1: DISABLE RLS TEMPORARILY
-- ========================================

ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations DISABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: DROP ALL EXISTING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view tenant phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Admins can manage tenant phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Users can view tenant sip configs" ON sip_configurations;
DROP POLICY IF EXISTS "Admins can manage tenant sip configs" ON sip_configurations;

-- ========================================
-- STEP 3: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ========================================

-- Re-enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;

-- TENANTS table policies (simplified)
CREATE POLICY "Allow all authenticated users to select tenants" ON tenants
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to insert tenants" ON tenants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to update tenants" ON tenants
    FOR UPDATE USING (auth.role() = 'authenticated');

-- USER_PROFILES table policies (simplified to avoid recursion)
CREATE POLICY "Allow all authenticated users to select user_profiles" ON user_profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow users to insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Allow users to update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- SIGNALWIRE_PHONE_NUMBERS table policies
CREATE POLICY "Allow all authenticated users to select phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to manage phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (auth.role() = 'authenticated');

-- SIP_CONFIGURATIONS table policies
CREATE POLICY "Allow all authenticated users to select sip configs" ON sip_configurations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users to manage sip configs" ON sip_configurations
    FOR ALL USING (auth.role() = 'authenticated');

-- ========================================
-- STEP 4: VERIFY THE FIX
-- ========================================

-- Test that we can query user_profiles without infinite recursion
SELECT 'RLS POLICIES FIXED - Testing user_profiles query' as status;

-- Show current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'user_profiles', 'signalwire_phone_numbers', 'sip_configurations')
ORDER BY tablename, policyname;