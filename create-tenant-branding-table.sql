-- Create tenant_branding table (run this in Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.tenant_branding (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Basic branding
    company_name TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#007bff',
    secondary_color TEXT DEFAULT '#6c757d',
    custom_domain TEXT,
    email_from_name TEXT,
    email_from_address TEXT,
    phone_display_name TEXT,
    website_url TEXT,
    address TEXT,
    tagline TEXT,
    email_signature TEXT,
    portal_subdomain TEXT,
    white_label_enabled BOOLEAN DEFAULT false,
    custom_css TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one branding per tenant
    CONSTRAINT unique_tenant_branding UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their tenant branding" ON public.tenant_branding
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage tenant branding" ON public.tenant_branding
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create index
CREATE INDEX idx_tenant_branding_tenant_id ON public.tenant_branding(tenant_id);

-- Grant permissions
GRANT ALL ON public.tenant_branding TO authenticated;

-- Create technician_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.technician_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Technician specific fields
    employee_id TEXT,
    certifications TEXT[],
    specialties TEXT[],
    service_areas TEXT[],
    availability_status TEXT DEFAULT 'available',
    hourly_rate DECIMAL(10,2),
    
    -- Performance metrics
    jobs_completed INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    on_time_percentage DECIMAL(5,2),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_technician_profile UNIQUE (user_profile_id)
);

-- Enable RLS for technician_profiles
ALTER TABLE public.technician_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for technician_profiles
CREATE POLICY "Users can view technician profiles in their tenant" ON public.technician_profiles
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage technician profiles" ON public.technician_profiles
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create indexes
CREATE INDEX idx_technician_profiles_user_profile_id ON public.technician_profiles(user_profile_id);
CREATE INDEX idx_technician_profiles_tenant_id ON public.technician_profiles(tenant_id);

-- Grant permissions
GRANT ALL ON public.technician_profiles TO authenticated;