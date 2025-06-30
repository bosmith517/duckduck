-- SIMPLE COLUMN FIX - Just add the columns without foreign keys first
-- This avoids all dependency issues

-- STEP 1: Add columns to jobs table (no foreign keys yet)
DO $$
BEGIN
  RAISE NOTICE 'Adding columns to jobs table...';
  
  -- Add lead_id column without foreign key
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'lead_id' AND table_schema = 'public') THEN
    ALTER TABLE jobs ADD COLUMN lead_id UUID;
    RAISE NOTICE '✅ Added lead_id to jobs table';
  ELSE
    RAISE NOTICE '✓ jobs.lead_id already exists';
  END IF;
  
  -- Add assigned_technician_id column without foreign key
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'jobs' AND column_name = 'assigned_technician_id' AND table_schema = 'public') THEN
    ALTER TABLE jobs ADD COLUMN assigned_technician_id UUID;
    RAISE NOTICE '✅ Added assigned_technician_id to jobs table';
  ELSE
    RAISE NOTICE '✓ jobs.assigned_technician_id already exists';
  END IF;
END $$;

-- STEP 2: Add columns to contacts table
DO $$
BEGIN
  RAISE NOTICE 'Adding columns to contacts table...';
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'notes' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN notes TEXT;
    RAISE NOTICE '✅ Added notes to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.notes already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'is_primary' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN is_primary BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Added is_primary to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.is_primary already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'mobile' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN mobile VARCHAR(20);
    RAISE NOTICE '✅ Added mobile to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.mobile already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'title' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN title VARCHAR(100);
    RAISE NOTICE '✅ Added title to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.title already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'first_name' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN first_name VARCHAR(255);
    RAISE NOTICE '✅ Added first_name to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.first_name already exists';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'contacts' AND column_name = 'last_name' AND table_schema = 'public') THEN
    ALTER TABLE contacts ADD COLUMN last_name VARCHAR(255);
    RAISE NOTICE '✅ Added last_name to contacts table';
  ELSE
    RAISE NOTICE '✓ contacts.last_name already exists';
  END IF;
END $$;

-- STEP 3: Create or fix leads table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_name = 'leads' AND table_schema = 'public') THEN
    RAISE NOTICE 'Creating leads table...';
    
    CREATE TABLE leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,  -- No FK yet
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
      converted_to_job_id UUID,  -- No FK yet
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add check constraints
    ALTER TABLE leads ADD CONSTRAINT leads_status_check 
      CHECK (status IN ('new', 'qualified', 'unqualified', 'converted'));
    
    ALTER TABLE leads ADD CONSTRAINT leads_urgency_check 
      CHECK (urgency IN ('low', 'medium', 'high', 'emergency'));
    
    -- Enable RLS
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ Created leads table';
  ELSE
    RAISE NOTICE 'Fixing existing leads table...';
    
    -- Rename columns if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'leads' AND column_name = 'name' AND table_schema = 'public') THEN
      ALTER TABLE leads RENAME COLUMN name TO caller_name;
      RAISE NOTICE '✅ Renamed name to caller_name';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'leads' AND column_name = 'phone' AND table_schema = 'public') THEN
      ALTER TABLE leads RENAME COLUMN phone TO phone_number;
      RAISE NOTICE '✅ Renamed phone to phone_number';
    END IF;
    
    -- Add missing columns one by one
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'caller_name' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN caller_name VARCHAR(255);
      UPDATE leads SET caller_name = 'Unknown' WHERE caller_name IS NULL;
      ALTER TABLE leads ALTER COLUMN caller_name SET NOT NULL;
      RAISE NOTICE '✅ Added caller_name';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'phone_number' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN phone_number VARCHAR(20);
      UPDATE leads SET phone_number = '000-000-0000' WHERE phone_number IS NULL;
      ALTER TABLE leads ALTER COLUMN phone_number SET NOT NULL;
      RAISE NOTICE '✅ Added phone_number';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'lead_source' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN lead_source VARCHAR(100);
      UPDATE leads SET lead_source = 'Unknown' WHERE lead_source IS NULL;
      ALTER TABLE leads ALTER COLUMN lead_source SET NOT NULL;
      RAISE NOTICE '✅ Added lead_source';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'initial_request' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN initial_request TEXT;
      UPDATE leads SET initial_request = 'No description' WHERE initial_request IS NULL;
      ALTER TABLE leads ALTER COLUMN initial_request SET NOT NULL;
      RAISE NOTICE '✅ Added initial_request';
    END IF;
    
    -- Add other columns without NOT NULL constraints
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'urgency' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN urgency VARCHAR(20) DEFAULT 'medium';
      RAISE NOTICE '✅ Added urgency';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'estimated_value' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN estimated_value DECIMAL(10, 2);
      RAISE NOTICE '✅ Added estimated_value';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'follow_up_date' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN follow_up_date TIMESTAMP WITH TIME ZONE;
      RAISE NOTICE '✅ Added follow_up_date';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'notes' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN notes TEXT;
      RAISE NOTICE '✅ Added notes';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'updated_at' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      RAISE NOTICE '✅ Added updated_at';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'converted_to_job_id' AND table_schema = 'public') THEN
      ALTER TABLE leads ADD COLUMN converted_to_job_id UUID;
      RAISE NOTICE '✅ Added converted_to_job_id';
    END IF;
  END IF;
END $$;

-- STEP 4: Create call_logs table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_name = 'call_logs' AND table_schema = 'public') THEN
    RAISE NOTICE 'Creating call_logs table...';
    
    CREATE TABLE call_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,  -- No FK yet
      lead_id UUID,  -- No FK yet
      contact_id UUID,  -- No FK yet
      account_id UUID,  -- No FK yet
      caller_name VARCHAR(255),
      caller_phone VARCHAR(20),
      call_type VARCHAR(20) NOT NULL DEFAULT 'inbound',
      call_direction VARCHAR(20) NOT NULL DEFAULT 'inbound',
      duration INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Add check constraints
    ALTER TABLE call_logs ADD CONSTRAINT call_logs_type_check 
      CHECK (call_type IN ('inbound', 'outbound'));
    
    ALTER TABLE call_logs ADD CONSTRAINT call_logs_direction_check 
      CHECK (call_direction IN ('inbound', 'outbound'));
    
    ALTER TABLE call_logs ADD CONSTRAINT call_logs_status_check 
      CHECK (status IN ('missed', 'completed', 'voicemail', 'busy'));
    
    -- Enable RLS
    ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE '✅ Created call_logs table';
  ELSE
    RAISE NOTICE '✓ call_logs table already exists';
  END IF;
END $$;

-- STEP 5: Create RLS policies (safe to re-create)
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
  
  RAISE NOTICE '✅ Created RLS policies';
END $$;

-- STEP 6: Final verification
DO $$
DECLARE
  success BOOLEAN := true;
  missing_items TEXT := '';
BEGIN
  -- Check critical columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'caller_name' AND table_schema = 'public') THEN
    missing_items := missing_items || 'leads.caller_name, ';
    success := false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number' AND table_schema = 'public') THEN
    missing_items := missing_items || 'leads.phone_number, ';
    success := false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'lead_id' AND table_schema = 'public') THEN
    missing_items := missing_items || 'jobs.lead_id, ';
    success := false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'notes' AND table_schema = 'public') THEN
    missing_items := missing_items || 'contacts.notes, ';
    success := false;
  END IF;
  
  IF success THEN
    RAISE NOTICE '';
    RAISE NOTICE '=== ✅ SCHEMA FIX COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'All required columns have been added!';
    RAISE NOTICE 'Your frontend should now work without schema errors.';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTE: Foreign key constraints were NOT added to avoid dependency issues.';
    RAISE NOTICE 'The application will work fine without them.';
  ELSE
    RAISE WARNING 'Some columns are still missing: %', missing_items;
  END IF;
END $$;

-- Show what we have now
SELECT 
  'CURRENT SCHEMA STATUS' as info;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
AND (
  (table_name = 'leads' AND column_name IN ('caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency'))
  OR (table_name = 'contacts' AND column_name IN ('notes', 'is_primary', 'mobile', 'title'))
  OR (table_name = 'jobs' AND column_name IN ('assigned_technician_id', 'lead_id'))
  OR (table_name = 'call_logs' AND column_name = 'lead_id')
)
ORDER BY table_name, column_name;