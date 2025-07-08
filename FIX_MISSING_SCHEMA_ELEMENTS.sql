-- Fix all missing schema elements for password reset and team management functionality

-- 1. Fix password_reset_logs table
-- First check if table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_logs') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE password_reset_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES user_profiles(id),
            requested_by UUID REFERENCES user_profiles(id),
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            reset_at TIMESTAMPTZ,
            tenant_id UUID REFERENCES tenants(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Add missing columns to existing table
        ALTER TABLE password_reset_logs 
        ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_user_id ON password_reset_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_tenant_id ON password_reset_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_requested_at ON password_reset_logs(requested_at);

-- 3. Enable RLS on password_reset_logs
ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "tenant_isolation" ON password_reset_logs;

-- 5. Create proper RLS policies using the cached tenant function
CREATE POLICY "tenant_isolation" ON password_reset_logs
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- 6. Fix email_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email TEXT NOT NULL,
    cc_email TEXT,
    bcc_email TEXT,
    subject TEXT NOT NULL,
    body TEXT,
    body_html TEXT,
    template_id TEXT,
    template_data JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id UUID REFERENCES tenants(id),
    created_by UUID REFERENCES user_profiles(id)
);

-- 7. Add indexes for email_queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_tenant_id ON email_queue(tenant_id);

-- 8. Enable RLS on email_queue
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for email_queue
DROP POLICY IF EXISTS "tenant_isolation" ON email_queue;
CREATE POLICY "tenant_isolation" ON email_queue
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- 10. Create or update the send_password_reset_for_profile function
CREATE OR REPLACE FUNCTION public.send_password_reset_for_profile(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile record;
    v_admin_tenant_id uuid;
    v_admin_role text;
BEGIN
    -- Get the admin's (caller's) tenant and role
    SELECT tenant_id, role INTO v_admin_tenant_id, v_admin_role
    FROM user_profiles
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Check if caller is an admin
    IF v_admin_role NOT IN ('admin', 'manager', 'supervisor') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Unauthorized. Only admins can send password reset emails.'
        );
    END IF;
    
    -- Get the user profile by email
    SELECT * INTO v_profile
    FROM user_profiles
    WHERE email = p_email
    AND tenant_id = v_admin_tenant_id
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found in your organization'
        );
    END IF;
    
    -- Get the auth user ID
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
        -- User exists in profiles but not in auth
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User account not fully set up. Please contact support.'
        );
    END IF;
    
    -- Log the password reset request
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_at,
        tenant_id
    ) VALUES (
        v_profile.id,
        auth.uid(),
        NOW(),
        v_admin_tenant_id
    );
    
    -- Note: The actual email sending will be handled by Supabase Auth
    -- when the frontend calls supabase.auth.resetPasswordForEmail()
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset can be initiated',
        'email', p_email
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

-- 11. Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_password_reset_for_profile(text) TO authenticated;

-- 12. Create view for orphaned profiles if needed
CREATE OR REPLACE VIEW v_orphaned_profiles AS
SELECT 
    up.id as profile_id,
    up.email,
    up.first_name,
    up.last_name,
    up.role,
    up.tenant_id,
    up.created_at,
    t.company_name,
    NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.email = up.email
    ) as missing_auth
FROM user_profiles up
JOIN tenants t ON t.id = up.tenant_id
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = up.id
);

-- 13. Grant access to the view
GRANT SELECT ON v_orphaned_profiles TO authenticated;

-- 14. Create trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables that need updated_at
DROP TRIGGER IF EXISTS update_password_reset_logs_updated_at ON password_reset_logs;
CREATE TRIGGER update_password_reset_logs_updated_at 
    BEFORE UPDATE ON password_reset_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_queue;
CREATE TRIGGER update_email_queue_updated_at 
    BEFORE UPDATE ON email_queue 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 15. Verify all required columns exist on team_invitations
ALTER TABLE team_invitations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agent',
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id);

-- 16. Add RLS to team_invitations if not already enabled
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 17. Create RLS policies for team_invitations
DROP POLICY IF EXISTS "tenant_isolation" ON team_invitations;
CREATE POLICY "tenant_isolation" ON team_invitations
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- 18. Refresh the materialized view to ensure everything is in sync
REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;

SELECT 'All missing schema elements have been created/fixed!' as status;