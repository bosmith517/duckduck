-- =====================================================
-- VERIFY PASSWORD RESET SYSTEM
-- Check what's already installed
-- =====================================================

-- 1. Check if tables exist
SELECT 
    'password_reset_requests' as table_name,
    EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_requests') as exists,
    (SELECT COUNT(*) FROM password_reset_requests) as row_count
UNION ALL
SELECT 
    'password_reset_rate_limits' as table_name,
    EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'password_reset_rate_limits') as exists,
    (SELECT COUNT(*) FROM password_reset_rate_limits) as row_count;

-- 2. Check columns in password_reset_requests
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'password_reset_requests'
ORDER BY ordinal_position;

-- 3. Check existing policies
SELECT pol.polname as policy_name, 
       pol.polcmd as command,
       pg_get_expr(pol.polqual, pol.polrelid) as using_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'password_reset_requests';

-- 4. Check if RLS is enabled
SELECT 
    'password_reset_requests' as table_name,
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class
WHERE relname = 'password_reset_requests';

-- 5. Check if functions exist
SELECT 
    'cleanup_expired_password_resets' as function_name,
    EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_expired_password_resets') as exists
UNION ALL
SELECT 
    'update_updated_at_column' as function_name,
    EXISTS (SELECT FROM pg_proc WHERE proname = 'update_updated_at_column') as exists;

-- 6. Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('password_reset_requests', 'password_reset_rate_limits');

-- 7. Check notification templates (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_notification_templates') THEN
        RAISE NOTICE 'Checking for password reset templates...';
        
        -- This will show results in the messages tab
        IF EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Reset Request') THEN
            RAISE NOTICE '✓ Password Reset Request template exists';
        ELSE
            RAISE NOTICE '✗ Password Reset Request template NOT FOUND';
        END IF;
        
        IF EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Changed Notification') THEN
            RAISE NOTICE '✓ Password Changed Notification template exists';
        ELSE
            RAISE NOTICE '✗ Password Changed Notification template NOT FOUND';
        END IF;
    ELSE
        RAISE NOTICE 'system_notification_templates table does not exist';
    END IF;
END $$;

-- =====================================================
-- ONLY ADD MISSING TEMPLATES
-- Run this section if templates are missing
-- =====================================================

/*
-- Add missing notification templates
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_notification_templates') THEN
        -- Add Password Reset Request template if missing
        IF NOT EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Reset Request') THEN
            INSERT INTO system_notification_templates (
                template_name, template_type, category, subject, message_template, variables
            ) VALUES (
                'Password Reset Request',
                'email',
                'alert',
                'Reset Your Password - {{company_name}}',
                'Hello {{user_name}},\n\nWe received a request to reset your password for {{company_name}}.\n\nTo reset your password, please click the following link:\n{{reset_link}}\n\nThis link will expire in {{expiry_hours}} hours.\n\nIf you didn''t request a password reset, please ignore this email or contact support if you have concerns.\n\nSecurity Information:\nRequest Time: {{request_time}}\nRequest IP: {{request_ip}}\nDevice: {{request_device}}\n\nBest regards,\n{{company_name}}',
                '["user_name", "company_name", "reset_link", "expiry_hours", "request_time", "request_ip", "request_device"]'::jsonb
            );
            RAISE NOTICE 'Added Password Reset Request template';
        END IF;
        
        -- Add Password Changed Notification template if missing
        IF NOT EXISTS (SELECT 1 FROM system_notification_templates WHERE template_name = 'Password Changed Notification') THEN
            INSERT INTO system_notification_templates (
                template_name, template_type, category, subject, message_template, variables
            ) VALUES (
                'Password Changed Notification',
                'email',
                'alert',
                'Your Password Has Been Changed - {{company_name}}',
                'Hello {{user_name}},\n\nYour password has been successfully changed for your {{company_name}} account.\n\nChanged on: {{change_time}}\n\nIf you did not make this change, please contact our support team immediately and secure your account.\n\nSecurity Information:\nChange Time: {{change_time}}\nIP Address: {{change_ip}}\nDevice: {{change_device}}\n\nBest regards,\n{{company_name}}',
                '["user_name", "company_name", "change_time", "change_ip", "change_device"]'::jsonb
            );
            RAISE NOTICE 'Added Password Changed Notification template';
        END IF;
    END IF;
END $$;
*/