-- Fix the admin_send_password_reset function that's causing permission errors

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.admin_send_password_reset(text);

-- Create a simpler function that doesn't try to access auth.users directly
CREATE OR REPLACE FUNCTION public.admin_send_password_reset(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile record;
    v_admin_tenant_id uuid;
    v_admin_role text;
    v_reset_log_id uuid;
BEGIN
    -- Get the admin's (caller's) tenant and role
    SELECT tenant_id, role INTO v_admin_tenant_id, v_admin_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Check if caller is an admin
    IF v_admin_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized. Only admins can send password reset emails.'
        );
    END IF;
    
    -- Get the user profile by email
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE email = p_email
    AND tenant_id = v_admin_tenant_id
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found in your organization'
        );
    END IF;
    
    -- Log the password reset request
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_for_email,
        requested_at,
        tenant_id,
        status
    ) VALUES (
        v_profile.id,
        auth.uid(),
        p_email,
        NOW(),
        v_admin_tenant_id,
        'pending'
    ) RETURNING id INTO v_reset_log_id;
    
    -- Return success - the frontend will handle the actual reset email
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset request logged. Frontend will send reset email.',
        'email', p_email,
        'user_id', v_profile.id,
        'log_id', v_reset_log_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.admin_send_password_reset(text) TO authenticated;

-- Also ensure send_password_reset_for_profile exists and works
CREATE OR REPLACE FUNCTION public.send_password_reset_for_profile(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile record;
    v_admin_tenant_id uuid;
    v_admin_role text;
    v_reset_log_id uuid;
BEGIN
    -- Get the admin's (caller's) tenant and role
    SELECT tenant_id, role INTO v_admin_tenant_id, v_admin_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Check if caller is an admin
    IF v_admin_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized. Only admins can send password reset emails.'
        );
    END IF;
    
    -- Get the user profile by email
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE email = p_email
    AND tenant_id = v_admin_tenant_id
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found in your organization'
        );
    END IF;
    
    -- Log the password reset request
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_for_email,
        requested_at,
        tenant_id,
        status
    ) VALUES (
        v_profile.id,
        auth.uid(),
        p_email,
        NOW(),
        v_admin_tenant_id,
        'pending'
    ) RETURNING id INTO v_reset_log_id;
    
    -- Return success - the frontend will handle the actual reset email
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset can be initiated',
        'email', p_email,
        'log_id', v_reset_log_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_password_reset_for_profile(text) TO authenticated;

SELECT 'Password reset functions fixed!' as status;