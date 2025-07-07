-- Fix the invitation flow to handle users who have auth records but no profile
-- This handles the case where users click invitation links

-- 1. First add the missing columns to team_invitations
ALTER TABLE team_invitations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id);

-- Update existing rows to have status
UPDATE team_invitations 
SET status = CASE 
    WHEN accepted_at IS NOT NULL THEN 'accepted'
    WHEN expires_at < NOW() THEN 'expired'
    ELSE 'pending'
END
WHERE status IS NULL;

-- 2. Create a function to handle invitation acceptance
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
    p_invitation_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation record;
    v_user_id uuid;
    v_existing_profile boolean;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated'
        );
    END IF;
    
    -- Find the invitation
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE token = p_invitation_token
    AND status = 'pending'
    AND expires_at > now()
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid or expired invitation'
        );
    END IF;
    
    -- Check if user profile already exists
    SELECT EXISTS(
        SELECT 1 FROM user_profiles WHERE id = v_user_id
    ) INTO v_existing_profile;
    
    IF NOT v_existing_profile THEN
        -- Create the user profile with invitation details
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
            v_invitation.email,
            COALESCE(v_invitation.first_name, split_part(v_invitation.email, '@', 1)),
            COALESCE(v_invitation.last_name, ''),
            COALESCE(v_invitation.role, 'agent'),
            v_invitation.tenant_id,
            now(),
            now()
        );
        
        -- Refresh the materialized view
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
    END IF;
    
    -- Update the invitation status
    UPDATE team_invitations
    SET 
        status = 'accepted',
        accepted_at = now(),
        accepted_by = v_user_id
    WHERE id = v_invitation.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', v_invitation.tenant_id,
        'role', v_invitation.role,
        'message', 'Invitation accepted successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

-- 3. Create a function to auto-create profile on first login
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_email text;
    v_user_metadata jsonb;
    v_profile_exists boolean;
    v_invitation record;
BEGIN
    -- Get current user info
    v_user_id := auth.uid();
    v_email := auth.jwt() ->> 'email';
    v_user_metadata := auth.jwt() -> 'user_metadata';
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not authenticated'
        );
    END IF;
    
    -- Check if profile exists
    SELECT EXISTS(
        SELECT 1 FROM user_profiles WHERE id = v_user_id
    ) INTO v_profile_exists;
    
    IF v_profile_exists THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Profile already exists'
        );
    END IF;
    
    -- Try to find an invitation for this email (pending)
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE email = v_email
    AND status = 'pending'
    AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- User has a pending invitation, they should use the invitation flow
        RETURN jsonb_build_object(
            'success', false,
            'error', 'pending_invitation',
            'message', 'Please use your invitation link to join'
        );
    END IF;
    
    -- Check if this email was previously invited (accepted invitation)
    SELECT * INTO v_invitation
    FROM team_invitations
    WHERE email = v_email
    AND status = 'accepted'
    ORDER BY accepted_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Create profile from accepted invitation
        INSERT INTO user_profiles (
            id,
            email,
            first_name,
            last_name,
            role,
            tenant_id,
            created_at,
            updated_at
        )
        VALUES (
            v_user_id,
            v_email,
            COALESCE(v_invitation.first_name, split_part(v_email, '@', 1)),
            COALESCE(v_invitation.last_name, ''),
            COALESCE(v_invitation.role, 'agent'),
            v_invitation.tenant_id,
            now(),
            now()
        );
        
        -- Refresh the materialized view
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Profile created from invitation'
        );
    END IF;
    
    -- No invitation found, cannot create profile
    RETURN jsonb_build_object(
        'success', false,
        'error', 'no_invitation',
        'message', 'No valid invitation found for this email'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- 4. Create an index for faster invitation lookups
CREATE INDEX IF NOT EXISTS idx_team_invitations_email_status 
ON team_invitations(email, status) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_invitations_token 
ON team_invitations(token) 
WHERE status = 'pending';

SELECT 'Invitation flow fixes applied!' as status;