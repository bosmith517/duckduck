-- =====================================================
-- ADD ONLY PASSWORD RESET NOTIFICATION TEMPLATES
-- Run this if tables exist but templates are missing
-- =====================================================

-- Add notification templates for password reset
DO $$ 
BEGIN
    -- Check if system_notification_templates table exists
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
            RAISE NOTICE 'Successfully added Password Reset Request template';
        ELSE
            RAISE NOTICE 'Password Reset Request template already exists';
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
            RAISE NOTICE 'Successfully added Password Changed Notification template';
        ELSE
            RAISE NOTICE 'Password Changed Notification template already exists';
        END IF;
        
    ELSE
        RAISE WARNING 'system_notification_templates table not found - cannot add templates';
        RAISE WARNING 'The password reset system will use Supabase default emails instead';
    END IF;
END $$;

-- Show what templates exist now
SELECT template_name, template_type, category 
FROM system_notification_templates 
WHERE template_name LIKE '%Password%'
ORDER BY template_name;