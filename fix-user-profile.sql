-- First, check if the user exists in auth.users
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_profile_exists BOOLEAN;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'bosmith@l7motors.com'
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found in auth.users';
        RETURN;
    END IF;
    
    -- Check if profile already exists
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles WHERE id = v_user_id
    ) INTO v_profile_exists;
    
    IF v_profile_exists THEN
        RAISE NOTICE 'User profile already exists for user ID: %', v_user_id;
        RETURN;
    END IF;
    
    -- Get or create a tenant (you might need to adjust this based on your needs)
    -- First try to find an existing tenant
    SELECT id INTO v_tenant_id
    FROM public.tenants
    WHERE name LIKE '%L7%' OR company_name LIKE '%L7%'
    LIMIT 1;
    
    -- If no tenant found, create a default one
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, company_name)
        VALUES ('L7 Motors', 'L7 Motors')
        RETURNING id INTO v_tenant_id;
    END IF;
    
    -- Create the user profile
    INSERT INTO public.user_profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        role_name,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        v_tenant_id,
        'bosmith@l7motors.com',
        'Bo',
        'Smith',
        'admin',
        'owner',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'User profile created successfully for user ID: %', v_user_id;
END $$;

-- Verify the profile was created
SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.role_name,
    t.name as tenant_name
FROM user_profiles up
JOIN tenants t ON up.tenant_id = t.id
WHERE up.email = 'bosmith@l7motors.com';