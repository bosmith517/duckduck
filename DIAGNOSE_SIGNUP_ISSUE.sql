-- Comprehensive Diagnosis of Signup Issues
-- Run this in Supabase SQL Editor to see what's wrong

-- ========================================
-- STEP 1: CHECK IF TABLES EXIST
-- ========================================

SELECT 'CHECKING TABLE EXISTENCE' as step;

SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenants', 'user_profiles', 'signalwire_phone_numbers', 'sip_configurations')
ORDER BY table_name;

-- ========================================
-- STEP 2: CHECK TABLE STRUCTURES
-- ========================================

SELECT 'CHECKING TENANTS TABLE STRUCTURE' as step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tenants'
ORDER BY ordinal_position;

SELECT 'CHECKING USER_PROFILES TABLE STRUCTURE' as step;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ========================================
-- STEP 3: CHECK RLS STATUS
-- ========================================

SELECT 'CHECKING RLS STATUS' as step;

SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'user_profiles')
ORDER BY tablename;

-- ========================================
-- STEP 4: CHECK CURRENT POLICIES
-- ========================================

SELECT 'CHECKING CURRENT RLS POLICIES' as step;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'user_profiles')
ORDER BY tablename, policyname;

-- ========================================
-- STEP 5: CHECK CURRENT DATA
-- ========================================

SELECT 'CHECKING CURRENT TENANTS DATA' as step;

SELECT COUNT(*) as tenant_count FROM tenants;

SELECT 'CHECKING CURRENT USER_PROFILES DATA' as step;

SELECT COUNT(*) as user_profile_count FROM user_profiles;

-- ========================================
-- STEP 6: CHECK AUTH USERS
-- ========================================

SELECT 'CHECKING AUTH USERS' as step;

SELECT 
    id,
    email,
    created_at,
    email_confirmed_at
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- ========================================
-- STEP 7: TEST MANUAL INSERT (if tables exist)
-- ========================================

-- Test if we can manually insert a tenant (this will show RLS issues)
SELECT 'TESTING MANUAL TENANT INSERT' as step;

DO $$ 
BEGIN
    -- Try to insert a test tenant
    BEGIN
        INSERT INTO tenants (name, subdomain, plan) 
        VALUES ('Test Tenant Manual', 'testmanual', 'basic');
        RAISE NOTICE 'Manual tenant insert: SUCCESS';
    EXCEPTION 
        WHEN OTHERS THEN
            RAISE NOTICE 'Manual tenant insert FAILED: %', SQLERRM;
    END;
END $$;

-- Show results
SELECT 'FINAL RESULTS' as step;
SELECT * FROM tenants WHERE name LIKE 'Test Tenant%';

-- ========================================
-- STEP 8: PROVIDE NEXT STEPS
-- ========================================

SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') 
        THEN 'ISSUE: Tables do not exist - Run SAFE_SCHEMA_DEPLOY.sql first'
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenants' AND rowsecurity = true)
        THEN 'ISSUE: RLS is enabled but may be blocking inserts - Run FIX_RLS_POLICIES.sql'
        ELSE 'Tables exist and RLS looks OK - Check application logs'
    END as diagnosis;