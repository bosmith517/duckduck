-- Fix contacts table schema to match frontend expectations
-- Add missing columns that the frontend ContactForm.tsx is trying to use

-- Add mobile column (mentioned in error logs)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS mobile character varying(20);

-- Add title column (used in ContactForm but not in schema)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS title character varying(100);

-- Add job_title column (mentioned in schema but may be missing)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS job_title character varying(100);

-- Add company column (mentioned in schema but may be missing)
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS company character varying(255);

-- Update existing contacts to have proper name field if missing
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS name text;

-- Update name field based on first_name and last_name for existing records
UPDATE public.contacts 
SET name = CONCAT(first_name, ' ', last_name) 
WHERE name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON public.contacts(mobile);
CREATE INDEX IF NOT EXISTS idx_contacts_title ON public.contacts(title);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON public.contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON public.contacts(name);

-- Add comments for documentation
COMMENT ON COLUMN public.contacts.mobile IS 'Mobile phone number for contact';
COMMENT ON COLUMN public.contacts.title IS 'Job title or position';
COMMENT ON COLUMN public.contacts.company IS 'Company name if different from account';
COMMENT ON COLUMN public.contacts.name IS 'Full name (computed from first_name + last_name)';

-- Ensure RLS policies still work with new columns
-- (No changes needed as existing policies are based on tenant_id)