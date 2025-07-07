-- Create tenant_branding table for white-label branding customization
CREATE TABLE IF NOT EXISTS public.tenant_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Company Branding
    company_name TEXT,
    company_tagline TEXT,
    company_description TEXT,
    
    -- Logo and Visual Assets
    logo_url TEXT, -- URL to uploaded logo in storage
    favicon_url TEXT, -- URL to favicon
    header_logo_url TEXT, -- Optional different logo for headers
    
    -- Color Scheme
    primary_color VARCHAR(7) DEFAULT '#007bff', -- Hex color code
    secondary_color VARCHAR(7) DEFAULT '#6c757d',
    accent_color VARCHAR(7) DEFAULT '#28a745',
    background_color VARCHAR(7) DEFAULT '#ffffff',
    text_color VARCHAR(7) DEFAULT '#212529',
    
    -- Portal Customization
    portal_title TEXT DEFAULT 'Customer Portal',
    portal_welcome_message TEXT,
    portal_footer_text TEXT,
    
    -- Contact Information Override
    support_phone TEXT,
    support_email TEXT,
    website_url TEXT,
    address TEXT, -- Company address
    
    -- Email Configuration (matching WhiteLabelBrandingManager interface)
    email_from_name TEXT,
    email_from_address TEXT,
    phone_display_name TEXT,
    custom_domain TEXT,
    portal_subdomain TEXT,
    white_label_enabled BOOLEAN DEFAULT false,
    
    -- Advanced Customization
    custom_css TEXT, -- Custom CSS for advanced styling
    custom_js TEXT, -- Custom JavaScript (be careful with security)
    
    -- Email Branding
    email_header_logo_url TEXT,
    email_footer_text TEXT,
    email_signature TEXT,
    
    -- Social Media Links
    facebook_url TEXT,
    twitter_url TEXT,
    linkedin_url TEXT,
    instagram_url TEXT,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    apply_to_emails BOOLEAN DEFAULT true,
    apply_to_portal BOOLEAN DEFAULT true,
    apply_to_estimates BOOLEAN DEFAULT false,
    apply_to_invoices BOOLEAN DEFAULT false,
    
    -- Unique constraint to ensure one branding per tenant
    CONSTRAINT unique_tenant_branding UNIQUE (tenant_id)
);

-- Add indexes for performance
CREATE INDEX idx_tenant_branding_tenant_id ON public.tenant_branding (tenant_id);
CREATE INDEX idx_tenant_branding_active ON public.tenant_branding (tenant_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access branding for their own tenant
CREATE POLICY "Users can view their tenant's branding"
    ON public.tenant_branding FOR SELECT
    USING (
        tenant_id IN (
            SELECT user_profiles.tenant_id 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- Users with appropriate permissions can manage their tenant's branding
CREATE POLICY "Users can manage their tenant's branding"
    ON public.tenant_branding FOR ALL
    USING (
        tenant_id IN (
            SELECT user_profiles.tenant_id 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('admin', 'agent')
        )
    );

-- Service role can access all branding (for system operations)
CREATE POLICY "Service role can manage all branding"
    ON public.tenant_branding FOR ALL
    USING (auth.role() = 'service_role');

-- Anonymous users can read branding for customer portal access
CREATE POLICY "Anonymous users can read branding"
    ON public.tenant_branding FOR SELECT
    USING (is_active = true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_branding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_branding_updated_at
    BEFORE UPDATE ON public.tenant_branding
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_branding_updated_at();

-- Grant permissions
GRANT ALL ON TABLE public.tenant_branding TO authenticated;
GRANT ALL ON TABLE public.tenant_branding TO service_role;
GRANT SELECT ON TABLE public.tenant_branding TO anon; -- For customer portal access

-- Add helpful comments
COMMENT ON TABLE public.tenant_branding IS 'Stores white-label branding customization for each tenant';
COMMENT ON COLUMN public.tenant_branding.tenant_id IS 'Reference to the tenant this branding belongs to';
COMMENT ON COLUMN public.tenant_branding.logo_url IS 'URL to the main company logo stored in Supabase storage';
COMMENT ON COLUMN public.tenant_branding.custom_css IS 'Custom CSS for advanced portal styling - use with caution';
COMMENT ON COLUMN public.tenant_branding.custom_js IS 'Custom JavaScript - security review required before use';