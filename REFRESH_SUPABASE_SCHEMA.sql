-- REFRESH SUPABASE SCHEMA CACHE
-- Run this to force Supabase to recognize the new columns

-- 1. Refresh the schema cache by calling the PostgREST schema refresh
NOTIFY pgrst, 'reload schema';

-- 2. Verify all required columns exist in leads table
SELECT 
  'LEADS TABLE VERIFICATION' as status;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE 
    WHEN column_name IN ('caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency', 'status', 'tenant_id') 
    THEN '✅ REQUIRED'
    ELSE '📋 OPTIONAL'
  END as importance
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leads'
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'tenant_id', 'caller_name', 'phone_number', 'lead_source', 'initial_request', 'status', 'urgency') 
    THEN 1 
    ELSE 2 
  END,
  column_name;

-- 3. Verify contacts table columns
SELECT 
  'CONTACTS TABLE VERIFICATION' as status;

SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name IN ('notes', 'is_primary', 'mobile', 'title', 'first_name', 'last_name') 
    THEN '✅ FRONTEND NEEDS'
    ELSE '📋 EXISTING'
  END as importance
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contacts'
AND column_name IN ('id', 'tenant_id', 'account_id', 'name', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'title', 'notes', 'is_primary', 'created_at', 'updated_at')
ORDER BY 
  CASE 
    WHEN column_name IN ('id', 'tenant_id', 'account_id', 'first_name', 'last_name', 'email', 'phone') 
    THEN 1 
    ELSE 2 
  END,
  column_name;

-- 4. Test a simple leads query to see what columns Supabase recognizes
DO $$
DECLARE
  rec RECORD;
  col_count INTEGER;
BEGIN
  -- Count columns that Supabase sees
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'leads' 
  AND table_schema = 'public';
  
  RAISE NOTICE 'Supabase sees % columns in leads table', col_count;
  
  -- Try to select from leads to see if it works
  BEGIN
    SELECT COUNT(*) FROM leads;
    RAISE NOTICE '✅ Can successfully query leads table';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ Error querying leads table: %', SQLERRM;
  END;
END $$;

-- 5. Check if we can insert a test record (we'll roll it back)
DO $$
DECLARE
  test_tenant_id UUID;
BEGIN
  -- Get a valid tenant_id
  SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
  
  IF test_tenant_id IS NOT NULL THEN
    BEGIN
      -- Test insert (in a subtransaction that we'll roll back)
      SAVEPOINT test_insert;
      
      INSERT INTO leads (
        tenant_id,
        caller_name,
        phone_number,
        lead_source,
        initial_request,
        status,
        urgency
      ) VALUES (
        test_tenant_id,
        'Test Caller',
        '555-0123',
        'Test Source',
        'Test request',
        'new',
        'medium'
      );
      
      RAISE NOTICE '✅ Test insert to leads table SUCCESSFUL';
      
      -- Roll back the test insert
      ROLLBACK TO test_insert;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ Test insert FAILED: %', SQLERRM;
        ROLLBACK TO test_insert;
    END;
  ELSE
    RAISE NOTICE '⚠️  No tenant found for testing';
  END IF;
END $$;

-- 6. Show what the NewInquiryModal is trying to insert
SELECT 
  'NEWINQUIRYMODAL EXPECTS THESE COLUMNS' as info;

SELECT 
  column_name,
  CASE 
    WHEN column_name IN (
      'tenant_id', 'caller_name', 'phone_number', 'email', 
      'lead_source', 'initial_request', 'status', 'urgency', 
      'estimated_value', 'follow_up_date', 'notes', 
      'created_at', 'updated_at'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leads'
AND column_name IN (
  'tenant_id', 'caller_name', 'phone_number', 'email', 
  'lead_source', 'initial_request', 'status', 'urgency', 
  'estimated_value', 'follow_up_date', 'notes', 
  'created_at', 'updated_at'
)
ORDER BY column_name;

-- 7. Final status
DO $$
DECLARE
  missing_cols INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_cols
  FROM (
    SELECT 'tenant_id' as col
    UNION SELECT 'caller_name'
    UNION SELECT 'phone_number' 
    UNION SELECT 'lead_source'
    UNION SELECT 'initial_request'
    UNION SELECT 'status'
    UNION SELECT 'urgency'
  ) expected
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' 
    AND column_name = expected.col 
    AND table_schema = 'public'
  );
  
  IF missing_cols = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '=== ✅ SCHEMA IS CORRECT ===';
    RAISE NOTICE 'All required columns exist in leads table';
    RAISE NOTICE 'The error might be a Supabase cache issue';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTIONS:';
    RAISE NOTICE '1. Wait 5-10 minutes for cache to refresh';
    RAISE NOTICE '2. Restart your local development server';
    RAISE NOTICE '3. Try the query again';
    RAISE NOTICE '4. Check if you have multiple Supabase projects';
  ELSE
    RAISE NOTICE '❌ Still missing % required columns', missing_cols;
  END IF;
END $$;