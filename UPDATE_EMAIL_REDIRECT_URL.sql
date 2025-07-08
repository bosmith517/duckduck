-- Update Supabase Auth email templates to use correct redirect URLs
-- This needs to be run in Supabase Dashboard under Authentication > Email Templates

-- IMPORTANT: These are the email template configurations you need to update in Supabase Dashboard:

/*
1. Go to Supabase Dashboard > Authentication > Email Templates

2. Update the "Invite User" template:
   - Change the Redirect URL to: {{ .SiteURL }}/auth/callback
   - Or if using custom domain: https://app.tradeworkspro.com/auth/callback

3. Update the "Reset Password" template:
   - Change the Redirect URL to: {{ .SiteURL }}/auth/callback
   - Or if using custom domain: https://app.tradeworkspro.com/auth/callback

4. Make sure the email templates use the confirmation URL like:
   {{ .ConfirmationURL }}?redirect_to={{ .SiteURL }}/auth/callback

5. Alternative: Set the Site URL in Supabase Dashboard > Settings > Authentication
   - Set Site URL to: https://app.tradeworkspro.com
   - This will be used as the base for all redirects
*/

-- For now, let's create a function that generates the correct password reset URL
CREATE OR REPLACE FUNCTION public.get_password_reset_url(p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_site_url text;
BEGIN
    -- Get the site URL (you can hardcode this or make it configurable)
    v_site_url := 'https://app.tradeworkspro.com';
    
    -- Return the correct callback URL
    RETURN v_site_url || '/auth/callback';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_password_reset_url(text) TO authenticated;

-- Update the admin_send_password_reset function to return the correct redirect URL
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
    v_redirect_url text;
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
    
    -- Get the correct redirect URL
    v_redirect_url := public.get_password_reset_url(p_user_email);
    
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
    
    -- Return success with redirect URL for frontend to use
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset can be initiated',
        'email', p_user_email,
        'user_id', v_profile.id,
        'log_id', v_reset_log_id,
        'redirect_url', v_redirect_url
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

SELECT 'Email redirect configuration info created. Check comments for Supabase Dashboard settings!' as status;