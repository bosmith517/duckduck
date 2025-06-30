-- FINAL COMPREHENSIVE SCHEMA FIX
-- This script handles all schema mismatches and is safe to run multiple times
-- Run this in your Supabase SQL editor or with psql

-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- STEP 1: Create/Fix leads table with all required columns
DO $$
BEGIN
  -- If leads table doesn't exist, create it
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    RAISE NOTICE 'Creating leads table...';
    
    CREATE TABLE leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      caller_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      lead_source VARCHAR(100) NOT NULL,
      initial_request TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new',
      urgency VARCHAR(20) NOT NULL DEFAULT 'medium',
      estimated_value DECIMAL(10, 2),
      follow_up_date TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      converted_to_job_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add constraints
    ALTER TABLE leads ADD CONSTRAINT leads_status_check 
      CHECK (status IN ('new', 'qualified', 'unqualified', 'converted'));
    ALTER TABLE leads ADD CONSTRAINT leads_urgency_check 
      CHECK (urgency IN ('low', 'medium', 'high', 'emergency'));
    
    -- Enable RLS
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ Created leads table';
  ELSE
    RAISE NOTICE 'Fixing existing leads table...';
    
    -- Add missing columns one by one (safe operations)
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255);
      RAISE NOTICE '✅ Added caller_name column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'caller_name column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
      RAISE NOTICE '✅ Added phone_number column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'phone_number column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100);
      RAISE NOTICE '✅ Added lead_source column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'lead_source column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_request TEXT;
      RAISE NOTICE '✅ Added initial_request column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'initial_request column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium';
      RAISE NOTICE '✅ Added urgency column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'urgency column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10, 2);
      RAISE NOTICE '✅ Added estimated_value column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'estimated_value column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE;
      RAISE NOTICE '✅ Added follow_up_date column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'follow_up_date column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
      RAISE NOTICE '✅ Added notes column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'notes column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      RAISE NOTICE '✅ Added updated_at column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'updated_at column already exists or error: %', SQLERRM;
    END;
    
    BEGIN
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_job_id UUID;
      RAISE NOTICE '✅ Added converted_to_job_id column';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'converted_to_job_id column already exists or error: %', SQLERRM;
    END;
  END IF;
END $$;

-- STEP 2: Fix contacts table
DO $$
BEGIN
  RAISE NOTICE 'Fixing contacts table...';
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
    RAISE NOTICE '✅ Added contacts.notes column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.notes already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Added contacts.is_primary column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.is_primary already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
    RAISE NOTICE '✅ Added contacts.mobile column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.mobile already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title VARCHAR(100);
    RAISE NOTICE '✅ Added contacts.title column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.title already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
    RAISE NOTICE '✅ Added contacts.first_name column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.first_name already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
    RAISE NOTICE '✅ Added contacts.last_name column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'contacts.last_name already exists or error: %', SQLERRM;
  END;
END $$;

-- STEP 3: Fix jobs table
DO $$
BEGIN
  RAISE NOTICE 'Fixing jobs table...';
  
  BEGIN
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lead_id UUID;
    RAISE NOTICE '✅ Added jobs.lead_id column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'jobs.lead_id already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;
    RAISE NOTICE '✅ Added jobs.assigned_technician_id column';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'jobs.assigned_technician_id already exists or error: %', SQLERRM;
  END;
END $$;

-- STEP 4: Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID,
  contact_id UUID,
  account_id UUID,
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20),
  call_type VARCHAR(20) NOT NULL DEFAULT 'inbound',
  call_direction VARCHAR(20) NOT NULL DEFAULT 'inbound',
  duration INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create lead_reminders table
CREATE TABLE IF NOT EXISTS lead_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  lead_id UUID,
  reminder_type VARCHAR(50),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE lead_reminders ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create RLS policies (safe to recreate)
DO $$
BEGIN
  -- Leads policies
  DROP POLICY IF EXISTS "tenant_isolation_select" ON leads;
  CREATE POLICY "tenant_isolation_select" ON leads
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_insert" ON leads;
  CREATE POLICY "tenant_isolation_insert" ON leads
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_update" ON leads;
  CREATE POLICY "tenant_isolation_update" ON leads
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Call logs policies
  DROP POLICY IF EXISTS "tenant_isolation_select" ON call_logs;
  CREATE POLICY "tenant_isolation_select" ON call_logs
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_insert" ON call_logs;
  CREATE POLICY "tenant_isolation_insert" ON call_logs
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Lead reminders policies  
  DROP POLICY IF EXISTS "tenant_isolation_select" ON lead_reminders;
  CREATE POLICY "tenant_isolation_select" ON lead_reminders
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_insert" ON lead_reminders;
  CREATE POLICY "tenant_isolation_insert" ON lead_reminders
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  RAISE NOTICE '✅ Created/updated RLS policies';
END $$;

-- STEP 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);

-- STEP 8: Force Supabase to refresh its schema cache
NOTIFY pgrst, 'reload schema';

-- STEP 9: Verification and final report
DO $$
DECLARE
  leads_exists BOOLEAN;
  missing_cols TEXT := '';
  required_cols TEXT[] := ARRAY['caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency'];
  col TEXT;
BEGIN
  -- Check if leads table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'leads' AND table_schema = 'public'
  ) INTO leads_exists;
  
  IF NOT leads_exists THEN
    RAISE EXCEPTION 'CRITICAL: leads table still does not exist after migration!';
  END IF;
  
  -- Check for missing required columns
  FOREACH col IN ARRAY required_cols LOOP
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'leads' 
      AND column_name = col 
      AND table_schema = 'public'
    ) THEN
      missing_cols := missing_cols || col || ', ';
    END IF;
  END LOOP;
  
  IF missing_cols != '' THEN
    RAISE WARNING 'Missing required columns in leads table: %', missing_cols;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '=== ✅ SCHEMA FIX COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'All required columns exist in the leads table';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Wait 2-3 minutes for Supabase cache to refresh';
    RAISE NOTICE '2. Restart your development server (npm run dev)';
    RAISE NOTICE '3. Try the NewInquiryModal again';
    RAISE NOTICE '';
    RAISE NOTICE 'If you still get schema errors:';
    RAISE NOTICE '1. Check your Supabase project URL matches your local database';
    RAISE NOTICE '2. Verify you are using the correct environment variables';
    RAISE NOTICE '3. Try logging out and back in to refresh auth tokens';
  END IF;
END $$;

-- Show the current schema for verification
SELECT 
  'FINAL VERIFICATION - Current leads table schema:' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leads'
ORDER BY ordinal_position;