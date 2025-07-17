-- Add missing columns to leads table that are referenced in sync_lead_site_visit_to_calendar function
-- These columns are needed for proper lead management and site visit scheduling

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS service_address TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS urgency TEXT,
ADD COLUMN IF NOT EXISTS budget_range TEXT,
ADD COLUMN IF NOT EXISTS project_type TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'phone',
ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for commonly searched fields
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON public.leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_customer_name ON public.leads(customer_name);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON public.leads(urgency);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leads_updated_at_trigger ON public.leads;
CREATE TRIGGER update_leads_updated_at_trigger
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN public.leads.customer_name IS 'Full name of the customer/caller';
COMMENT ON COLUMN public.leads.caller_name IS 'Alternate field for caller name (legacy support)';
COMMENT ON COLUMN public.leads.phone_number IS 'Primary phone number for the lead';
COMMENT ON COLUMN public.leads.description IS 'Description of the service needed or project details';
COMMENT ON COLUMN public.leads.service_address IS 'Address where service is needed';
COMMENT ON COLUMN public.leads.address IS 'Alternate address field (legacy support)';
COMMENT ON COLUMN public.leads.assigned_to IS 'User assigned to handle this lead';
COMMENT ON COLUMN public.leads.urgency IS 'How urgent the service is needed (emergency, urgent, normal, flexible)';
COMMENT ON COLUMN public.leads.budget_range IS 'Estimated budget range for the project';
COMMENT ON COLUMN public.leads.project_type IS 'Type of project or service needed';
COMMENT ON COLUMN public.leads.source IS 'How the lead was generated (web, phone, referral, etc)';
COMMENT ON COLUMN public.leads.preferred_contact_method IS 'How the customer prefers to be contacted';
COMMENT ON COLUMN public.leads.preferred_contact_time IS 'Best time to contact the customer';

-- Update any existing leads that have name but not customer_name
UPDATE public.leads 
SET customer_name = name 
WHERE customer_name IS NULL AND name IS NOT NULL;

-- Update any existing leads that have address fields but not service_address
UPDATE public.leads 
SET service_address = COALESCE(full_address, street_address)
WHERE service_address IS NULL 
  AND (full_address IS NOT NULL OR street_address IS NOT NULL);