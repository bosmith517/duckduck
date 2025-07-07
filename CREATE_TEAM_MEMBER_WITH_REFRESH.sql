-- Enhanced team member creation function that handles materialized view refresh
-- This ensures new team members can immediately access the system

-- 1. Drop the old function if it exists
DROP FUNCTION IF EXISTS public.create_team_member(text, text, text, text);

-- 2. Create the enhanced function
CREATE OR REPLACE FUNCTION public.create_team_member(
    p_email text,
    p_first_name text,
    p_last_name text,
    p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_tenant_id uuid;
    v_result jsonb;
BEGIN
    -- Get the tenant_id of the current user
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Could not determine tenant'
        );
    END IF;
    
    -- Generate a new UUID for the user
    v_user_id := gen_random_uuid();
    
    -- Create the user profile
    INSERT INTO user_profiles (
        id,
        email,
        first_name,
        last_name,
        role,
        tenant_id,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_email,
        p_first_name,
        p_last_name,
        p_role,
        v_tenant_id,
        now(),
        now()
    );
    
    -- CRITICAL: Refresh the materialized view so the new user has access
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
    
    -- Return success with the new user's ID
    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', p_email,
        'message', 'Team member created successfully. They can now set their password.'
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A user with this email already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_team_member(text, text, text, text) TO authenticated;

-- 4. Create a helper function to manually refresh the cache when needed
CREATE OR REPLACE FUNCTION public.refresh_tenant_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_tenant_cache() TO authenticated;

-- 5. Update the create_team_member_with_auth function similarly
DROP FUNCTION IF EXISTS public.create_team_member_with_auth(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_team_member_with_auth(
    p_email text,
    p_first_name text,
    p_last_name text,
    p_role text,
    p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_result jsonb;
BEGIN
    -- Get the tenant_id of the current user
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Could not determine tenant'
        );
    END IF;
    
    -- Create the user profile with the provided auth user ID
    INSERT INTO user_profiles (
        id,
        email,
        first_name,
        last_name,
        role,
        tenant_id,
        created_at,
        updated_at
    ) VALUES (
        p_auth_user_id,
        p_email,
        p_first_name,
        p_last_name,
        p_role,
        v_tenant_id,
        now(),
        now()
    );
    
    -- CRITICAL: Refresh the materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
    
    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_auth_user_id,
        'email', p_email,
        'message', 'Team member created successfully'
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A user with this email already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_member_with_auth(text, text, text, text, uuid) TO authenticated;

-- 6. Test the current state
SELECT 'Team member functions updated with automatic cache refresh!' as status;

-- Show current cache contents
SELECT 
    COUNT(*) as cached_users,
    COUNT(DISTINCT tenant_id) as tenant_count
FROM public.tenant_lookup_cache;