-- USER ROLES AND PERMISSIONS MIGRATION
-- This migration establishes proper role-based access control

-- 1. Add new role fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS role_permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_platform_user BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_impersonate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS access_level INTEGER DEFAULT 1;

-- 2. Update the role column to use the new enum values
-- First, add a new column with the correct type
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS new_role VARCHAR(50);

-- Update existing roles to new system
UPDATE user_profiles SET 
  new_role = CASE 
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'manager' THEN 'admin' 
    WHEN role = 'user' THEN 'technician'
    ELSE 'technician'
  END,
  user_type = CASE 
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'manager' THEN 'admin'
    WHEN role = 'user' THEN 'technician'
    ELSE 'technician'
  END,
  access_level = CASE 
    WHEN role = 'admin' THEN 2
    WHEN role = 'manager' THEN 2
    WHEN role = 'user' THEN 1
    ELSE 1
  END,
  is_platform_user = false;

-- Drop the old role column and rename new_role to role
ALTER TABLE user_profiles DROP COLUMN IF EXISTS role;
ALTER TABLE user_profiles RENAME COLUMN new_role TO role;

-- 3. Create user_roles lookup table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  role_type VARCHAR(20) NOT NULL, -- 'platform', 'contractor', 'customer'
  permissions JSONB NOT NULL DEFAULT '{}',
  access_level INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert standard role definitions
INSERT INTO user_roles (role_name, role_type, permissions, access_level, description) VALUES
('platform_admin', 'platform', '{"all": true, "manage_infrastructure": true, "manage_tenants": true, "view_all_data": true}', 5, 'Full platform administration access'),
('platform_support', 'platform', '{"read_all_tenants": true, "impersonate": true, "view_logs": true}', 4, 'Customer support and troubleshooting access'),
('platform_sales', 'platform', '{"view_tenant_stats": true, "create_demos": true, "view_billing": true}', 3, 'Sales team access to tenant overview'),
('owner', 'contractor', '{"manage_company": true, "manage_billing": true, "manage_team": true, "view_all_data": true, "manage_integrations": true}', 3, 'Company owner - full business control'),
('admin', 'contractor', '{"manage_operations": true, "manage_customers": true, "view_reports": true, "manage_jobs": true, "manage_leads": true}', 2, 'Office manager - operational control'),
('sales', 'contractor', '{"manage_leads": true, "create_estimates": true, "manage_customers": true, "schedule_appointments": true}', 2, 'Sales representative access'),
('dispatcher', 'contractor', '{"assign_jobs": true, "manage_schedules": true, "track_technicians": true, "manage_routes": true}', 2, 'Dispatch and field operations'),
('technician', 'contractor', '{"view_assigned_jobs": true, "update_job_status": true, "capture_signatures": true, "upload_photos": true}', 1, 'Field technician access'),
('viewer', 'contractor', '{"view_jobs": true, "view_schedules": true}', 1, 'Read-only access for contractors'),
('homeowner', 'customer', '{"view_own_projects": true, "make_payments": true, "communicate_with_team": true, "approve_estimates": true}', 1, 'Customer portal access'),
('property_manager', 'customer', '{"manage_multiple_properties": true, "bulk_scheduling": true, "consolidated_billing": true}', 2, 'Property manager for multiple units');

-- 5. Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_record user_profiles%ROWTYPE;
  role_permissions JSONB;
BEGIN
  SELECT * INTO user_record FROM user_profiles WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN '{}'::JSONB;
  END IF;
  
  -- Get role-based permissions
  SELECT permissions INTO role_permissions 
  FROM user_roles 
  WHERE role_name = user_record.role;
  
  -- Merge role permissions with user-specific permissions
  RETURN COALESCE(role_permissions, '{}'::JSONB) || COALESCE(user_record.role_permissions, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create RLS policies for role-based access

-- Platform users can access any tenant data
DROP POLICY IF EXISTS "platform_users_access" ON jobs;
CREATE POLICY "platform_users_access" ON jobs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_platform_user = true
      AND user_profiles.access_level >= 4
    )
  );

-- Regular users can only access their tenant's data
DROP POLICY IF EXISTS "tenant_isolation" ON jobs;
CREATE POLICY "tenant_isolation" ON jobs
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
    )
  );

-- Technicians can only see assigned jobs
DROP POLICY IF EXISTS "technician_assigned_jobs" ON jobs;
CREATE POLICY "technician_assigned_jobs" ON jobs
  FOR SELECT TO authenticated
  USING (
    CASE 
      WHEN (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'technician'
      THEN (
        assigned_technician_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE id = auth.uid() 
          AND is_platform_user = true
        )
      )
      ELSE true
    END
  );

-- Apply similar policies to other tables
-- Leads table
DROP POLICY IF EXISTS "platform_users_access_leads" ON leads;
CREATE POLICY "platform_users_access_leads" ON leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_platform_user = true
      AND user_profiles.access_level >= 4
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_leads" ON leads;
CREATE POLICY "tenant_isolation_leads" ON leads
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
    )
  );

-- Accounts table
DROP POLICY IF EXISTS "platform_users_access_accounts" ON accounts;
CREATE POLICY "platform_users_access_accounts" ON accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_platform_user = true
      AND user_profiles.access_level >= 4
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_accounts" ON accounts;
CREATE POLICY "tenant_isolation_accounts" ON accounts
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
    )
  );

-- Contacts table
DROP POLICY IF EXISTS "platform_users_access_contacts" ON contacts;
CREATE POLICY "platform_users_access_contacts" ON contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_platform_user = true
      AND user_profiles.access_level >= 4
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_contacts" ON contacts;
CREATE POLICY "tenant_isolation_contacts" ON contacts
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
    )
  );

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role ON user_profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_user ON user_profiles(is_platform_user) WHERE is_platform_user = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_level ON user_profiles(access_level);

-- 8. Add comments for documentation
COMMENT ON COLUMN user_profiles.role IS 'User role within the system - determines permissions and access level';
COMMENT ON COLUMN user_profiles.user_type IS 'Category of user (platform, contractor, customer)';
COMMENT ON COLUMN user_profiles.role_permissions IS 'User-specific permission overrides as JSON';
COMMENT ON COLUMN user_profiles.is_platform_user IS 'True for TaurusTech/platform employees, false for contractor users';
COMMENT ON COLUMN user_profiles.access_level IS 'Numeric access level: 1=basic, 2=manager, 3=owner, 4=support, 5=platform_admin';

-- 9. Sample data update for testing
-- Set up a platform admin user (replace with actual email)
UPDATE user_profiles SET 
  role = 'platform_admin',
  user_type = 'platform_admin',
  is_platform_user = true,
  access_level = 5,
  role_permissions = '{"all": true}'
WHERE email = 'admin@taurustech.com'; -- Replace with actual platform admin email

-- 10. Verification queries
-- Show role distribution
SELECT 
  role, 
  user_type,
  is_platform_user,
  access_level,
  COUNT(*) as user_count
FROM user_profiles 
GROUP BY role, user_type, is_platform_user, access_level
ORDER BY access_level DESC, role;

-- Show platform users
SELECT 
  email,
  role,
  access_level,
  is_platform_user
FROM user_profiles 
WHERE is_platform_user = true
ORDER BY access_level DESC;

-- Show tenant users sample
SELECT 
  tenant_id,
  role,
  COUNT(*) as user_count
FROM user_profiles 
WHERE is_platform_user = false OR is_platform_user IS NULL
GROUP BY tenant_id, role
ORDER BY tenant_id, role;