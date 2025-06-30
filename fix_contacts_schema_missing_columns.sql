-- Fix contacts table schema issues - Add missing columns that frontend expects
-- Issue: Frontend ContactForm.tsx expects 'notes' and 'is_primary' columns that don't exist in the database

-- Add the missing 'notes' column to contacts table
-- The frontend ContactForm.tsx uses contact.notes for additional notes/comments
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS notes text;

-- Add the missing 'is_primary' column to contacts table  
-- The frontend ContactForm.tsx uses contact.is_primary for marking primary contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Add indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_contacts_notes ON public.contacts USING gin(to_tsvector('english', notes))
WHERE notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_is_primary ON public.contacts(is_primary) 
WHERE is_primary = true;

-- Add helpful comments for documentation
COMMENT ON COLUMN public.contacts.notes IS 'General notes about the contact (separate from communication_notes)';
COMMENT ON COLUMN public.contacts.is_primary IS 'Whether this contact is the primary contact for the account';

-- Ensure RLS policies work with new columns (inherit from existing tenant_id policies)
-- No additional RLS changes needed as policies are based on tenant_id

-- Verify the schema changes
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'contacts' 
AND table_schema = 'public'
AND column_name IN ('notes', 'is_primary', 'communication_notes')
ORDER BY column_name;

-- Show a few sample records to verify the structure
SELECT 
    id,
    first_name,
    last_name,
    email,
    phone,
    mobile,
    notes,
    communication_notes,
    is_primary,
    created_at
FROM public.contacts 
LIMIT 3;