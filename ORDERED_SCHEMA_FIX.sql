-- ORDERED SCHEMA FIX - Handles dependencies correctly
-- Run this migration to fix all schema mismatches

-- STEP 1: Create/Fix the leads table FIRST (since other tables reference it)
DO $$
BEGIN
  -- Check if leads table exists
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    -- Create the table with correct schema
    CREATE TABLE leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      caller_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      lead_source VARCHAR(100) NOT NULL,
      initial_request TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'unqualified', 'converted')),
      urgency VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
      estimated_value DECIMAL(10, 2),
      follow_up_date TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      converted_to_job_id UUID, -- No FK reference yet, jobs might not have the column
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    
    RAISE NOTICE 'Created leads table';
  ELSE
    -- Fix existing table
    -- Rename columns if they exist with wrong names
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'name' AND table_schema = 'public') THEN
      ALTER TABLE leads RENAME COLUMN name TO caller_name;
      RAISE NOTICE 'Renamed leads.name to caller_name';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone' AND table_schema = 'public') THEN
      ALTER TABLE leads RENAME COLUMN phone TO phone_number;
      RAISE NOTICE 'Renamed leads.phone to phone_number';
    END IF;
    
    -- Add missing columns
    ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS initial_request TEXT,
    ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS converted_to_job_id UUID;
    
    -- Add check constraint for urgency if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage 
      WHERE table_name = 'leads' AND constraint_name LIKE '%urgency%'
    ) THEN
      ALTER TABLE leads ADD CONSTRAINT leads_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'emergency'));
    END IF;
    
    -- Update null values before setting NOT NULL
    UPDATE leads SET caller_name = COALESCE(caller_name, 'Unknown') WHERE caller_name IS NULL;
    UPDATE leads SET phone_number = COALESCE(phone_number, '000-000-0000') WHERE phone_number IS NULL;
    UPDATE leads SET lead_source = COALESCE(lead_source, 'Unknown') WHERE lead_source IS NULL;
    UPDATE leads SET initial_request = COALESCE(initial_request, 'No description provided') WHERE initial_request IS NULL;
    
    -- Set NOT NULL constraints
    ALTER TABLE leads 
    ALTER COLUMN caller_name SET NOT NULL,
    ALTER COLUMN phone_number SET NOT NULL,
    ALTER COLUMN lead_source SET NOT NULL,
    ALTER COLUMN initial_request SET NOT NULL;
    
    RAISE NOTICE 'Fixed leads table schema';
  END IF;
END $$;

-- STEP 2: Fix jobs table to add lead_id column
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS lead_id UUID,
ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add FK for lead_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_name = 'jobs' 
    AND constraint_name = 'jobs_lead_id_fkey'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_lead_id_fkey 
    FOREIGN KEY (lead_id) REFERENCES leads(id);
    RAISE NOTICE 'Added foreign key jobs.lead_id -> leads.id';
  END IF;
  
  -- Add FK for assigned_technician_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_name = 'jobs' 
    AND constraint_name = 'jobs_assigned_technician_id_fkey'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_assigned_technician_id_fkey 
    FOREIGN KEY (assigned_technician_id) REFERENCES user_profiles(id);
    RAISE NOTICE 'Added foreign key jobs.assigned_technician_id -> user_profiles.id';
  END IF;
END $$;

-- STEP 3: Now add the FK from leads to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_name = 'leads' 
    AND constraint_name = 'leads_converted_to_job_id_fkey'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_converted_to_job_id_fkey 
    FOREIGN KEY (converted_to_job_id) REFERENCES jobs(id);
    RAISE NOTICE 'Added foreign key leads.converted_to_job_id -> jobs.id';
  END IF;
END $$;

-- STEP 4: Fix contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS title VARCHAR(100),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- Split name into first/last if needed
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'name' AND table_schema = 'public') THEN
    UPDATE contacts 
    SET 
      first_name = COALESCE(first_name, SPLIT_PART(name, ' ', 1)),
      last_name = COALESCE(last_name, CASE 
        WHEN POSITION(' ' IN name) > 0 
        THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
        ELSE ''
      END)
    WHERE (first_name IS NULL OR last_name IS NULL) AND name IS NOT NULL;
    RAISE NOTICE 'Split contacts.name into first_name and last_name';
  END IF;
END $$;

-- STEP 5: Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id),
  contact_id UUID REFERENCES contacts(id),
  account_id UUID REFERENCES accounts(id),
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20),
  call_type VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK (call_type IN ('inbound', 'outbound')),
  call_direction VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK (call_direction IN ('inbound', 'outbound')),
  duration INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('missed', 'completed', 'voicemail', 'busy')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on call_logs
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create other supporting tables
CREATE TABLE IF NOT EXISTS lead_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id),
  reminder_type VARCHAR(50),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  message_type VARCHAR(50),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  scheduled_send_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES user_profiles(id),
  job_id UUID REFERENCES jobs(id),
  event_type VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  location TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE lead_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- STEP 7: Create RLS policies
DO $$
BEGIN
  -- Leads policies
  DROP POLICY IF EXISTS "Users can view their tenant's leads" ON leads;
  CREATE POLICY "Users can view their tenant's leads" ON leads
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "Users can create leads for their tenant" ON leads;
  CREATE POLICY "Users can create leads for their tenant" ON leads
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "Users can update their tenant's leads" ON leads;
  CREATE POLICY "Users can update their tenant's leads" ON leads
    FOR UPDATE TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Call logs policies
  DROP POLICY IF EXISTS "Users can view their tenant's call logs" ON call_logs;
  CREATE POLICY "Users can view their tenant's call logs" ON call_logs
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  DROP POLICY IF EXISTS "Users can create call logs for their tenant" ON call_logs;
  CREATE POLICY "Users can create call logs for their tenant" ON call_logs
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  RAISE NOTICE 'Created RLS policies';
END $$;

-- STEP 8: Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_technician ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON jobs(lead_id);

-- STEP 9: Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- STEP 10: Verify the schema
DO $$
DECLARE
  missing_columns TEXT := '';
  col_check RECORD;
BEGIN
  -- Check leads table
  FOR col_check IN 
    SELECT 'leads' as tbl, col as column_name 
    FROM unnest(ARRAY['caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency']) as col
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = col_check.tbl 
      AND column_name = col_check.column_name 
      AND table_schema = 'public'
    ) THEN
      missing_columns := missing_columns || col_check.tbl || '.' || col_check.column_name || ', ';
    END IF;
  END LOOP;
  
  -- Check contacts table
  FOR col_check IN 
    SELECT 'contacts' as tbl, col as column_name 
    FROM unnest(ARRAY['notes', 'is_primary', 'mobile', 'title']) as col
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = col_check.tbl 
      AND column_name = col_check.column_name 
      AND table_schema = 'public'
    ) THEN
      missing_columns := missing_columns || col_check.tbl || '.' || col_check.column_name || ', ';
    END IF;
  END LOOP;
  
  -- Check jobs table
  FOR col_check IN 
    SELECT 'jobs' as tbl, col as column_name 
    FROM unnest(ARRAY['assigned_technician_id', 'lead_id']) as col
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = col_check.tbl 
      AND column_name = col_check.column_name 
      AND table_schema = 'public'
    ) THEN
      missing_columns := missing_columns || col_check.tbl || '.' || col_check.column_name || ', ';
    END IF;
  END LOOP;
  
  IF missing_columns = '' THEN
    RAISE NOTICE '=== ✅ SCHEMA FIX COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'All required columns are present!';
  ELSE
    RAISE WARNING 'Missing columns: %', missing_columns;
  END IF;
END $$;

-- Show final verification
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
AND (
  (table_name = 'leads' AND column_name IN ('caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency', 'converted_to_job_id'))
  OR (table_name = 'contacts' AND column_name IN ('notes', 'is_primary', 'mobile', 'title'))
  OR (table_name = 'jobs' AND column_name IN ('assigned_technician_id', 'lead_id'))
)
ORDER BY table_name, column_name;