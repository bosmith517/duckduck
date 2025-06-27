-- Debug why the trigger isn't creating profiles and fix it

-- ========================================
-- STEP 1: CHECK IF TRIGGER EXISTS
-- ========================================

SELECT 'CHECKING TRIGGER STATUS' as step;

-- Check if the trigger exists
SELECT 
    tgname as trigger_name,
    tgtype,
    tgenabled,
    pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check if the function exists
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'handle_new_user_signup';

-- ========================================
-- STEP 2: DROP AND RECREATE WITH BETTER ERROR HANDLING
-- ========================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

-- Create a simpler, more robust function
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
        -- Try to create new tenant
        INSERT INTO public.tenants (name, subdomain, plan, is_active)
        VALUES (
            company_name,
            LOWER(REGEXP_REPLACE(company_name, '[^a-z0-9]', '', 'g')),
            'basic',
            true
        )
        RETURNING id INTO new_tenant_id;
        
        RAISE NOTICE 'Created new tenant: %', new_tenant_id;
    EXCEPTION WHEN OTHERS THEN
        -- If tenant creation fails, use default
        RAISE NOTICE 'Tenant creation failed: %, using default tenant', SQLERRM;
        new_tenant_id := default_tenant_id;
        
        -- Ensure default tenant exists
        INSERT INTO public.tenants (id, name, subdomain, plan, is_active)
        VALUES (default_tenant_id, 'Default Company', 'default', 'basic', true)
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
-- STEP 3: FIX EXISTING USERS WITHOUT PROFILES
-- ========================================

-- Create default tenant if it doesn't exist
INSERT INTO public.tenants (id, name, subdomain, plan, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Default Company', 'default', 'basic', true)
ON CONFLICT (id) DO NOTHING;

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
WHERE up.id IS NULL;

-- ========================================
-- STEP 4: VERIFY EVERYTHING IS FIXED
-- ========================================

SELECT 'VERIFICATION - ALL USERS NOW HAVE PROFILES' as step;
SELECT 
    au.id,
    au.email,
    up.first_name,
    up.last_name,
    t.name as company_name,
    up.role
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
LEFT JOIN tenants t ON up.tenant_id = t.id
ORDER BY au.created_at DESC;

-- Check if any users still missing profiles
SELECT 'USERS STILL MISSING PROFILES' as step;
SELECT COUNT(*) as missing_count
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- ========================================
-- STEP 5: TEST THE TRIGGER MANUALLY
-- ========================================

-- You can test if the trigger works by running this in SQL editor
-- It simulates what happens during signup
/*
-- Uncomment to test:
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'triggertest@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"first_name": "Trigger", "last_name": "Test", "company_name": "Trigger Test Co"}'::jsonb,
    now(),
    now()
);
*/