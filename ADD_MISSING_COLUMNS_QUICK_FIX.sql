-- QUICK FIX: Add missing columns to existing tables

-- 1. Add missing columns to jobs table if they don't exist
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- 2. Add missing column to leads table if it exists but doesn't have converted_to_job_id
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'leads' 
    AND table_schema = 'public'
  ) THEN
    -- Add the missing column if it doesn't exist
    ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS converted_to_job_id UUID REFERENCES jobs(id);
  END IF;
END $$;

-- 3. Add missing columns to contacts table (from previous error)
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mobile character varying(20),
ADD COLUMN IF NOT EXISTS title character varying(100);

-- 4. Verify all columns exist
SELECT 
  'jobs' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND table_schema = 'public'
AND column_name IN ('assigned_technician_id', 'lead_id')

UNION ALL

SELECT 
  'leads' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND table_schema = 'public'
AND column_name = 'converted_to_job_id'

UNION ALL

SELECT 
  'contacts' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
AND column_name IN ('notes', 'is_primary', 'mobile', 'title')

ORDER BY table_name, column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=== QUICK FIX APPLIED ===';
  RAISE NOTICE 'Added missing columns to existing tables';
  RAISE NOTICE 'Run the verification query above to confirm all columns exist';
END $$;