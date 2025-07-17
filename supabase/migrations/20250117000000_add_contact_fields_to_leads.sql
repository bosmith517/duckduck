-- Add missing columns to leads table for contact/account synchronization
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS contact_type VARCHAR(20) DEFAULT 'residential' CHECK (contact_type IN ('residential', 'business')),
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS street_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS full_address TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS follow_up_date DATE,
ADD COLUMN IF NOT EXISTS converted_to_job_id UUID REFERENCES jobs(id),
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id),
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_contact_type ON leads(contact_type);
CREATE INDEX IF NOT EXISTS idx_leads_contact_id ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_job_id ON leads(converted_to_job_id);

-- Add comments
COMMENT ON COLUMN leads.contact_type IS 'Type of contact: residential or business';
COMMENT ON COLUMN leads.company_name IS 'Company name for business leads';
COMMENT ON COLUMN leads.contact_id IS 'Reference to contacts table for residential leads';
COMMENT ON COLUMN leads.account_id IS 'Reference to accounts table for business leads';
COMMENT ON COLUMN leads.converted_to_job_id IS 'Reference to job created from this lead';

-- Success message
SELECT 'Lead contact fields added successfully!' as status;