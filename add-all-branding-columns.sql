-- Add all missing columns to tenant_branding table based on WhiteLabelBrandingManager interface
ALTER TABLE public.tenant_branding 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#007bff',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#6c757d',
ADD COLUMN IF NOT EXISTS custom_domain TEXT,
ADD COLUMN IF NOT EXISTS email_from_name TEXT,
ADD COLUMN IF NOT EXISTS email_from_address TEXT,
ADD COLUMN IF NOT EXISTS phone_display_name TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT,
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS portal_subdomain TEXT,
ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_css TEXT;

-- Verify all columns are now present
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tenant_branding' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Clear Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- Optional: Insert a test record to ensure the table is working
-- INSERT INTO public.tenant_branding (tenant_id, company_name)
-- VALUES ('6136304e-5b88-4cc6-b0e7-615f9e2f543c', 'Test Company')
-- ON CONFLICT (tenant_id) DO NOTHING;