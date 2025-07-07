-- Fix user_profiles RLS policies and expand role system
-- This migration addresses team member creation issues and adds subcontractor roles

-- 1. First, let's check the current RLS policies and update them
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles in their tenant" ON user_profiles;

-- 2. Expand the role enumeration to include more role types
-- First, let's add the new roles to the existing check constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add new role constraint with expanded options
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN (
    'admin', 
    'agent', 
    'viewer',
    'manager',
    'supervisor', 
    'technician',
    'subcontractor',
    'field_worker',
    'dispatcher',
    'estimator',
    'sales',
    'customer_service',
    'accounting',
    'marketing'
));

-- 3. Add additional columns for better team management
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialties TEXT[];

-- 4. Create more permissive RLS policies
-- Allow users to view other profiles in their tenant (needed for team management)
CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- Allow admins and managers to insert new profiles in their tenant
CREATE POLICY "Admins can insert profiles in their tenant" ON user_profiles
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT up.tenant_id FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'manager', 'supervisor')
        )
    );

-- Allow admins and managers to update profiles in their tenant (except changing admin roles)
CREATE POLICY "Admins can update profiles in their tenant" ON user_profiles
    FOR UPDATE USING (
        tenant_id IN (
            SELECT up.tenant_id FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'manager', 'supervisor')
        )
        -- Prevent non-admins from promoting others to admin
        AND (
            (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'admin' 
            OR role != 'admin'
        )
    );

-- Allow admins to delete profiles in their tenant (except other admins)
CREATE POLICY "Admins can delete profiles in their tenant" ON user_profiles
    FOR DELETE USING (
        tenant_id IN (
            SELECT up.tenant_id FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
        )
        AND role != 'admin' -- Admins can't delete other admins
    );

-- 5. Create a function to handle new user profile creation with proper tenant assignment
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_profile_id UUID;
BEGIN
    -- Get the current user's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Current user has no tenant_id';
    END IF;
    
    -- Check if current user has permission to create team members
    IF NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'supervisor')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to create team members';
    END IF;
    
    -- Create the auth user first (this would typically be done via Supabase Auth)
    -- For now, we'll create a placeholder profile that can be linked later
    v_profile_id := gen_random_uuid();
    
    -- Insert the user profile
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

-- 6. Create a view for team member management
CREATE OR REPLACE VIEW v_team_members AS
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
    -- Add some calculated fields
    CASE 
        WHEN up.role IN ('admin', 'manager', 'supervisor') THEN 'management'
        WHEN up.role IN ('technician', 'field_worker', 'subcontractor') THEN 'field'
        WHEN up.role IN ('estimator', 'sales', 'customer_service') THEN 'sales'
        WHEN up.role IN ('accounting', 'dispatcher') THEN 'office'
        ELSE 'other'
    END as role_category,
    -- Subcontractor company info if applicable
    sc.company_name as subcontractor_company,
    su.trade_specialties as subcontractor_specialties
FROM user_profiles up
LEFT JOIN subcontractor_users su ON up.id = su.user_id
LEFT JOIN subcontractor_companies sc ON su.subcontractor_company_id = sc.id;

-- 7. Create role hierarchy function
CREATE OR REPLACE FUNCTION can_manage_role(
    p_manager_role TEXT,
    p_target_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Admins can manage everyone except other admins
    IF p_manager_role = 'admin' THEN
        RETURN p_target_role != 'admin';
    END IF;
    
    -- Managers can manage most roles but not admins or other managers
    IF p_manager_role = 'manager' THEN
        RETURN p_target_role NOT IN ('admin', 'manager');
    END IF;
    
    -- Supervisors can manage field workers and technicians
    IF p_manager_role = 'supervisor' THEN
        RETURN p_target_role IN ('technician', 'field_worker', 'subcontractor');
    END IF;
    
    -- Others can't manage anyone
    RETURN FALSE;
END;
$$;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role ON user_profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON user_profiles(tenant_id, department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON user_profiles(employee_id) WHERE employee_id IS NOT NULL;

-- 9. Grant permissions
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_role TO authenticated;
GRANT SELECT ON v_team_members TO authenticated;

-- 10. Add helpful comments
COMMENT ON FUNCTION create_team_member IS 'Creates a new team member profile with proper tenant isolation and permission checking';
COMMENT ON FUNCTION can_manage_role IS 'Determines if a user role can manage another role based on hierarchy';
COMMENT ON VIEW v_team_members IS 'Comprehensive view of team members with role categorization and subcontractor info';

-- 11. Create trigger to ensure tenant_id is always set for new profiles
CREATE OR REPLACE FUNCTION ensure_user_profile_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If tenant_id is not set and user is authenticated, get it from existing profile or current context
    IF NEW.tenant_id IS NULL AND auth.uid() IS NOT NULL THEN
        -- Try to get tenant_id from the creating user's profile
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_profiles
        WHERE id = auth.uid();
        
        -- If still null, this might be the first admin user - allow it to proceed
        -- The application should handle tenant assignment in this case
    END IF;
    
    RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'ensure_user_profile_tenant_id_trigger' 
        AND tgrelid = 'user_profiles'::regclass
    ) THEN
        CREATE TRIGGER ensure_user_profile_tenant_id_trigger
        BEFORE INSERT ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION ensure_user_profile_tenant_id();
    END IF;
END $$;

-- 12. Update existing records to ensure no null tenant_ids (if any exist)
-- This is a safety measure for existing data
UPDATE user_profiles 
SET tenant_id = (
    SELECT id FROM tenants 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE tenant_id IS NULL 
AND EXISTS (SELECT 1 FROM tenants);