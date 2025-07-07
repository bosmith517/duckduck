-- Add functions to allow admins to send password reset emails to team members

-- 1. Function for admins to send password reset email
CREATE OR REPLACE FUNCTION admin_send_password_reset(p_user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_admin_role TEXT;
    v_admin_tenant UUID;
    v_target_user RECORD;
    v_reset_token TEXT;
BEGIN
    -- Check if caller is admin
    SELECT role, tenant_id INTO v_admin_role, v_admin_tenant
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF v_admin_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient permissions. Only admins can send password resets.'
        );
    END IF;
    
    -- Find target user in same tenant
    SELECT 
        up.id,
        up.email,
        up.first_name,
        up.last_name,
        up.tenant_id,
        t.company_name,
        au.id as auth_id,
        au.email as auth_email
    INTO v_target_user
    FROM user_profiles up
    LEFT JOIN tenants t ON t.id = up.tenant_id
    LEFT JOIN auth.users au ON au.id = up.id
    WHERE up.email = p_user_email
    AND up.tenant_id = v_admin_tenant
    LIMIT 1;
    
    IF v_target_user.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found in your organization'
        );
    END IF;
    
    -- Check if user has auth account
    IF v_target_user.auth_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User does not have an auth account. Send them an invitation instead.',
            'needs_invitation', true,
            'profile_id', v_target_user.id
        );
    END IF;
    
    -- Generate reset token for tracking
    v_reset_token := encode(gen_random_bytes(32), 'hex');
    
    -- Log the password reset request
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_for_email,
        token,
        tenant_id,
        created_at
    ) VALUES (
        v_target_user.auth_id,
        auth.uid(),
        v_target_user.email,
        v_reset_token,
        v_admin_tenant,
        NOW()
    );
    
    -- Queue email for password reset
    INSERT INTO email_queue (
        to_email,
        subject,
        body,
        template_id,
        template_data,
        scheduled_for
    ) VALUES (
        v_target_user.email,
        'Password Reset Request - ' || COALESCE(v_target_user.company_name, 'Your Account'),
        'Your administrator has requested a password reset for your account.',
        'admin_password_reset',
        json_build_object(
            'first_name', v_target_user.first_name,
            'company_name', v_target_user.company_name,
            'admin_name', (
                SELECT first_name || ' ' || last_name 
                FROM user_profiles 
                WHERE id = auth.uid()
            ),
            'reset_link', format('https://%s/auth/reset-password?token=%s', 
                current_setting('app.settings.app_url', true), v_reset_token)
        ),
        NOW()
    );
    
    -- Note: The actual password reset in Supabase Auth should be triggered
    -- This is just for tracking and custom email
    RETURN json_build_object(
        'success', true,
        'message', 'Password reset email queued',
        'email', v_target_user.email,
        'note', 'User will receive an email with reset instructions',
        'token', v_reset_token
    );
END;
$$;

-- 2. Function to send bulk password resets
CREATE OR REPLACE FUNCTION admin_send_bulk_password_resets(p_user_emails TEXT[])
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_admin_role TEXT;
    v_results JSONB[];
    v_email TEXT;
    v_result JSON;
BEGIN
    -- Check if caller is admin
    SELECT role INTO v_admin_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF v_admin_role NOT IN ('admin', 'manager') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Only admins and managers can send bulk password resets'
        );
    END IF;
    
    -- Process each email
    FOREACH v_email IN ARRAY p_user_emails
    LOOP
        v_result := admin_send_password_reset(v_email);
        v_results := array_append(v_results, json_build_object(
            'email', v_email,
            'result', v_result
        )::jsonb);
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'results', v_results,
        'total', array_length(p_user_emails, 1),
        'successful', (
            SELECT COUNT(*) 
            FROM unnest(v_results) r 
            WHERE (r->>'result')::json->>'success' = 'true'
        )
    );
END;
$$;

-- 3. Create password reset logs table
CREATE TABLE IF NOT EXISTS password_reset_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    requested_by UUID REFERENCES user_profiles(id),
    requested_for_email TEXT NOT NULL,
    token TEXT,
    tenant_id UUID REFERENCES tenants(id),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "admins_view_reset_logs" ON password_reset_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            AND tenant_id = password_reset_logs.tenant_id
        )
    );

CREATE POLICY "users_view_own_reset_logs" ON password_reset_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- 4. Function to trigger Supabase Auth password reset
-- This integrates with Supabase's built-in auth system
CREATE OR REPLACE FUNCTION trigger_auth_password_reset(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Needed to call auth functions
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'No auth user found with this email'
        );
    END IF;
    
    -- Note: Actual password reset email is sent by Supabase Auth
    -- This function is a placeholder for the integration
    -- In production, you would use Supabase Admin API or Auth API
    
    RETURN json_build_object(
        'success', true,
        'message', 'Password reset process initiated',
        'note', 'Use Supabase Auth API or Admin Dashboard to send the actual reset email'
    );
END;
$$;

-- 5. View to see password reset history
CREATE OR REPLACE VIEW v_password_reset_history AS
SELECT 
    prl.id,
    prl.requested_for_email,
    prl.created_at,
    prl.used_at,
    CASE 
        WHEN prl.used_at IS NOT NULL THEN 'used'
        WHEN prl.created_at < NOW() - INTERVAL '24 hours' THEN 'expired'
        ELSE 'pending'
    END as status,
    requester.first_name || ' ' || requester.last_name as requested_by_name,
    target.first_name || ' ' || target.last_name as user_name
FROM password_reset_logs prl
LEFT JOIN user_profiles requester ON requester.id = prl.requested_by
LEFT JOIN user_profiles target ON target.id = prl.user_id;

-- Grant permissions
GRANT SELECT ON v_password_reset_history TO authenticated;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_send_password_reset(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_send_bulk_password_resets(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_auth_password_reset(TEXT) TO authenticated;

-- 7. Add helpful comments
COMMENT ON FUNCTION admin_send_password_reset IS 'Allows admins to send password reset emails to team members';
COMMENT ON FUNCTION admin_send_bulk_password_resets IS 'Send password resets to multiple users at once';
COMMENT ON TABLE password_reset_logs IS 'Tracks password reset requests initiated by admins';