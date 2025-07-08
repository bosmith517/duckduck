-- Final fix for password_reset_logs table with ALL required columns

-- 1. Drop the existing table and recreate with correct schema
DROP TABLE IF EXISTS password_reset_logs CASCADE;

-- 2. Create the table with ALL required columns
CREATE TABLE password_reset_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id),
    requested_by UUID REFERENCES user_profiles(id) NOT NULL,
    requested_for_email TEXT NOT NULL,  -- This was missing!
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reset_at TIMESTAMPTZ,
    reset_token TEXT,
    token_expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'used', 'expired')),
    tenant_id UUID REFERENCES tenants(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create all necessary indexes
CREATE INDEX idx_password_reset_logs_user_id ON password_reset_logs(user_id);
CREATE INDEX idx_password_reset_logs_tenant_id ON password_reset_logs(tenant_id);
CREATE INDEX idx_password_reset_logs_requested_at ON password_reset_logs(requested_at);
CREATE INDEX idx_password_reset_logs_requested_for_email ON password_reset_logs(requested_for_email);
CREATE INDEX idx_password_reset_logs_status ON password_reset_logs(status);

-- 4. Enable RLS
ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY "tenant_isolation" ON password_reset_logs
    FOR ALL
    USING (tenant_id = public.cached_user_tenant_id())
    WITH CHECK (tenant_id = public.cached_user_tenant_id());

-- 6. Create updated_at trigger
CREATE TRIGGER update_password_reset_logs_updated_at 
    BEFORE UPDATE ON password_reset_logs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Update the send_password_reset_for_profile function to include requested_for_email
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
    v_reset_log_id uuid;
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
    
    -- Log the password reset request with ALL required fields
    INSERT INTO password_reset_logs (
        user_id,
        requested_by,
        requested_for_email,  -- Now including this required field
        requested_at,
        tenant_id,
        status
    ) VALUES (
        v_profile.id,
        auth.uid(),
        p_email,  -- The email we're resetting password for
        NOW(),
        v_admin_tenant_id,
        'pending'
    ) RETURNING id INTO v_reset_log_id;
    
    -- Note: The actual email sending will be handled by Supabase Auth
    -- when the frontend calls supabase.auth.resetPasswordForEmail()
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Password reset can be initiated',
        'email', p_email,
        'log_id', v_reset_log_id
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'An error occurred: ' || SQLERRM
        );
END;
$$;

-- 8. Create a function to mark password reset as completed
CREATE OR REPLACE FUNCTION public.mark_password_reset_completed(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE password_reset_logs
    SET 
        status = 'used',
        reset_at = NOW()
    WHERE requested_for_email = p_email
    AND status = 'pending'
    AND tenant_id = public.cached_user_tenant_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_password_reset_completed(text) TO authenticated;

-- 9. Create a view to see recent password reset activity
CREATE OR REPLACE VIEW v_password_reset_activity AS
SELECT 
    prl.id,
    prl.requested_for_email,
    prl.requested_at,
    prl.reset_at,
    prl.status,
    requester.email as requested_by_email,
    requester.first_name || ' ' || requester.last_name as requested_by_name,
    target.first_name || ' ' || target.last_name as requested_for_name
FROM password_reset_logs prl
LEFT JOIN user_profiles requester ON requester.id = prl.requested_by
LEFT JOIN user_profiles target ON target.id = prl.user_id
WHERE prl.tenant_id = public.cached_user_tenant_id()
ORDER BY prl.requested_at DESC
LIMIT 100;

GRANT SELECT ON v_password_reset_activity TO authenticated;

-- 10. Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_lookup_cache;

SELECT 'Password reset logs table fixed with all required columns!' as status;