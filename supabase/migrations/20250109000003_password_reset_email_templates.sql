-- Insert password reset email templates (only if email_templates table exists)
DO $$ 
BEGIN
    -- Check if email_templates table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'email_templates'
    ) THEN
        -- Table doesn't exist, skip this migration
        RAISE NOTICE 'email_templates table does not exist, skipping email template inserts';
        RETURN;
    END IF;
    -- Password reset request template
    IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = 'password_reset') THEN
        INSERT INTO public.email_templates (
            id, tenant_id, name, description, subject, html_template, text_template,
            variables, category, is_active, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            NULL, -- System template
            'password_reset',
            'Password reset request email',
            'Reset Your Password - {{tenant_name}}',
            '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center;">
                            {{#if tenant_logo_url}}
                                <img src="{{tenant_logo_url}}" alt="{{tenant_name}}" style="max-width: 200px; height: auto;">
                            {{else}}
                                <h1 style="margin: 0; color: #333333;">{{tenant_name}}</h1>
                            {{/if}}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px;">
                            <h2 style="color: #333333; margin-bottom: 20px;">Password Reset Request</h2>
                            <p style="color: #666666; line-height: 1.6;">Hi {{user_name}},</p>
                            <p style="color: #666666; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
                            <table cellpadding="0" cellspacing="0" width="100%" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{{reset_link}}" style="display: inline-block; padding: 14px 30px; background-color: {{primary_color}}; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #666666; line-height: 1.6;">Or copy and paste this link into your browser:</p>
                            <p style="color: #666666; line-height: 1.6; word-break: break-all; background-color: #f4f4f4; padding: 10px; border-radius: 4px;">{{reset_link}}</p>
                            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0;">
                                <p style="color: #856404; margin: 0; font-size: 14px;"><strong>Important:</strong> This link will expire in {{expiry_hours}} hours. For security reasons, please do not share this link with anyone.</p>
                            </div>
                            <p style="color: #666666; line-height: 1.6;">If you didn''t request a password reset, please ignore this email or contact support if you have concerns.</p>
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                                <p style="color: #999999; font-size: 14px; line-height: 1.6;">
                                    <strong>Security Information:</strong><br>
                                    Request Time: {{request_time}}<br>
                                    Request IP: {{request_ip}}<br>
                                    Device: {{request_device}}
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; text-align: center; color: #999999; font-size: 14px;">
                            <p style="margin: 0;">© {{current_year}} {{tenant_name}}. All rights reserved.</p>
                            {{#if support_email}}
                                <p style="margin: 10px 0 0 0;">Need help? Contact us at <a href="mailto:{{support_email}}" style="color: {{primary_color}};">{{support_email}}</a></p>
                            {{/if}}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
            'Hi {{user_name}},

We received a request to reset your password.

To reset your password, click the following link:
{{reset_link}}

This link will expire in {{expiry_hours}} hours.

Security Information:
Request Time: {{request_time}}
Request IP: {{request_ip}}
Device: {{request_device}}

If you didn''t request a password reset, please ignore this email or contact support if you have concerns.

© {{current_year}} {{tenant_name}}. All rights reserved.
{{#if support_email}}Need help? Contact us at {{support_email}}{{/if}}',
            ARRAY[
                'user_name', 'tenant_name', 'tenant_logo_url', 'reset_link', 'expiry_hours',
                'request_time', 'request_ip', 'request_device', 'current_year',
                'primary_color', 'support_email'
            ],
            'authentication',
            TRUE,
            NOW(),
            NOW()
        );
    END IF;
    
    -- Password change notification template
    IF NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = 'password_changed') THEN
        INSERT INTO public.email_templates (
            id, tenant_id, name, description, subject, html_template, text_template,
            variables, category, is_active, created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            NULL,
            'password_changed',
            'Password change notification email',
            'Your Password Has Been Changed - {{tenant_name}}',
            '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px 0;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center;">
                            {{#if tenant_logo_url}}
                                <img src="{{tenant_logo_url}}" alt="{{tenant_name}}" style="max-width: 200px; height: auto;">
                            {{else}}
                                <h1 style="margin: 0; color: #333333;">{{tenant_name}}</h1>
                            {{/if}}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px;">
                            <h2 style="color: #333333; margin-bottom: 20px;">Password Successfully Changed</h2>
                            <p style="color: #666666; line-height: 1.6;">Hi {{user_name}},</p>
                            <p style="color: #666666; line-height: 1.6;">Your password has been successfully changed.</p>
                            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
                                <p style="color: #155724; margin: 0;">
                                    <strong>✓ Password changed successfully</strong><br>
                                    Changed on: {{change_time}}
                                </p>
                            </div>
                            <p style="color: #666666; line-height: 1.6;">If you did not make this change, please contact our support team immediately and secure your account.</p>
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                                <p style="color: #999999; font-size: 14px; line-height: 1.6;">
                                    <strong>Security Information:</strong><br>
                                    Change Time: {{change_time}}<br>
                                    IP Address: {{change_ip}}<br>
                                    Device: {{change_device}}
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px 40px 40px; text-align: center; color: #999999; font-size: 14px;">
                            <p style="margin: 0;">© {{current_year}} {{tenant_name}}. All rights reserved.</p>
                            {{#if support_email}}
                                <p style="margin: 10px 0 0 0;">Need help? Contact us at <a href="mailto:{{support_email}}" style="color: {{primary_color}};">{{support_email}}</a></p>
                            {{/if}}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
            'Hi {{user_name}},

Your password has been successfully changed.

Changed on: {{change_time}}

If you did not make this change, please contact our support team immediately and secure your account.

Security Information:
Change Time: {{change_time}}
IP Address: {{change_ip}}
Device: {{change_device}}

© {{current_year}} {{tenant_name}}. All rights reserved.
{{#if support_email}}Need help? Contact us at {{support_email}}{{/if}}',
            ARRAY[
                'user_name', 'tenant_name', 'tenant_logo_url', 'change_time',
                'change_ip', 'change_device', 'current_year', 'primary_color', 'support_email'
            ],
            'authentication',
            TRUE,
            NOW(),
            NOW()
        );
    END IF;
END $$;