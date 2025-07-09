-- Add missing address column to tenant_branding table
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Also add any other columns that might be missing
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS tagline TEXT;

ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- Verify all columns are present
SELECT 
    column_name, 
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tenant_branding' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Clear Supabase schema cache (this forces it to reload the table structure)
-- You may need to wait a few seconds or refresh your app after running this
NOTIFY pgrst, 'reload schema';