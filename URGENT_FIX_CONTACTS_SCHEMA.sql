-- URGENT: Fix contacts table schema to prevent contact saving failures
-- This addresses the immediate error: "Could not find the 'notes' column of 'contacts' in the schema cache"

-- Add the missing 'notes' column that ContactForm.tsx expects
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS notes text;

-- Add the missing 'is_primary' column that ContactForm.tsx expects
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Add the missing 'mobile' column mentioned in error logs
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS mobile character varying(20);

-- Add the missing 'title' column used in ContactForm
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS title character varying(100);

-- Add helpful comments
COMMENT ON COLUMN public.contacts.notes IS 'General notes about the contact (separate from communication_notes)';
COMMENT ON COLUMN public.contacts.is_primary IS 'Whether this contact is the primary contact for the account';
COMMENT ON COLUMN public.contacts.mobile IS 'Mobile phone number for contact';
COMMENT ON COLUMN public.contacts.title IS 'Job title or position';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON public.contacts(is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_contacts_mobile ON public.contacts(mobile) WHERE mobile IS NOT NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
AND column_name IN ('notes', 'is_primary', 'mobile', 'title')
ORDER BY column_name;