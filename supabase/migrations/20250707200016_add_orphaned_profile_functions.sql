-- Add functions to handle orphaned profiles (profiles without auth accounts)

-- 1. Function to send invitation for orphaned profile
CREATE OR REPLACE FUNCTION send_invitation_to_orphaned_profile(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile RECORD;
    v_token TEXT;
    v_invitation_id UUID;
BEGIN
    -- Find the orphaned profile
    SELECT p.*, t.company_name 
    INTO v_profile
    FROM user_profiles p
    LEFT JOIN tenants t ON t.id = p.tenant_id
    WHERE p.email = p_email
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p.id)
    LIMIT 1;
    
    IF v_profile.id IS NULL THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'No orphaned profile found with this email'
        );
    END IF;
    
    -- Check if user already has auth account (by email)
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'An auth account already exists with this email. Contact support.',
            'profile_id', v_profile.id
        );
    END IF;
    
    -- Generate invitation token
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Create invitation record
    INSERT INTO team_invitations (
        profile_id,
        email,
        tenant_id,
        invited_by,
        invitation_message,
        token,
        expires_at
    ) VALUES (
        v_profile.id,
        v_profile.email,
        v_profile.tenant_id,
        auth.uid(), -- Current user sending the invitation
        'Please complete your account setup to access the system',
        v_token,
        NOW() + INTERVAL '7 days'
    ) RETURNING id INTO v_invitation_id;
    
    -- Queue email
    INSERT INTO email_queue (
        to_email,
        subject,
        body,
        template_id,
        template_data,
        scheduled_for
    ) VALUES (
        v_profile.email,
        'Complete your ' || COALESCE(v_profile.company_name, 'account') || ' setup',
        'You have been invited to complete your account setup.',
        'complete_account_setup',
        json_build_object(
            'first_name', v_profile.first_name,
            'company_name', v_profile.company_name,
            'setup_link', format('https://%s/auth/complete-setup?token=%s', 
                current_setting('app.settings.app_url', true), v_token),
            'expires_in_days', 7
        ),
        NOW()
    );
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invitation sent successfully',
        'invitation_id', v_invitation_id,
        'profile_id', v_profile.id,
        'email', v_profile.email
    );
END;
$$;

-- 2. Function to complete account setup (called from auth flow)
CREATE OR REPLACE FUNCTION complete_orphaned_profile_setup(
    p_token TEXT,
    p_auth_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Needed to update profile ID
AS $$
DECLARE
    v_invitation RECORD;
    v_profile RECORD;
BEGIN
    -- Find valid invitation
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE token = p_token
    AND expires_at > NOW()
    AND accepted_at IS NULL
    LIMIT 1;
    
    IF v_invitation.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid or expired invitation'
        );
    END IF;
    
    -- Get the profile
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE id = v_invitation.profile_id;
    
    IF v_profile.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Profile not found'
        );
    END IF;
    
    -- Update the profile to use the new auth user's ID
    UPDATE user_profiles
    SET 
        id = p_auth_user_id,
        updated_at = NOW()
    WHERE id = v_invitation.profile_id;
    
    -- Mark invitation as accepted
    UPDATE team_invitations
    SET accepted_at = NOW()
    WHERE id = v_invitation.id;
    
    -- Log the action
    INSERT INTO system_logs (
        action,
        details,
        user_id
    ) VALUES (
        'orphaned_profile_linked',
        json_build_object(
            'old_profile_id', v_invitation.profile_id,
            'new_auth_id', p_auth_user_id,
            'email', v_profile.email,
            'invitation_id', v_invitation.id
        ),
        p_auth_user_id
    );
    
    RETURN json_build_object(
        'success', true,
        'message', 'Account setup completed',
        'tenant_id', v_profile.tenant_id,
        'role', v_profile.role
    );
END;
$$;

-- 3. Function to check invitation status
CREATE OR REPLACE FUNCTION check_invitation_status(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_invitation RECORD;
    v_profile RECORD;
BEGIN
    -- Find invitation
    SELECT 
        i.*,
        p.first_name,
        p.last_name,
        p.email as profile_email,
        t.company_name
    INTO v_invitation
    FROM team_invitations i
    JOIN user_profiles p ON p.id = i.profile_id
    LEFT JOIN tenants t ON t.id = i.tenant_id
    WHERE i.token = p_token
    LIMIT 1;
    
    IF v_invitation.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invalid invitation token'
        );
    END IF;
    
    -- Check if expired
    IF v_invitation.expires_at < NOW() THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invitation has expired',
            'expired_at', v_invitation.expires_at
        );
    END IF;
    
    -- Check if already accepted
    IF v_invitation.accepted_at IS NOT NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Invitation has already been accepted',
            'accepted_at', v_invitation.accepted_at
        );
    END IF;
    
    -- Return invitation details
    RETURN json_build_object(
        'success', true,
        'invitation', json_build_object(
            'email', v_invitation.email,
            'first_name', v_invitation.first_name,
            'last_name', v_invitation.last_name,
            'company_name', v_invitation.company_name,
            'expires_at', v_invitation.expires_at
        )
    );
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION send_invitation_to_orphaned_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_orphaned_profile_setup(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_invitation_status(TEXT) TO anon, authenticated;

-- 5. Add helpful view for admins to see invitation status
CREATE OR REPLACE VIEW v_team_invitations AS
SELECT 
    i.id,
    i.email,
    i.token,
    i.created_at,
    i.expires_at,
    i.accepted_at,
    CASE 
        WHEN i.accepted_at IS NOT NULL THEN 'accepted'
        WHEN i.expires_at < NOW() THEN 'expired'
        ELSE 'pending'
    END as status,
    p.first_name || ' ' || p.last_name as invitee_name,
    inviter.first_name || ' ' || inviter.last_name as invited_by_name,
    t.company_name
FROM team_invitations i
LEFT JOIN user_profiles p ON p.id = i.profile_id
LEFT JOIN user_profiles inviter ON inviter.id = i.invited_by
LEFT JOIN tenants t ON t.id = i.tenant_id;

-- Grant access
GRANT SELECT ON v_team_invitations TO authenticated;

-- 6. Add RLS policy for the view to work
CREATE POLICY "users_see_tenant_invitations" ON team_invitations
    FOR SELECT
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Done! Now you can:
-- 1. See orphaned profiles in v_orphaned_profiles
-- 2. Send invitations using send_invitation_to_orphaned_profile()
-- 3. Check invitation status with check_invitation_status()
-- 4. Complete setup with complete_orphaned_profile_setup()
-- 5. View all invitations in v_team_invitations