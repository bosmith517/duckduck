-- Fix based on your ACTUAL database structure (not the schema files)

-- ========================================
-- STEP 1: CHECK WHAT'S ACTUALLY IN YOUR DB
-- ========================================

SELECT 'ACTUAL TENANTS TABLE STRUCTURE' as check;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tenants'
ORDER BY ordinal_position;

-- ========================================
-- STEP 2: FIX THE SCHEMA MISMATCH
-- ========================================

-- It seems your DB has 'company_name' but the code expects 'name'
-- Let's add the 'name' column if it doesn't exist and copy data
DO $$ 
BEGIN
    -- Check if 'name' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'name') THEN
        -- Add the 'name' column
        ALTER TABLE tenants ADD COLUMN name VARCHAR(100);
        
        -- Copy data from company_name to name
        UPDATE tenants SET name = company_name WHERE name IS NULL;
        
        -- Make it NOT NULL after copying data
        ALTER TABLE tenants ALTER COLUMN name SET NOT NULL;
    END IF;
END $$;

-- ========================================
-- STEP 3: CREATE DEFAULT TENANT (works with either column)
-- ========================================

INSERT INTO tenants (id, name, company_name, plan, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Default Company',
    'Default Company',
    'basic', 
    true
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    company_name = EXCLUDED.company_name;

-- ========================================
-- STEP 4: CREATE USER PROFILES FOR EXISTING USERS
-- ========================================

-- Create profiles for all users that don't have one
WITH users_without_profiles AS (
    SELECT 
        u.id,
        u.email,
        u.raw_user_meta_data->>'first_name' as first_name,
        u.raw_user_meta_data->>'last_name' as last_name
    FROM auth.users u
    LEFT JOIN user_profiles p ON u.id = p.id
    WHERE p.id IS NULL
)
INSERT INTO user_profiles (id, tenant_id, email, first_name, last_name, role, is_active)
SELECT 
    id,
    '11111111-1111-1111-1111-111111111111'::UUID,
    email,
    COALESCE(first_name, split_part(email, '@', 1)),
    COALESCE(last_name, 'User'),
    'admin',
    true
FROM users_without_profiles;

-- ========================================
-- STEP 5: UPDATE SIGNUP CODE TO HANDLE BOTH
-- ========================================

-- Drop and recreate the trigger to handle both column names
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_signup();

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
    
    -- Create tenant with both columns for compatibility
    INSERT INTO public.tenants (name, company_name, plan, is_active)
    VALUES (tenant_name, tenant_name, 'basic', true)
    RETURNING id INTO new_tenant_id;
    
    -- Create user profile
    INSERT INTO public.user_profiles (
        id, tenant_id, email, first_name, last_name, role, is_active
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

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();

-- ========================================
-- STEP 6: VERIFY EVERYTHING
-- ========================================

SELECT 'USERS WITH PROFILES' as status;
SELECT 
    u.email,
    p.first_name,
    p.last_name,
    COALESCE(t.name, t.company_name) as company,
    p.role
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
JOIN tenants t ON p.tenant_id = t.id
ORDER BY u.created_at DESC;

SELECT 'USERS STILL MISSING PROFILES' as status;
SELECT COUNT(*) as missing_count
FROM auth.users u
LEFT JOIN user_profiles p ON u.id = p.id
WHERE p.id IS NULL;