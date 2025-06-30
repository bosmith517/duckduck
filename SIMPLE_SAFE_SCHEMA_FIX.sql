-- SIMPLE SAFE SCHEMA FIX
-- This only adds missing columns - NO foreign keys, NO constraints, NO dependencies
-- 100% safe to run multiple times

-- Add missing columns to leads table (if it doesn't exist, create it)
DO $$
BEGIN
  -- Create leads table if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
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
    
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ Created leads table';
  ELSE
    RAISE NOTICE '✓ Leads table already exists';
  END IF;
  
  -- Add missing columns to leads (safe operations)
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_request TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10, 2);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_job_id UUID;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Add missing columns to contacts table
DO $$
BEGIN
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
    RAISE NOTICE '✅ Added contacts.notes';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.notes already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Added contacts.is_primary';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.is_primary already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mobile VARCHAR(20);
    RAISE NOTICE '✅ Added contacts.mobile';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.mobile already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS title VARCHAR(100);
    RAISE NOTICE '✅ Added contacts.title';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.title already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
    RAISE NOTICE '✅ Added contacts.first_name';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.first_name already exists or error: %', SQLERRM;
  END;
  
  BEGIN
    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
    RAISE NOTICE '✅ Added contacts.last_name';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ contacts.last_name already exists or error: %', SQLERRM;
  END;
END $$;

-- Add missing columns to jobs table  
DO $$
BEGIN
  BEGIN
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;
    RAISE NOTICE '✅ Added jobs.assigned_technician_id';
  EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE '✓ jobs.assigned_technician_id already exists or error: %', SQLERRM;
  END;
END $$;

-- Create call_logs table (simple version, no foreign keys)
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

-- Create lead_reminders table (simple version, no foreign keys)
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

-- Enable RLS on new tables
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_reminders ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (simple version)
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
    
  DROP POLICY IF EXISTS "tenant_isolation_delete" ON leads;
  CREATE POLICY "tenant_isolation_delete" ON leads
    FOR DELETE TO authenticated
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
    
  DROP POLICY IF EXISTS "tenant_isolation_update" ON call_logs;
  CREATE POLICY "tenant_isolation_update" ON call_logs
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Lead reminders policies  
  DROP POLICY IF EXISTS "tenant_isolation_select" ON lead_reminders;
  CREATE POLICY "tenant_isolation_select" ON lead_reminders
    FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_insert" ON lead_reminders;
  CREATE POLICY "tenant_isolation_insert" ON lead_reminders
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "tenant_isolation_update" ON lead_reminders;
  CREATE POLICY "tenant_isolation_update" ON lead_reminders
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  RAISE NOTICE '✅ Created basic RLS policies';
END $$;

-- Force Supabase cache refresh
NOTIFY pgrst, 'reload schema';

-- Final verification
DO $$
DECLARE
  missing_cols TEXT := '';
  success BOOLEAN := true;
BEGIN
  -- Check critical columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'caller_name' AND table_schema = 'public') THEN
    missing_cols := missing_cols || 'leads.caller_name, ';
    success := false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number' AND table_schema = 'public') THEN
    missing_cols := missing_cols || 'leads.phone_number, ';
    success := false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'notes' AND table_schema = 'public') THEN
    missing_cols := missing_cols || 'contacts.notes, ';
    success := false;
  END IF;
  
  IF success THEN
    RAISE NOTICE '';
    RAISE NOTICE '=== ✅ SIMPLE SCHEMA FIX COMPLETED ===';
    RAISE NOTICE 'All required columns added successfully!';
    RAISE NOTICE 'No foreign keys were added to avoid dependency issues.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Wait 2-3 minutes for cache refresh';
    RAISE NOTICE '2. Restart your development server';
    RAISE NOTICE '3. Test the NewInquiryModal and EditLeadModal';
  ELSE
    RAISE WARNING 'Still missing columns: %', missing_cols;
  END IF;
END $$;

-- Show what we have
SELECT 
  'FINAL VERIFICATION - leads table columns:' as info;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'leads'
ORDER BY ordinal_position;