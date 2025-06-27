-- Fix based on the ACTUAL schema you provided

-- ========================================
-- STEP 1: CREATE DEFAULT TENANT WITH ALL REQUIRED FIELDS
-- ========================================

INSERT INTO tenants (
    id, 
    company_name, 
    subscription_status,
    subdomain,
    plan, 
    is_active,
    name
)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Default Company',
    'active',  -- This was missing!
    'default',
    'basic', 
    true,
    'Default Company'
)
ON CONFLICT (id) DO UPDATE 
SET 
    company_name = EXCLUDED.company_name,
    subscription_status = EXCLUDED.subscription_status,
    name = EXCLUDED.name;

-- ========================================
-- STEP 2: CREATE USER PROFILES FOR ALL EXISTING USERS
-- ========================================

-- Create profiles for all users that don't have one
INSERT INTO user_profiles (
    id, 
    tenant_id, 
    email, 
    first_name, 
    last_name, 
    role, 
    is_active
)
SELECT 
    u.id,
    '11111111-1111-1111-1111-111111111111'::UUID,
    u.email,
    COALESCE(u.raw_user_meta_data->>'first_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'last_name', 'User'),
    'admin',
    true
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STEP 3: CREATE PROPER SIGNUP TRIGGER
-- ========================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

-- Create function that matches your actual schema
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_tenant_id UUID;
    tenant_name TEXT;
BEGIN
    -- Get company name from metadata
    tenant_name := COALESCE(
        NEW.raw_user_meta_data->>'company_name',
        split_part(NEW.email, '@', 2)
    );
    
    -- Create tenant with ALL required fields
    INSERT INTO public.tenants (
        company_name, 
        subscription_status,
        subdomain,
        plan, 
        is_active,
        name
    )
    VALUES (
        tenant_name,
        'active',  -- Required field!
        LOWER(REGEXP_REPLACE(tenant_name, '[^a-z0-9]', '', 'g')),
        'basic', 
        true,
        tenant_name
    )
    RETURNING id INTO new_tenant_id;
    
    -- Create user profile
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
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'Signup trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ========================================
-- STEP 4: VERIFY ALL USERS HAVE PROFILES
-- ========================================

SELECT 'VERIFICATION: ALL USERS WITH PROFILES' as status;
SELECT 
    u.email,
    p.first_name,
    p.last_name,
    t.company_name,
    t.subscription_status,
    p.role
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
JOIN tenants t ON p.tenant_id = t.id
ORDER BY u.created_at DESC;

-- Check for any remaining users without profiles
SELECT 'USERS STILL MISSING PROFILES' as status;
SELECT 
    u.id,
    u.email,
    'NO PROFILE' as issue
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- ========================================
-- STEP 5: SHOW TENANTS TABLE
-- ========================================

SELECT 'ALL TENANTS' as status;
SELECT 
    id,
    company_name,
    subscription_status,
    subdomain,
    plan,
    is_active
FROM tenants
ORDER BY created_at DESC;