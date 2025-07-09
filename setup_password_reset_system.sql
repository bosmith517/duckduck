-- =====================================================
-- PASSWORD RESET SYSTEM SETUP
-- Run this script in your Supabase SQL editor
-- =====================================================

-- 1. Create password reset tracking table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired', 'cancelled')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    request_source TEXT DEFAULT 'user' CHECK (request_source IN ('user', 'admin', 'system')),
    initiated_by UUID REFERENCES auth.users(id),
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    email_id TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON public.password_reset_requests(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token_hash ON public.password_reset_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at ON public.password_reset_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_tenant_id ON public.password_reset_requests(tenant_id);

-- 3. Create rate limiting table
CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('email', 'ip')),
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_rate_limits_identifier 
    ON public.password_reset_rate_limits(identifier, identifier_type);

-- 4. Enable Row Level Security
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Users can view their own password reset requests
CREATE POLICY "Users can view own password reset requests" ON public.password_reset_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all password reset requests for their tenant
CREATE POLICY "Admins can view tenant password reset requests" ON public.password_reset_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND tenant_id = password_reset_requests.tenant_id
        )
    );

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access to password resets" ON public.password_reset_requests
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to rate limits" ON public.password_reset_rate_limits
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- 6. Create cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_resets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark expired requests
    UPDATE public.password_reset_requests
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    -- Clean up old rate limit entries (older than 24 hours)
    DELETE FROM public.password_reset_rate_limits
    WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- 7. Create update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers
DO $$
BEGIN
    -- Create trigger for password_reset_requests if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_password_reset_requests_updated_at'
    ) THEN
        CREATE TRIGGER update_password_reset_requests_updated_at
            BEFORE UPDATE ON public.password_reset_requests
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Create trigger for password_reset_rate_limits if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_password_reset_rate_limits_updated_at'
    ) THEN
        CREATE TRIGGER update_password_reset_rate_limits_updated_at
            BEFORE UPDATE ON public.password_reset_rate_limits
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 9. Add password reset notification templates (if using system_notification_templates)
DO $$ 
BEGIN
    -- Only add if system_notification_templates table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_notification_templates'
    ) THEN
        -- Password reset request template
        IF NOT EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Reset Request') THEN
            INSERT INTO system_notification_templates (
                template_name, 
                template_type, 
                category, 
                subject, 
                message_template, 
                variables
            ) VALUES (
                'Password Reset Request',
                'email',
                'alert',
                'Reset Your Password - {{company_name}}',
                'Hello {{user_name}},

We received a request to reset your password for {{company_name}}.

To reset your password, please click the following link:
{{reset_link}}

This link will expire in {{expiry_hours}} hours.

If you didn''t request a password reset, please ignore this email or contact support if you have concerns.

Security Information:
Request Time: {{request_time}}
Request IP: {{request_ip}}
Device: {{request_device}}

Best regards,
{{company_name}}',
                '["user_name", "company_name", "reset_link", "expiry_hours", "request_time", "request_ip", "request_device"]'::jsonb
            );
        END IF;
        
        -- Password change notification template
        IF NOT EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Changed Notification') THEN
            INSERT INTO system_notification_templates (
                template_name, 
                template_type, 
                category, 
                subject, 
                message_template, 
                variables
            ) VALUES (
                'Password Changed Notification',
                'email',
                'alert',
                'Your Password Has Been Changed - {{company_name}}',
                'Hello {{user_name}},

Your password has been successfully changed for your {{company_name}} account.

Changed on: {{change_time}}

If you did not make this change, please contact our support team immediately and secure your account.

Security Information:
Change Time: {{change_time}}
IP Address: {{change_ip}}
Device: {{change_device}}

Best regards,
{{company_name}}',
                '["user_name", "company_name", "change_time", "change_ip", "change_device"]'::jsonb
            );
        END IF;
        
        RAISE NOTICE 'Password reset notification templates added successfully';
    ELSE
        RAISE NOTICE 'system_notification_templates table not found - skipping template creation';
    END IF;
END $$;

-- 10. Grant necessary permissions (optional - depending on your setup)
-- GRANT SELECT ON public.password_reset_requests TO authenticated;
-- GRANT ALL ON public.password_reset_requests TO service_role;
-- GRANT ALL ON public.password_reset_rate_limits TO service_role;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the setup:
-- =====================================================

-- Check if tables were created
SELECT 'password_reset_requests table' as item, 
       EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_requests') as exists;
       
SELECT 'password_reset_rate_limits table' as item,
       EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_rate_limits') as exists;

-- Check if RLS is enabled
SELECT 'RLS on password_reset_requests' as item,
       relrowsecurity as enabled
FROM pg_class
WHERE relname = 'password_reset_requests';

SELECT 'RLS on password_reset_rate_limits' as item,
       relrowsecurity as enabled
FROM pg_class
WHERE relname = 'password_reset_rate_limits';

-- Count policies
SELECT 'Number of policies on password_reset_requests' as item, 
       COUNT(*)::text as count
FROM pg_policies 
WHERE tablename = 'password_reset_requests';

-- Check if cleanup function exists
SELECT 'cleanup_expired_password_resets function' as item,
       EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_expired_password_resets') as exists;

-- =====================================================
-- CLEANUP (if you need to remove everything)
-- Uncomment and run if needed:
-- =====================================================
/*
DROP TABLE IF EXISTS public.password_reset_rate_limits CASCADE;
DROP TABLE IF EXISTS public.password_reset_requests CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_password_resets();

-- Remove templates if they exist
DELETE FROM system_notification_templates 
WHERE template_name IN ('Password Reset Request', 'Password Changed Notification');
*/