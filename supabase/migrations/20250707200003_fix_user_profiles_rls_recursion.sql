-- Fix infinite recursion in user_profiles RLS policies
-- The issue is that the policies are referencing user_profiles table within user_profiles policies

-- 1. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles in their tenant" ON user_profiles;

-- 2. Create a simple, non-recursive policy structure
-- First, allow users to view their own profile (no recursion)
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

-- Allow users to update their own profile (no recursion)
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- 3. Create a function to check user permissions without recursion
CREATE OR REPLACE FUNCTION get_user_tenant_and_role()
RETURNS TABLE(tenant_id UUID, user_role TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT up.tenant_id, up.role::TEXT
    FROM user_profiles up
    WHERE up.id = auth.uid()
    LIMIT 1;
$$;

-- 4. Create policies using the helper function to avoid recursion
-- Allow viewing profiles in same tenant (for team management)
CREATE POLICY "Users can view profiles in same tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id = (SELECT (get_user_tenant_and_role()).tenant_id)
    );

-- Allow admins/managers to insert new profiles
CREATE POLICY "Managers can insert profiles" ON user_profiles
    FOR INSERT WITH CHECK (
        tenant_id = (SELECT (get_user_tenant_and_role()).tenant_id)
        AND (SELECT (get_user_tenant_and_role()).user_role) IN ('admin', 'manager', 'supervisor')
    );

-- Allow admins/managers to update profiles in their tenant
CREATE POLICY "Managers can update profiles" ON user_profiles
    FOR UPDATE USING (
        tenant_id = (SELECT (get_user_tenant_and_role()).tenant_id)
        AND (
            id = auth.uid() -- Users can always update their own profile
            OR (
                (SELECT (get_user_tenant_and_role()).user_role) IN ('admin', 'manager', 'supervisor')
                AND (
                    (SELECT (get_user_tenant_and_role()).user_role) = 'admin' 
                    OR role != 'admin' -- Non-admins can't promote to admin
                )
            )
        )
    );

-- Allow admins to delete profiles (except other admins and themselves)
CREATE POLICY "Admins can delete profiles" ON user_profiles
    FOR DELETE USING (
        tenant_id = (SELECT (get_user_tenant_and_role()).tenant_id)
        AND (SELECT (get_user_tenant_and_role()).user_role) = 'admin'
        AND role != 'admin' 
        AND id != auth.uid() -- Can't delete yourself
    );

-- 5. Create a simpler team member creation function that works with the new policies
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
    
    -- Generate a UUID for the new profile
    v_profile_id := gen_random_uuid();
    
    -- Insert the user profile with explicit tenant_id (bypassing RLS for this function)
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
        v_tenant_info.tenant_id,
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

-- 6. Create a bypass policy for the service role
CREATE POLICY "Service role full access" ON user_profiles
    FOR ALL USING (auth.role() = 'service_role');

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_tenant_and_role() TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_member_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;

-- 8. Add helpful comments
COMMENT ON FUNCTION get_user_tenant_and_role() IS 'Returns current user tenant_id and role without causing RLS recursion';
COMMENT ON FUNCTION create_team_member_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL) IS 'Safely creates team members with proper permission checking and RLS bypass';

-- 9. Update the existing create_team_member function to use the safe version
DROP FUNCTION IF EXISTS create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL);
-- Alias the safe function for backward compatibility
CREATE OR REPLACE FUNCTION create_team_member(
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
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT create_team_member_safe(p_email, p_first_name, p_last_name, p_role, p_phone, p_department, p_employee_id, p_hourly_rate, p_salary);
$$;

-- Grant permissions for the wrapper function too
GRANT EXECUTE ON FUNCTION create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;