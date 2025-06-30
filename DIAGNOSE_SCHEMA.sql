-- DIAGNOSE CURRENT SCHEMA
-- Run this first to see what tables and columns actually exist

-- 1. Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('leads', 'jobs', 'contacts', 'call_logs') THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('leads', 'jobs', 'contacts', 'call_logs', 'accounts', 'tenants', 'user_profiles')
ORDER BY table_name;

-- 2. Check leads table columns (if exists)
SELECT 
  '--- LEADS TABLE COLUMNS ---' as info;
  
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leads'
ORDER BY ordinal_position;

-- 3. Check jobs table columns (if exists)
SELECT 
  '--- JOBS TABLE COLUMNS ---' as info;
  
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'jobs'
ORDER BY ordinal_position;

-- 4. Check contacts table columns (if exists)
SELECT 
  '--- CONTACTS TABLE COLUMNS ---' as info;
  
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contacts'
ORDER BY ordinal_position;

-- 5. Check foreign key constraints
SELECT 
  '--- FOREIGN KEY CONSTRAINTS ---' as info;
  
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND tc.table_name IN ('leads', 'jobs', 'contacts', 'call_logs')
ORDER BY tc.table_name, tc.constraint_name;

-- 6. Check what's causing the error
DO $$
DECLARE
  leads_exists BOOLEAN;
  jobs_exists BOOLEAN;
  lead_id_in_jobs BOOLEAN;
  lead_id_in_call_logs BOOLEAN;
BEGIN
  -- Check if tables exist
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') INTO leads_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs' AND table_schema = 'public') INTO jobs_exists;
  
  -- Check if lead_id columns exist
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'lead_id' AND table_schema = 'public') INTO lead_id_in_jobs;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'call_logs' AND column_name = 'lead_id' AND table_schema = 'public') INTO lead_id_in_call_logs;
  
  RAISE NOTICE '=== DIAGNOSTIC RESULTS ===';
  RAISE NOTICE 'Leads table exists: %', leads_exists;
  RAISE NOTICE 'Jobs table exists: %', jobs_exists;
  RAISE NOTICE 'Jobs table has lead_id column: %', lead_id_in_jobs;
  RAISE NOTICE 'Call_logs table has lead_id column: %', lead_id_in_call_logs;
  
  IF NOT leads_exists THEN
    RAISE NOTICE '⚠️  PROBLEM: leads table does not exist!';
  END IF;
  
  IF jobs_exists AND NOT lead_id_in_jobs THEN
    RAISE NOTICE '⚠️  PROBLEM: jobs table exists but does not have lead_id column!';
  END IF;
END $$;