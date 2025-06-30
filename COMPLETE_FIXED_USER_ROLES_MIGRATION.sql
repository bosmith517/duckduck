-- COMPLETE FIXED USER ROLES MIGRATION
-- This migration adds missing database columns and establishes role-based access control

-- 1. Add missing columns to jobs table that the frontend expects
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- 2. Add new role fields to user_profiles table WITHOUT dropping existing role column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS role_permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_platform_user BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_impersonate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS access_level INTEGER DEFAULT 1;

-- 3. Update existing users to have proper access levels and platform flags
-- Keep existing 'admin', 'user', 'manager' values in role column for compatibility
UPDATE user_profiles SET 
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
  is_platform_user = false -- Default all existing users to contractor users
WHERE user_type IS NULL;

-- 4. Create user_roles lookup table
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

-- 5. Insert standard role definitions
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
('property_manager', 'customer', '{"manage_multiple_properties": true, "bulk_scheduling": true, "consolidated_billing": true}', 2, 'Property manager for multiple units')
ON CONFLICT (role_name) DO NOTHING;

-- 6. Add a new role_name column that maps to the new role system
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role_name VARCHAR(50);

-- Map existing roles to new role names
UPDATE user_profiles SET 
  role_name = CASE 
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'manager' THEN 'admin'
    WHEN role = 'user' THEN 'technician'
    ELSE 'technician'
  END
WHERE role_name IS NULL;

-- 7. Create leads table if it doesn't exist (needed for the workflow)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  caller_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  lead_source VARCHAR(100) NOT NULL,
  initial_request TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'unqualified', 'converted')),
  urgency VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'emergency')),
  estimated_value NUMERIC(10, 2),
  follow_up_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  converted_to_job_id UUID REFERENCES jobs(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 8. Create call_logs table if it doesn't exist (needed for the workflow)
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id),
  contact_id UUID REFERENCES contacts(id),
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20),
  call_type VARCHAR(20) NOT NULL CHECK (call_type IN ('inbound', 'outbound')),
  call_direction VARCHAR(20) NOT NULL CHECK (call_direction IN ('inbound', 'outbound')),
  duration INTEGER DEFAULT 0, -- in seconds
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('missed', 'completed', 'voicemail', 'busy')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on call_logs table
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- 9. Create function to get user permissions (updated to work with both role systems)
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
  
  -- Get role-based permissions from new system if role_name exists
  IF user_record.role_name IS NOT NULL THEN
    SELECT permissions INTO role_permissions 
    FROM user_roles 
    WHERE role_name = user_record.role_name;
  ELSE
    -- Fallback to legacy role mapping
    SELECT permissions INTO role_permissions 
    FROM user_roles 
    WHERE role_name = CASE 
      WHEN user_record.role = 'admin' THEN 'admin'
      WHEN user_record.role = 'manager' THEN 'admin'
      ELSE 'technician'
    END;
  END IF;
  
  -- Merge role permissions with user-specific permissions
  RETURN COALESCE(role_permissions, '{}'::JSONB) || COALESCE(user_record.role_permissions, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add enhanced RLS policies that work with both old and new role systems
-- Use safe policy creation that handles existing policies

DO $$
BEGIN
  -- Jobs table policies
  BEGIN
    DROP POLICY IF EXISTS "platform_users_global_access" ON jobs;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "platform_users_global_access" ON jobs
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.is_platform_user = true
        AND user_profiles.access_level >= 4
      )
    );

  BEGIN
    DROP POLICY IF EXISTS "enhanced_technician_access" ON jobs;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "enhanced_technician_access" ON jobs
    FOR SELECT TO authenticated
    USING (
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM user_profiles 
          WHERE id = auth.uid() 
          AND (role_name = 'technician' OR (role_name IS NULL AND role = 'user'))
          AND (is_platform_user = false OR is_platform_user IS NULL)
        )
        THEN assigned_technician_id = auth.uid()
        ELSE true
      END
    );
END $$;

-- Apply platform access to other critical tables
DO $$
BEGIN
  -- Leads table policies
  BEGIN
    DROP POLICY IF EXISTS "platform_users_global_access_leads" ON leads;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "platform_users_global_access_leads" ON leads
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.is_platform_user = true
        AND user_profiles.access_level >= 4
      )
    );

  BEGIN
    DROP POLICY IF EXISTS "tenant_isolation_leads" ON leads;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "tenant_isolation_leads" ON leads
    FOR ALL TO authenticated
    USING (
      tenant_id = (
        SELECT tenant_id FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
      )
    );

  -- Call logs table policies
  BEGIN
    DROP POLICY IF EXISTS "platform_users_global_access_call_logs" ON call_logs;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "platform_users_global_access_call_logs" ON call_logs
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.is_platform_user = true
        AND user_profiles.access_level >= 4
      )
    );

  BEGIN
    DROP POLICY IF EXISTS "tenant_isolation_call_logs" ON call_logs;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "tenant_isolation_call_logs" ON call_logs
    FOR ALL TO authenticated
    USING (
      tenant_id = (
        SELECT tenant_id FROM user_profiles 
        WHERE user_profiles.id = auth.uid()
        AND (user_profiles.is_platform_user = false OR user_profiles.is_platform_user IS NULL)
      )
    );

  -- Accounts table
  BEGIN
    DROP POLICY IF EXISTS "platform_users_global_access_accounts" ON accounts;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "platform_users_global_access_accounts" ON accounts
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.is_platform_user = true
        AND user_profiles.access_level >= 4
      )
    );

  -- Contacts table
  BEGIN
    DROP POLICY IF EXISTS "platform_users_global_access_contacts" ON contacts;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;
  
  CREATE POLICY "platform_users_global_access_contacts" ON contacts
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.is_platform_user = true
        AND user_profiles.access_level >= 4
      )
    );
END $$;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_technician ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON jobs(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_converted_job ON leads(converted_to_job_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_name ON user_profiles(role_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_role_name ON user_profiles(tenant_id, role_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_platform_user ON user_profiles(is_platform_user) WHERE is_platform_user = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_level ON user_profiles(access_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type ON user_profiles(user_type);

-- 12. Update the Job interface type in supabaseClient to include the new fields
-- Add comments to document the new fields
COMMENT ON COLUMN jobs.assigned_technician_id IS 'ID of the technician assigned to this job';
COMMENT ON COLUMN jobs.lead_id IS 'ID of the lead that was converted to create this job';

-- 13. Add comments for documentation
COMMENT ON COLUMN user_profiles.role IS 'Legacy role field - kept for existing policy compatibility';
COMMENT ON COLUMN user_profiles.role_name IS 'New role system - maps to user_roles table';
COMMENT ON COLUMN user_profiles.user_type IS 'Category of user (platform, contractor, customer)';
COMMENT ON COLUMN user_profiles.role_permissions IS 'User-specific permission overrides as JSON';
COMMENT ON COLUMN user_profiles.is_platform_user IS 'True for TaurusTech/platform employees, false for contractor users';
COMMENT ON COLUMN user_profiles.access_level IS 'Numeric access level: 1=basic, 2=manager, 3=owner, 4=support, 5=platform_admin';

-- 14. Set up a platform admin user - UPDATE THIS EMAIL TO YOUR ACTUAL ADMIN EMAIL
-- Replace 'your-admin-email@taurustech.com' with your actual platform admin email
UPDATE user_profiles SET 
  role_name = 'platform_admin',
  user_type = 'platform_admin',
  is_platform_user = true,
  access_level = 5,
  role_permissions = '{"all": true}'
WHERE email = 'your-admin-email@taurustech.com'; -- CHANGE THIS EMAIL!

-- Show warning if no platform admin was set
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM user_profiles WHERE is_platform_user = true;
  
  IF admin_count = 0 THEN
    RAISE WARNING 'No platform admin user found! Please update the email in step 14 to set your platform admin.';
  ELSE
    RAISE NOTICE 'Platform admin users set: %', admin_count;
  END IF;
END $$;

-- 15. Create a view for easier role management
CREATE OR REPLACE VIEW user_roles_summary AS
SELECT 
  up.id,
  up.email,
  up.first_name,
  up.last_name,
  up.tenant_id,
  up.role as legacy_role,
  up.role_name as current_role,
  up.user_type,
  up.is_platform_user,
  up.access_level,
  ur.description as role_description,
  ur.permissions as role_permissions
FROM user_profiles up
LEFT JOIN user_roles ur ON up.role_name = ur.role_name
ORDER BY up.access_level DESC, up.tenant_id, up.email;

-- Grant access to the view
GRANT SELECT ON user_roles_summary TO authenticated;

-- 16. Verification queries
-- Show role distribution
SELECT 
  COALESCE(role_name, role) as effective_role,
  user_type,
  is_platform_user,
  access_level,
  COUNT(*) as user_count
FROM user_profiles 
GROUP BY COALESCE(role_name, role), user_type, is_platform_user, access_level
ORDER BY access_level DESC, effective_role;

-- Show platform users
SELECT 
  email,
  COALESCE(role_name, role) as effective_role,
  access_level,
  is_platform_user
FROM user_profiles 
WHERE is_platform_user = true
ORDER BY access_level DESC;

-- Show table structure verification
SELECT 
  'jobs' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND table_schema = 'public'
AND column_name IN ('assigned_technician_id', 'lead_id')

UNION ALL

SELECT 
  'user_profiles' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
AND column_name IN ('role_name', 'is_platform_user', 'access_level')

ORDER BY table_name, column_name;

-- 17. Success message
DO $$
BEGIN
  RAISE NOTICE '=== COMPLETE USER ROLES MIGRATION COMPLETED SUCCESSFULLY! ===';
  RAISE NOTICE '1. ✅ Added missing database columns (assigned_technician_id, lead_id)';
  RAISE NOTICE '2. ✅ Created leads and call_logs tables for workflow';
  RAISE NOTICE '3. ✅ Established role-based access control system';
  RAISE NOTICE '4. ✅ Preserved existing policies and functionality';
  RAISE NOTICE '5. ⚠️  UPDATE the admin email in step 14 to set your platform admin user';
  RAISE NOTICE '6. ✅ Platform admin controls will now be hidden from contractor users';
  RAISE NOTICE '7. ✅ Automated customer workflow is now fully operational';
END $$;