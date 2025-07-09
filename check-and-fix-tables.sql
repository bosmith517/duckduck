-- Check if tenant_branding table exists and what columns it has
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tenant_branding' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'tenant_branding';

-- Add any missing columns to tenant_branding (safe to run multiple times)
DO $$ 
BEGIN
    -- Add white_label_enabled if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_branding' 
        AND column_name = 'white_label_enabled'
    ) THEN
        ALTER TABLE public.tenant_branding ADD COLUMN white_label_enabled BOOLEAN DEFAULT false;
    END IF;

    -- Add email_from_address if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_branding' 
        AND column_name = 'email_from_address'
    ) THEN
        ALTER TABLE public.tenant_branding ADD COLUMN email_from_address TEXT;
    END IF;

    -- Add phone_display_name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_branding' 
        AND column_name = 'phone_display_name'
    ) THEN
        ALTER TABLE public.tenant_branding ADD COLUMN phone_display_name TEXT;
    END IF;

    -- Add portal_subdomain if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_branding' 
        AND column_name = 'portal_subdomain'
    ) THEN
        ALTER TABLE public.tenant_branding ADD COLUMN portal_subdomain TEXT;
    END IF;

    -- Add custom_css if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_branding' 
        AND column_name = 'custom_css'
    ) THEN
        ALTER TABLE public.tenant_branding ADD COLUMN custom_css TEXT;
    END IF;
END $$;

-- Create technician_profiles table only if it doesn't exist
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

-- Enable RLS for technician_profiles if not already enabled
ALTER TABLE public.technician_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for technician_profiles only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'technician_profiles' 
        AND policyname = 'Users can view technician profiles in their tenant'
    ) THEN
        CREATE POLICY "Users can view technician profiles in their tenant" ON public.technician_profiles
            FOR SELECT
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'technician_profiles' 
        AND policyname = 'Admins can manage technician profiles'
    ) THEN
        CREATE POLICY "Admins can manage technician profiles" ON public.technician_profiles
            FOR ALL
            USING (
                tenant_id IN (
                    SELECT tenant_id FROM public.user_profiles 
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_technician_profiles_user_profile_id ON public.technician_profiles(user_profile_id);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_tenant_id ON public.technician_profiles(tenant_id);

-- Grant permissions
GRANT ALL ON public.technician_profiles TO authenticated;

-- Final check: List all tables that now exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tenant_branding', 'technician_profiles')
ORDER BY table_name;