-- VERIFY SCHEMA ISSUES
-- Run this to see exactly what's wrong with your database schema

-- 1. Check if calendar_events table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events')
        THEN '✅ calendar_events table EXISTS'
        ELSE '❌ calendar_events table MISSING - Site visits will fail!'
    END as calendar_events_status;

-- 2. Check leads table columns
SELECT 
    'LEADS TABLE COLUMNS:' as table_info,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- 3. Check if critical lead columns exist
SELECT 
    'MISSING LEAD COLUMNS:' as check_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'caller_type') 
         THEN '✅ caller_type' ELSE '❌ caller_type MISSING' END as caller_type,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_contact_id') 
         THEN '✅ converted_contact_id' ELSE '❌ converted_contact_id MISSING' END as converted_contact_id,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_account_id') 
         THEN '✅ converted_account_id' ELSE '❌ converted_account_id MISSING' END as converted_account_id;

-- 4. Check contacts table columns
SELECT 
    'CONTACTS TABLE:' as table_info,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address') 
         THEN '✅ Has "address" column' 
         WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address_line1')
         THEN '⚠️ Has "address_line1" (need to rename to "address")' 
         ELSE '❌ No address field!' END as address_field,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip') 
         THEN '✅ Has "zip" column' 
         WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip_code')
         THEN '⚠️ Has "zip_code" (need to rename to "zip")' 
         ELSE '❌ No zip field!' END as zip_field;

-- 5. Check accounts table columns
SELECT 
    'ACCOUNTS TABLE:' as table_info,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_type') 
         THEN '✅ Has "account_type" column' 
         WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'type')
         THEN '⚠️ Has "type" (need to rename to "account_type")' 
         ELSE '❌ No type field!' END as type_field,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'billing_address') 
         THEN '✅ Has billing_address' 
         ELSE '❌ billing_address MISSING' END as billing_address;

-- 6. Test if we can insert a lead
DO $$
DECLARE
    test_tenant_id uuid;
BEGIN
    -- Get a tenant_id for testing
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    -- Try to insert a test lead
    BEGIN
        INSERT INTO leads (
            tenant_id, 
            name, 
            email, 
            phone, 
            status,
            caller_type
        ) VALUES (
            test_tenant_id,
            'TEST LEAD - DELETE ME',
            'test@example.com',
            '555-0123',
            'new',
            'individual'
        );
        
        -- If successful, delete it
        DELETE FROM leads WHERE name = 'TEST LEAD - DELETE ME';
        RAISE NOTICE '✅ Lead insert test PASSED';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Lead insert test FAILED: %', SQLERRM;
    END;
END $$;

-- 7. Show the actual solution needed
SELECT 
    E'\n\n' || 
    'TO FIX ALL ISSUES, RUN THIS COMMAND:\n' ||
    'psql -f FIX_CRITICAL_SCHEMA_ISSUES.sql\n' ||
    'or paste the contents of FIX_CRITICAL_SCHEMA_ISSUES.sql into Supabase SQL Editor'
    as next_steps;