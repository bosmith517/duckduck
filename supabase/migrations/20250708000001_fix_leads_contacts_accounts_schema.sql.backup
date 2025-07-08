-- Fix schema mismatches for leads, contacts, and accounts tables
-- This migration adds missing fields that are being used in the NewInquiryModal component

-- Add missing columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS caller_type VARCHAR(50) DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100),
ADD COLUMN IF NOT EXISTS initial_request TEXT,
ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS property_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS property_size VARCHAR(100),
ADD COLUMN IF NOT EXISTS lot_size VARCHAR(100),
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS additional_property_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS converted_contact_id UUID,
ADD COLUMN IF NOT EXISTS converted_account_id UUID,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Rename 'name' to 'caller_name' in leads table if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'leads' AND column_name = 'name' 
             AND table_schema = 'public') THEN
    ALTER TABLE public.leads RENAME COLUMN name TO caller_name;
  END IF;
END $$;

-- Add constraints to leads table
DO $$
BEGIN
  -- Add caller_type constraint if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                 WHERE table_name = 'leads' AND constraint_name = 'leads_caller_type_check') THEN
    ALTER TABLE public.leads 
    ADD CONSTRAINT leads_caller_type_check 
    CHECK (caller_type IN ('individual', 'business'));
  END IF;
  
  -- Add urgency constraint if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                 WHERE table_name = 'leads' AND constraint_name = 'leads_urgency_check') THEN
    ALTER TABLE public.leads 
    ADD CONSTRAINT leads_urgency_check 
    CHECK (urgency IN ('low', 'medium', 'high', 'emergency'));
  END IF;
END $$;

-- Add foreign key constraints for converted_contact_id and converted_account_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                 WHERE table_name = 'leads' AND constraint_name = 'leads_converted_contact_id_fkey') THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_converted_contact_id_fkey 
    FOREIGN KEY (converted_contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                 WHERE table_name = 'leads' AND constraint_name = 'leads_converted_account_id_fkey') THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_converted_account_id_fkey 
    FOREIGN KEY (converted_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure contacts table has all required fields
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Ensure accounts table has updated_at field (even though it's not in the original schema)
-- We'll add it for consistency
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create updated_at triggers for all three tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
    CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_accounts_updated_at') THEN
    CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_caller_type ON public.leads(caller_type);
CREATE INDEX IF NOT EXISTS idx_leads_converted_contact_id ON public.leads(converted_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_account_id ON public.leads(converted_account_id);

-- Grant permissions
GRANT ALL ON public.leads TO authenticated;
GRANT ALL ON public.contacts TO authenticated;
GRANT ALL ON public.accounts TO authenticated;