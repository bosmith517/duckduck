-- Fix the admin_send_password_reset function with correct parameter name

-- Drop any existing functions with this name
DROP FUNCTION IF EXISTS public.admin_send_password_reset(text);

-- Create the function with the parameter name that frontend expects: p_user_email
CREATE OR REPLACE FUNCTION public.admin_send_password_reset(p_user_email text)
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
    WHERE email = p_user_email
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
        p_user_email,
        NOW(),
        v_admin_tenant_id,
        'pending'
    ) RETURNING id INTO v_reset_log_id;
    
    -- Return success - the frontend will handle the actual reset email
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset request logged. Frontend will send reset email.',
        'email', p_user_email,
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


SELECT 'Admin password reset function fixed with correct parameter name!' as status;