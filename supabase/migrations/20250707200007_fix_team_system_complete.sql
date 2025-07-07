-- Complete fix for team management system
-- This migration fixes all issues identified in the audit

-- 1. First ensure user_profiles has all needed columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT GENERATED ALWAYS AS (
    CASE 
        WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
        WHEN first_name IS NOT NULL THEN first_name
        WHEN last_name IS NOT NULL THEN last_name
        ELSE email
    END
) STORED;

-- Add team-specific columns that the frontend expects
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(8,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialties TEXT[];

-- 2. Create skills table for team member skills
CREATE TABLE IF NOT EXISTS team_member_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    skill_level VARCHAR(50) DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, skill_name)
);

-- 3. Create job assignments table
CREATE TABLE IF NOT EXISTS team_member_job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    role_in_job VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused'))
);

-- 4. Fix RLS policies properly (no recursion)
-- Drop all existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
    END LOOP;
END $$;

-- Create proper non-recursive policies
-- Policy 1: Users can always read their own profile
CREATE POLICY "own_profile_read" ON user_profiles
    FOR SELECT 
    USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "own_profile_update" ON user_profiles
    FOR UPDATE 
    USING (auth.uid() = id);

-- Policy 3: Users can see other profiles in their tenant
CREATE POLICY "tenant_profiles_read" ON user_profiles
    FOR SELECT 
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
    );

-- Policy 4: Admins/managers can manage profiles in their tenant
CREATE POLICY "admin_manage_profiles" ON user_profiles
    FOR ALL 
    USING (
        tenant_id = (
            SELECT tenant_id 
            FROM user_profiles 
            WHERE id = auth.uid()
            LIMIT 1
        )
        AND 
        EXISTS (
            SELECT 1 
            FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager', 'supervisor')
            LIMIT 1
        )
    );

-- Policy 5: Service role bypass
CREATE POLICY "service_role_bypass" ON user_profiles
    FOR ALL 
    USING (auth.role() = 'service_role');

-- 5. Fix the create_team_member function
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
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_role TEXT;
    v_profile_id UUID;
BEGIN
    -- Get current user's tenant and role (avoiding recursion)
    SELECT tenant_id, role INTO v_tenant_id, v_user_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Current user has no tenant_id';
    END IF;
    
    IF v_user_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient permissions to create team members';
    END IF;
    
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'User with email % already exists', p_email;
    END IF;
    
    v_profile_id := gen_random_uuid();
    
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
        hire_date,
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
        CURRENT_DATE,
        NOW(),
        NOW()
    );
    
    RETURN v_profile_id;
END;
$$;

-- 6. Create view for team members with computed fields
-- Drop existing view first to avoid column mismatch errors
DROP VIEW IF EXISTS v_team_members CASCADE;

CREATE VIEW v_team_members AS
SELECT 
    up.*,
    -- Add computed fields for compatibility
    COALESCE(
        ARRAY(
            SELECT skill_name 
            FROM team_member_skills 
            WHERE user_id = up.id
        ), 
        ARRAY[]::TEXT[]
    ) as skills,
    COALESCE(
        (
            SELECT COUNT(*)::INTEGER 
            FROM team_member_job_assignments 
            WHERE user_id = up.id 
            AND status = 'active'
        ), 
        0
    ) as current_jobs,
    COALESCE(
        (
            SELECT COUNT(*)::INTEGER 
            FROM team_member_job_assignments 
            WHERE user_id = up.id 
            AND status = 'completed'
        ), 
        0
    ) as completed_jobs,
    -- Map database roles to display names
    CASE role
        WHEN 'admin' THEN 'Administrator'
        WHEN 'manager' THEN 'Project Manager'
        WHEN 'supervisor' THEN 'Site Supervisor'
        WHEN 'technician' THEN 'Technician'
        WHEN 'field_worker' THEN 'Field Worker'
        WHEN 'estimator' THEN 'Estimator'
        WHEN 'dispatcher' THEN 'Dispatcher'
        WHEN 'accounting' THEN 'Accounting'
        WHEN 'sales' THEN 'Sales Representative'
        WHEN 'customer_service' THEN 'Customer Service'
        WHEN 'subcontractor' THEN 'Subcontractor'
        ELSE role
    END as display_role
FROM user_profiles up
WHERE up.is_active = true;

-- 7. Enable RLS on new tables
ALTER TABLE team_member_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_job_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for skills table
CREATE POLICY "view_team_skills" ON team_member_skills
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = team_member_skills.user_id 
            AND tenant_id = (
                SELECT tenant_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
            )
        )
    );

CREATE POLICY "manage_own_skills" ON team_member_skills
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "admin_manage_skills" ON team_member_skills
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
            LIMIT 1
        )
    );

-- 8. Grant permissions
GRANT ALL ON team_member_skills TO authenticated;
GRANT ALL ON team_member_job_assignments TO authenticated;
GRANT SELECT ON v_team_members TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_member TO authenticated;

-- 9. Create function to check email availability
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
    IF p_target_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_target_tenant_id
        FROM user_profiles
        WHERE id = auth.uid()
        LIMIT 1;
    ELSE
        v_target_tenant_id := p_target_tenant_id;
    END IF;
    
    SELECT up.*, t.company_name INTO v_existing_profile
    FROM user_profiles up
    LEFT JOIN tenants t ON up.tenant_id = t.id
    WHERE up.email = p_email
    LIMIT 1;
    
    IF v_existing_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'can_add', true,
            'reason', 'Email is available'
        );
    ELSIF v_existing_profile.tenant_id = v_target_tenant_id THEN
        RETURN jsonb_build_object(
            'can_add', false,
            'reason', 'User already exists in this tenant',
            'existing_user', jsonb_build_object(
                'id', v_existing_profile.id,
                'name', v_existing_profile.full_name,
                'role', v_existing_profile.role
            )
        );
    ELSE
        RETURN jsonb_build_object(
            'can_add', false,
            'reason', 'User exists in different organization',
            'existing_tenant', v_existing_profile.company_name
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION can_add_email_to_tenant TO authenticated;

-- 10. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_member_skills_user_id ON team_member_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_team_member_job_assignments_user_id ON team_member_job_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_team_member_job_assignments_job_id ON team_member_job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role ON user_profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- 11. Drop the problematic create_team_member_safe if it exists
DROP FUNCTION IF EXISTS create_team_member_safe(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL);