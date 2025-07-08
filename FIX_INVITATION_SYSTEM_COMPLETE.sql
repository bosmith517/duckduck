-- Complete fix for the invitation system
-- This implements all missing pieces for invitations to work properly

-- 1. First, let's create the missing accept_team_invitation function
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_invitation_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation record;
    v_user_id uuid;
    v_auth_user record;
BEGIN
    -- Find the invitation
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE id = p_invitation_token
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired invitation token'
        );
    END IF;
    
    -- Get the current auth user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You must be logged in to accept an invitation'
        );
    END IF;
    
    -- Check if user email matches invitation email
    SELECT * INTO v_auth_user
    FROM auth.users
    WHERE id = v_user_id;
    
    IF v_auth_user.email != v_invitation.email THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This invitation is for a different email address'
        );
    END IF;
    
    -- Update the existing user profile with the auth user id
    UPDATE user_profiles
    SET 
        id = v_user_id,
        is_active = true,
        updated_at = NOW()
    WHERE email = v_invitation.email
    AND tenant_id = v_invitation.tenant_id;
    
    -- Mark invitation as accepted
    UPDATE team_invitations
    SET 
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by = v_user_id
    WHERE id = p_invitation_token;
    
    -- Return success with user info
    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'tenant_id', v_invitation.tenant_id,
        'email', v_invitation.email,
        'role', v_invitation.role
    );
END;
$$;

-- 2. Create a function to send invitation email (called from Edge Function)
CREATE OR REPLACE FUNCTION public.send_team_invitation_email(
    p_email text,
    p_tenant_id uuid,
    p_invited_by uuid,
    p_role text,
    p_first_name text DEFAULT NULL,
    p_last_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation_id uuid;
    v_tenant record;
    v_inviter record;
    v_existing_user uuid;
BEGIN
    -- Check if caller has permission
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = p_invited_by
        AND tenant_id = p_tenant_id
        AND role IN ('admin', 'manager', 'supervisor')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized: You do not have permission to send invitations'
        );
    END IF;
    
    -- Check if user already exists in this tenant
    SELECT id INTO v_existing_user
    FROM user_profiles
    WHERE email = p_email
    AND tenant_id = p_tenant_id;
    
    IF v_existing_user IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'A user with this email already exists in your organization'
        );
    END IF;
    
    -- Get tenant info
    SELECT * INTO v_tenant
    FROM tenants
    WHERE id = p_tenant_id;
    
    -- Get inviter info
    SELECT * INTO v_inviter
    FROM user_profiles
    WHERE id = p_invited_by;
    
    -- Create invitation record
    INSERT INTO team_invitations (
        email,
        tenant_id,
        role,
        invited_by,
        expires_at,
        status
    ) VALUES (
        p_email,
        p_tenant_id,
        p_role,
        p_invited_by,
        NOW() + INTERVAL '7 days',
        'pending'
    ) RETURNING id INTO v_invitation_id;
    
    -- Create user profile (without auth user id yet)
    INSERT INTO user_profiles (
        id,
        email,
        tenant_id,
        role,
        first_name,
        last_name,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(), -- Temporary ID, will be updated when invitation accepted
        p_email,
        p_tenant_id,
        p_role,
        p_first_name,
        p_last_name,
        false, -- Not active until invitation accepted
        NOW(),
        NOW()
    ) ON CONFLICT (email, tenant_id) DO NOTHING;
    
    -- Return invitation details for Edge Function to send email
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', v_invitation_id,
        'email', p_email,
        'tenant_name', v_tenant.name,
        'inviter_name', COALESCE(v_inviter.first_name || ' ' || v_inviter.last_name, v_inviter.email),
        'role', p_role,
        'expires_at', NOW() + INTERVAL '7 days'
    );
END;
$$;

-- 3. Update the invite_team_member function to use the new flow
CREATE OR REPLACE FUNCTION public.invite_team_member(
    p_email text,
    p_role text,
    p_tenant_id uuid,
    p_first_name text DEFAULT NULL,
    p_last_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Call the send invitation function
    SELECT send_team_invitation_email(
        p_email,
        p_tenant_id,
        auth.uid(),
        p_role,
        p_first_name,
        p_last_name
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- 4. Create a function to resend invitations
CREATE OR REPLACE FUNCTION public.resend_team_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation record;
    v_tenant record;
    v_inviter record;
BEGIN
    -- Get invitation
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE id = p_invitation_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invitation not found or already accepted'
        );
    END IF;
    
    -- Check permission
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND tenant_id = v_invitation.tenant_id
        AND role IN ('admin', 'manager', 'supervisor')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized'
        );
    END IF;
    
    -- Update expiry
    UPDATE team_invitations
    SET expires_at = NOW() + INTERVAL '7 days'
    WHERE id = p_invitation_id;
    
    -- Get additional info for email
    SELECT * INTO v_tenant FROM tenants WHERE id = v_invitation.tenant_id;
    SELECT * INTO v_inviter FROM user_profiles WHERE id = v_invitation.invited_by;
    
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', p_invitation_id,
        'email', v_invitation.email,
        'tenant_name', v_tenant.name,
        'inviter_name', COALESCE(v_inviter.first_name || ' ' || v_inviter.last_name, v_inviter.email),
        'role', v_invitation.role,
        'expires_at', NOW() + INTERVAL '7 days'
    );
END;
$$;

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_team_invitation_email(text, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_team_invitation(uuid) TO authenticated;

-- 6. Add RLS policies for team_invitations table
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Allow users to view invitations for their email or their tenant
CREATE POLICY "Users can view relevant invitations" ON team_invitations
    FOR SELECT
    USING (
        email = auth.jwt()->>'email' OR
        tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

-- Allow authorized users to create invitations
CREATE POLICY "Authorized users can create invitations" ON team_invitations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND tenant_id = team_invitations.tenant_id
            AND role IN ('admin', 'manager', 'supervisor')
        )
    );

-- Allow users to update their own invitations
CREATE POLICY "Users can update their invitations" ON team_invitations
    FOR UPDATE
    USING (email = auth.jwt()->>'email')
    WITH CHECK (email = auth.jwt()->>'email');

SELECT 'Invitation system functions created successfully!' as status;