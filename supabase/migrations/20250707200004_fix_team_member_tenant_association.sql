-- Fix team member creation to ensure they're added to existing tenant, not as new tenant owners
-- This migration fixes the issue where team members were getting their own tenant instead of joining existing one

-- 1. Update the create_team_member function to ensure proper tenant association
CREATE OR REPLACE FUNCTION create_team_member_safe(
    p_email TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_role TEXT,
    p_phone TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_employee_id TEXT DEFAULT NULL,
    p_hourly_rate DECIMAL DEFAULT NULL,
    p_salary DECIMAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_info RECORD;
    v_profile_id UUID;
    v_existing_profile UUID;
BEGIN
    -- Get current user's tenant and role using our helper function
    SELECT * INTO v_tenant_info FROM get_user_tenant_and_role();
    
    IF v_tenant_info.tenant_id IS NULL THEN
        RAISE EXCEPTION 'Current user has no tenant_id';
    END IF;
    
    -- Check if current user has permission to create team members
    IF v_tenant_info.user_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient permissions to create team members. Required: admin, manager, or supervisor';
    END IF;
    
    -- Validate the role being assigned
    IF p_role NOT IN ('admin', 'agent', 'viewer', 'manager', 'supervisor', 'technician', 'subcontractor', 'field_worker', 'dispatcher', 'estimator', 'sales', 'customer_service', 'accounting', 'marketing') THEN
        RAISE EXCEPTION 'Invalid role: %', p_role;
    END IF;
    
    -- Check if a user profile with this email already exists in ANY tenant
    SELECT id INTO v_existing_profile
    FROM user_profiles
    WHERE email = p_email
    LIMIT 1;
    
    -- If user exists, check if they're in a different tenant
    IF v_existing_profile IS NOT NULL THEN
        -- Check if they're already in the same tenant
        IF EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = v_existing_profile 
            AND tenant_id = v_tenant_info.tenant_id
        ) THEN
            RAISE EXCEPTION 'User with email % already exists in this tenant', p_email;
        ELSE
            RAISE EXCEPTION 'User with email % already exists in a different tenant. Cannot add to this tenant.', p_email;
        END IF;
    END IF;
    
    -- Generate a UUID for the new profile
    v_profile_id := gen_random_uuid();
    
    -- Insert the user profile with explicit tenant_id
    -- This creates a team member profile WITHOUT an auth user
    -- The auth user will be created later when they accept invitation
    INSERT INTO user_profiles (
        id,
        tenant_id,
        email,
        first_name,
        last_name,
        role,
        phone,
        department,
        employee_id,
        hourly_rate,
        salary,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_profile_id,
        v_tenant_info.tenant_id, -- CRITICAL: Use the creator's tenant_id
        p_email,
        p_first_name,
        p_last_name,
        p_role,
        p_phone,
        p_department,
        p_employee_id,
        p_hourly_rate,
        p_salary,
        true,
        NOW(),
        NOW()
    );
    
    RETURN v_profile_id;
END;
$$;

-- 2. Create a function to handle team member invitations
CREATE OR REPLACE FUNCTION invite_team_member(
    p_profile_id UUID,
    p_invitation_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_info RECORD;
    v_profile RECORD;
    v_invitation_token TEXT;
BEGIN
    -- Get current user's tenant and role
    SELECT * INTO v_tenant_info FROM get_user_tenant_and_role();
    
    IF v_tenant_info.tenant_id IS NULL THEN
        RAISE EXCEPTION 'Current user has no tenant_id';
    END IF;
    
    -- Check permissions
    IF v_tenant_info.user_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient permissions to invite team members';
    END IF;
    
    -- Get the profile to invite
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE id = p_profile_id
    AND tenant_id = v_tenant_info.tenant_id;
    
    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Team member profile not found in your tenant';
    END IF;
    
    -- Generate invitation token (you could use a more sophisticated token generation)
    v_invitation_token := encode(gen_random_bytes(32), 'base64');
    
    -- Store invitation details (you might want to create an invitations table)
    -- For now, we'll update the user profile with invitation info
    UPDATE user_profiles
    SET 
        updated_at = NOW()
        -- Add invitation_token, invited_at fields if they exist
    WHERE id = p_profile_id;
    
    -- Return invitation details
    RETURN jsonb_build_object(
        'profile_id', v_profile.id,
        'email', v_profile.email,
        'invitation_token', v_invitation_token,
        'invitation_url', format('https://yourapp.com/accept-invitation?token=%s', v_invitation_token),
        'message', COALESCE(p_invitation_message, 'You have been invited to join our team!')
    );
END;
$$;

-- 3. Create a view that shows team member status clearly
CREATE OR REPLACE VIEW v_team_members_with_status AS
SELECT 
    up.id,
    up.tenant_id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.phone,
    up.department,
    up.employee_id,
    up.hire_date,
    up.hourly_rate,
    up.salary,
    up.emergency_contact_name,
    up.emergency_contact_phone,
    up.certifications,
    up.specialties,
    up.is_active,
    up.created_at,
    up.updated_at,
    -- Status indicators
    CASE 
        WHEN au.id IS NOT NULL THEN 'active'
        ELSE 'invited'
    END as auth_status,
    -- Role categorization
    CASE 
        WHEN up.role IN ('admin', 'manager', 'supervisor') THEN 'management'
        WHEN up.role IN ('technician', 'field_worker', 'subcontractor') THEN 'field'
        WHEN up.role IN ('estimator', 'sales', 'customer_service') THEN 'sales'
        WHEN up.role IN ('accounting', 'dispatcher') THEN 'office'
        ELSE 'other'
    END as role_category,
    -- Tenant info
    t.company_name as tenant_company,
    -- Subcontractor company info if applicable
    sc.company_name as subcontractor_company,
    su.trade_specialties as subcontractor_specialties
FROM user_profiles up
JOIN tenants t ON up.tenant_id = t.id
LEFT JOIN auth.users au ON up.id = au.id
LEFT JOIN subcontractor_users su ON up.id = su.user_id
LEFT JOIN subcontractor_companies sc ON su.subcontractor_company_id = sc.id;

-- 4. Create a function to check if email can be added to tenant
CREATE OR REPLACE FUNCTION can_add_email_to_tenant(
    p_email TEXT,
    p_target_tenant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_profile RECORD;
    v_target_tenant_id UUID;
BEGIN
    -- Use current user's tenant if not specified
    IF p_target_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_target_tenant_id
        FROM user_profiles
        WHERE id = auth.uid();
    ELSE
        v_target_tenant_id := p_target_tenant_id;
    END IF;
    
    -- Check if email already exists
    SELECT up.*, t.company_name INTO v_existing_profile
    FROM user_profiles up
    JOIN tenants t ON up.tenant_id = t.id
    WHERE up.email = p_email
    LIMIT 1;
    
    IF v_existing_profile.id IS NULL THEN
        -- Email doesn't exist, can be added
        RETURN jsonb_build_object(
            'can_add', true,
            'reason', 'Email is available'
        );
    ELSIF v_existing_profile.tenant_id = v_target_tenant_id THEN
        -- Email exists in same tenant
        RETURN jsonb_build_object(
            'can_add', false,
            'reason', 'User already exists in this tenant',
            'existing_user', jsonb_build_object(
                'id', v_existing_profile.id,
                'name', concat(v_existing_profile.first_name, ' ', v_existing_profile.last_name),
                'role', v_existing_profile.role
            )
        );
    ELSE
        -- Email exists in different tenant
        RETURN jsonb_build_object(
            'can_add', false,
            'reason', 'User exists in different organization',
            'existing_tenant', v_existing_profile.company_name
        );
    END IF;
END;
$$;

-- 5. Update RLS policies to ensure team members can only see their tenant's data
-- Add a policy specifically for team member management views
CREATE POLICY "Team members can view team data" ON user_profiles
    FOR SELECT USING (
        -- Current user can see profiles in their tenant
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
        OR 
        -- Service role can see everything
        auth.role() = 'service_role'
    );

-- 6. Grant permissions for new functions
GRANT EXECUTE ON FUNCTION invite_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION can_add_email_to_tenant TO authenticated;
GRANT SELECT ON v_team_members_with_status TO authenticated;

-- 7. Add helpful comments
COMMENT ON FUNCTION invite_team_member IS 'Creates invitation for existing team member profile to complete auth setup';
COMMENT ON FUNCTION can_add_email_to_tenant IS 'Checks if an email address can be added to a tenant without conflicts';
COMMENT ON VIEW v_team_members_with_status IS 'Shows team members with auth status and tenant association clearly indicated';

-- 8. Create a trigger to prevent accidental tenant changes
CREATE OR REPLACE FUNCTION prevent_tenant_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Prevent changing tenant_id after creation (except for admins)
    IF OLD.tenant_id != NEW.tenant_id THEN
        -- Only allow tenant changes for service role or if old tenant_id was null
        IF auth.role() != 'service_role' AND OLD.tenant_id IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot change tenant association for existing user profiles';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'prevent_tenant_change_trigger' 
        AND tgrelid = 'user_profiles'::regclass
    ) THEN
        CREATE TRIGGER prevent_tenant_change_trigger
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION prevent_tenant_change();
    END IF;
END $$;