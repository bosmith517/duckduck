-- Fix the trigger with correct column order

-- ========================================
-- STEP 1: CHECK ACTUAL TENANTS TABLE STRUCTURE
-- ========================================

SELECT 'CHECKING TENANTS TABLE STRUCTURE' as step;
SELECT 
    column_name,
    ordinal_position,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tenants'
ORDER BY ordinal_position;

-- ========================================
-- STEP 2: DROP AND RECREATE WITH CORRECT COLUMNS
-- ========================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

-- Create function with explicit column names
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID := '11111111-1111-1111-1111-111111111111';
    new_tenant_id UUID;
    company_name TEXT;
BEGIN
    -- Log for debugging
    RAISE NOTICE 'Trigger fired for user: %', NEW.email;
    
    -- Get company name from metadata or use default
    company_name := COALESCE(
        NEW.raw_user_meta_data->>'company_name',
        split_part(NEW.email, '@', 2) -- Use domain as company name
    );
    
    -- Create or get tenant
    BEGIN
        -- Try to create new tenant with explicit column names
        INSERT INTO public.tenants (company_name, plan, is_active)
        VALUES (
            company_name,
            'basic',
            true
        )
        RETURNING id INTO new_tenant_id;
        
        RAISE NOTICE 'Created new tenant: %', new_tenant_id;
    EXCEPTION WHEN OTHERS THEN
        -- If tenant creation fails, use default
        RAISE NOTICE 'Tenant creation failed: %, using default tenant', SQLERRM;
        new_tenant_id := default_tenant_id;
        
        -- Ensure default tenant exists (with explicit column names)
        INSERT INTO public.tenants (id, company_name, plan, is_active)
        VALUES (default_tenant_id, 'Default Company', 'basic', true)
        ON CONFLICT (id) DO NOTHING;
    END;
    
    -- Create user profile
    BEGIN
        INSERT INTO public.user_profiles (
            id, 
            tenant_id, 
            email, 
            first_name, 
            last_name, 
            role, 
            is_active
        )
        VALUES (
            NEW.id,
            new_tenant_id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
            'admin',
            true
        );
        
        RAISE NOTICE 'Created user profile for: %', NEW.email;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to create user profile: %', SQLERRM;
        -- Don't fail the entire signup
    END;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ========================================
-- STEP 3: CREATE DEFAULT TENANT WITH CORRECT COLUMNS
-- ========================================

-- First, let's see what columns we actually have
\d tenants

-- Create default tenant with explicit column names
INSERT INTO public.tenants (id, company_name, plan, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Default Company', 'basic', true)
ON CONFLICT (id) DO UPDATE 
SET company_name = EXCLUDED.company_name;

-- ========================================
-- STEP 4: FIX EXISTING USERS
-- ========================================

-- Create profiles for all existing users who don't have one
INSERT INTO public.user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
SELECT 
    au.id,
    '11111111-1111-1111-1111-111111111111'::UUID,
    au.email,
    COALESCE(au.raw_user_meta_data->>'first_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'last_name', 'User'),
    'admin',
    true
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STEP 5: VERIFY
-- ========================================

SELECT 'ALL USERS WITH PROFILES' as step;
SELECT 
    au.email,
    up.first_name,
    up.last_name,
    t.company_name,
    up.role
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
LEFT JOIN tenants t ON up.tenant_id = t.id
ORDER BY au.created_at DESC;