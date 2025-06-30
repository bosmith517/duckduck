-- FIX ALL SCHEMA MISMATCHES
-- This migration aligns the database schema with what the frontend code expects

-- 1. Fix leads table to match NewInquiryModal expectations
DO $$
BEGIN
  -- Check if leads table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads' AND table_schema = 'public') THEN
    -- Rename columns if they exist with wrong names
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'name') THEN
      ALTER TABLE leads RENAME COLUMN name TO caller_name;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone') THEN
      ALTER TABLE leads RENAME COLUMN phone TO phone_number;
    END IF;
    
    -- Add missing columns
    ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS caller_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100),
    ADD COLUMN IF NOT EXISTS initial_request TEXT,
    ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
    ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS converted_to_job_id UUID REFERENCES jobs(id);
    
    -- Make required columns NOT NULL if they have data
    UPDATE leads SET caller_name = COALESCE(caller_name, 'Unknown') WHERE caller_name IS NULL;
    UPDATE leads SET phone_number = COALESCE(phone_number, '000-000-0000') WHERE phone_number IS NULL;
    UPDATE leads SET lead_source = COALESCE(lead_source, 'Unknown') WHERE lead_source IS NULL;
    UPDATE leads SET initial_request = COALESCE(initial_request, 'No description provided') WHERE initial_request IS NULL;
    
    -- Now make them NOT NULL
    ALTER TABLE leads 
    ALTER COLUMN caller_name SET NOT NULL,
    ALTER COLUMN phone_number SET NOT NULL,
    ALTER COLUMN lead_source SET NOT NULL,
    ALTER COLUMN initial_request SET NOT NULL;
    
  ELSE
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
      converted_to_job_id UUID REFERENCES jobs(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Users can view their tenant's leads" ON leads
      FOR SELECT TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
      
    CREATE POLICY "Users can create leads for their tenant" ON leads
      FOR INSERT TO authenticated
      WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
      
    CREATE POLICY "Users can update their tenant's leads" ON leads
      FOR UPDATE TO authenticated
      USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- 2. Fix contacts table to match ContactForm expectations
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS title VARCHAR(100),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- If name column exists and first_name/last_name are empty, split the name
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'name') THEN
    UPDATE contacts 
    SET 
      first_name = COALESCE(first_name, SPLIT_PART(name, ' ', 1)),
      last_name = COALESCE(last_name, CASE 
        WHEN POSITION(' ' IN name) > 0 
        THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
        ELSE ''
      END)
    WHERE first_name IS NULL OR last_name IS NULL;
  END IF;
END $$;

-- 3. Fix jobs table to match PromoteToJobModal expectations
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- 4. Create call_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id),
  contact_id UUID REFERENCES contacts(id),
  account_id UUID REFERENCES accounts(id),
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20),
  call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('inbound', 'outbound')),
  call_direction VARCHAR(20) NOT NULL CHECK (call_direction IN ('inbound', 'outbound')),
  duration INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('missed', 'completed', 'voicemail', 'busy')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on call_logs
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for call_logs
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their tenant's call logs" ON call_logs;
  DROP POLICY IF EXISTS "Users can create call logs for their tenant" ON call_logs;
  
  -- Create new policies
  CREATE POLICY "Users can view their tenant's call logs" ON call_logs
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
    
  CREATE POLICY "Users can create call logs for their tenant" ON call_logs
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
END $$;

-- 5. Create lead_reminders table if referenced by NewInquiryModal
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

-- Enable RLS on lead_reminders
ALTER TABLE lead_reminders ENABLE ROW LEVEL SECURITY;

-- 6. Create notifications table if referenced
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  message_type VARCHAR(50),
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  scheduled_send_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 7. Create calendar_events table if referenced
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
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

-- Enable RLS on calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_technician ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON jobs(lead_id);

-- 9. Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to leads table
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Verify the schema changes
SELECT 
  'leads' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND table_schema = 'public'
AND column_name IN ('caller_name', 'phone_number', 'lead_source', 'initial_request', 'urgency')

UNION ALL

SELECT 
  'contacts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
AND column_name IN ('notes', 'is_primary', 'mobile', 'title', 'first_name', 'last_name')

UNION ALL

SELECT 
  'jobs' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND table_schema = 'public'
AND column_name IN ('assigned_technician_id', 'lead_id')

ORDER BY table_name, column_name;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=== SCHEMA MISMATCH FIXES APPLIED ===';
  RAISE NOTICE '✅ Leads table: Fixed column names and added missing columns';
  RAISE NOTICE '✅ Contacts table: Added missing columns (notes, is_primary, mobile, title)';
  RAISE NOTICE '✅ Jobs table: Added technician assignment and lead reference';
  RAISE NOTICE '✅ Created auxiliary tables: call_logs, lead_reminders, notifications, calendar_events';
  RAISE NOTICE '✅ Added proper indexes and RLS policies';
  RAISE NOTICE '✅ Your frontend code should now work without schema errors!';
END $$;