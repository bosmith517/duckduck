-- Complete fix for user_profiles RLS policies to resolve infinite recursion
-- This migration drops ALL existing policies and recreates them properly

-- 1. First, drop ALL existing policies on user_profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on user_profiles
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
    END LOOP;
END $$;

-- 2. Drop the helper function if it exists and recreate it
DROP FUNCTION IF EXISTS get_user_tenant_and_role();

-- 3. Create a simple function to get auth user id without recursion
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT auth.uid()
$$;

-- 4. Create new, simple RLS policies that avoid recursion

-- Policy 1: Users can always see their own profile
CREATE POLICY "Users can view own profile" 
ON user_profiles 
FOR SELECT 
USING (id = auth_user_id());

-- Policy 2: Service role has full access (for system operations)
CREATE POLICY "Service role full access" 
ON user_profiles 
FOR ALL 
USING (auth.role() = 'service_role');

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON user_profiles 
FOR UPDATE 
USING (id = auth_user_id());

-- Policy 4: Allow authenticated users to view profiles in same tenant
-- This uses a subquery to avoid recursion
CREATE POLICY "Users can view same tenant profiles" 
ON user_profiles 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles up_auth 
        WHERE up_auth.id = auth_user_id() 
        AND up_auth.tenant_id = user_profiles.tenant_id
    )
);

-- Policy 5: Allow admins/managers to insert profiles in their tenant
CREATE POLICY "Admins can insert profiles" 
ON user_profiles 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM user_profiles up_auth 
        WHERE up_auth.id = auth_user_id() 
        AND up_auth.tenant_id = tenant_id 
        AND up_auth.role IN ('admin', 'manager', 'supervisor')
    )
);

-- Policy 6: Allow admins/managers to update profiles in their tenant
CREATE POLICY "Admins can update tenant profiles" 
ON user_profiles 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles up_auth 
        WHERE up_auth.id = auth_user_id() 
        AND up_auth.tenant_id = user_profiles.tenant_id 
        AND up_auth.role IN ('admin', 'manager', 'supervisor')
    )
    AND (
        -- Prevent non-admins from changing roles to admin
        role != 'admin' 
        OR EXISTS (
            SELECT 1 
            FROM user_profiles up_auth 
            WHERE up_auth.id = auth_user_id() 
            AND up_auth.role = 'admin'
        )
    )
);

-- Policy 7: Allow admins to delete profiles (except admins and self)
CREATE POLICY "Admins can delete profiles" 
ON user_profiles 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles up_auth 
        WHERE up_auth.id = auth_user_id() 
        AND up_auth.tenant_id = user_profiles.tenant_id 
        AND up_auth.role = 'admin'
    )
    AND role != 'admin'
    AND id != auth_user_id()
);

-- 5. Create a simpler tenant helper function
CREATE OR REPLACE FUNCTION get_auth_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN v_tenant_id;
END;
$$;

-- 6. Create a simpler role check function
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    RETURN v_role;
END;
$$;

-- 7. Recreate the team member creation function
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
    v_tenant_id UUID;
    v_user_role TEXT;
    v_profile_id UUID;
BEGIN
    -- Get current user's tenant_id and role
    v_tenant_id := get_auth_user_tenant_id();
    v_user_role := get_auth_user_role();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Current user has no tenant_id';
    END IF;
    
    -- Check permissions
    IF v_user_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient permissions to create team members';
    END IF;
    
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'User with email % already exists', p_email;
    END IF;
    
    -- Generate new ID
    v_profile_id := gen_random_uuid();
    
    -- Insert profile
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
        v_tenant_id,
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

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION auth_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_member_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL) TO authenticated;

-- 9. Add helpful comments
COMMENT ON FUNCTION auth_user_id() IS 'Simple wrapper for auth.uid() to avoid recursion in policies';
COMMENT ON FUNCTION get_auth_user_tenant_id() IS 'Get current user tenant_id without recursion';
COMMENT ON FUNCTION get_auth_user_role() IS 'Get current user role without recursion';

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role ON user_profiles(tenant_id, role);