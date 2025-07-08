-- Create the function to send password reset emails for team members
-- This function allows admins to send password reset emails to their team members

CREATE OR REPLACE FUNCTION public.send_password_reset_for_profile(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile record;
    v_admin_tenant_id uuid;
    v_admin_role text;
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
    
    -- Get the auth user ID
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        -- User exists in profiles but not in auth - create auth user
        -- This handles cases where profile was created but auth user wasn't
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User account not fully set up. Please contact support.'
        );
    END IF;
    
    -- Log the password reset request
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_at,
        tenant_id
    ) VALUES (
        v_profile.id,
        auth.uid(),
        NOW(),
        v_admin_tenant_id
    );
    
    -- Queue the email for sending
    -- Note: The actual email sending will be handled by your email service
    INSERT INTO email_queue (
        id,
        to_email,
        subject,
        body,
        body_html,
        template_id,
        template_data,
        status,
        created_at,
        tenant_id
    ) VALUES (
        gen_random_uuid(),
        p_email,
        'Reset Your TradeWorks Pro Password',
        'An administrator has requested a password reset for your account. Please check your email for instructions.',
        '<p>An administrator has requested a password reset for your account. Please check your email for instructions.</p>',
        'password-reset',
        jsonb_build_object(
            'user_name', COALESCE(v_profile.first_name, 'User'),
            'admin_name', (SELECT first_name || ' ' || last_name FROM user_profiles WHERE id = auth.uid()),
            'reset_url', 'https://tradeworkspro.com/auth/reset-password?email=' || p_email
        ),
        'pending',
        NOW(),
        v_admin_tenant_id
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset email queued for sending',
        'user_id', v_profile.id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.send_password_reset_for_profile(text) TO authenticated;

-- Create the password_reset_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS password_reset_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id),
    requested_by UUID REFERENCES user_profiles(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reset_at TIMESTAMPTZ,
    tenant_id UUID REFERENCES tenants(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_user_id ON password_reset_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_tenant_id ON password_reset_logs(tenant_id);

-- Add RLS policies for password_reset_logs
ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see password reset logs for their tenant
CREATE POLICY "tenant_isolation" ON password_reset_logs
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- Alternative: Use Supabase Auth's built-in password reset
-- This function triggers Supabase's own password reset email
CREATE OR REPLACE FUNCTION public.send_password_reset_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile record;
    v_admin_tenant_id uuid;
    v_admin_role text;
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
    
    -- Verify the user is in the same tenant
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
    
    -- Note: The actual password reset email will be sent by Supabase Auth
    -- when the frontend calls supabase.auth.resetPasswordForEmail()
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset can be initiated',
        'email', p_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_password_reset_email(text) TO authenticated;

SELECT 'Password reset functions created successfully!' as status;