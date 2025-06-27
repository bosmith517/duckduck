-- Create a proper signup function that handles tenant and profile creation
-- This is the standard approach for multi-tenant Supabase applications

-- ========================================
-- STEP 1: CREATE THE SIGNUP FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Extract metadata from the user record
    -- The metadata comes from the signUp options.data parameter
    
    -- Create a new tenant for this user
    INSERT INTO public.tenants (name, subdomain, plan, is_active)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'),
        LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'company_name', 'company'), ' ', '')),
        'basic',
        true
    )
    RETURNING id INTO new_tenant_id;
    
    -- Create the user profile with the new tenant
    INSERT INTO public.user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
    VALUES (
        NEW.id,
        new_tenant_id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', 'First'),
        COALESCE(NEW.raw_user_meta_data->>'last_name', 'Last'),
        'admin', -- First user is always admin
        true
    );
    
    RETURN NEW;
END;
$$;

-- ========================================
-- STEP 2: CREATE THE TRIGGER
-- ========================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after a new user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ========================================
-- STEP 3: GRANT NECESSARY PERMISSIONS
-- ========================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;

-- ========================================
-- STEP 4: TEST THE FUNCTION
-- ========================================

-- Show that the function and trigger exist
SELECT 'SIGNUP FUNCTION CREATED SUCCESSFULLY' as status;

SELECT 
    routine_name,
    routine_type,
    routine_schema
FROM information_schema.routines
WHERE routine_name = 'handle_new_user_signup';

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ========================================
-- STEP 5: CLEANUP ANY EXISTING ORPHANED USERS
-- ========================================

-- Check for auth users without profiles
SELECT 
    'AUTH USERS WITHOUT PROFILES' as check_type,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.created_at DESC;

-- ========================================
-- NOTES
-- ========================================

-- This approach is used by most multi-tenant Supabase applications because:
-- 1. It runs with SECURITY DEFINER, bypassing RLS during signup
-- 2. It's triggered automatically when a user signs up
-- 3. It ensures tenant and profile are created atomically
-- 4. It works with the standard Supabase auth flow

-- After running this, new signups will automatically create tenants and profiles!