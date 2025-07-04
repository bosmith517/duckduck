-- Better approach: Insert default templates for each existing tenant
-- This maintains foreign key integrity

-- First, let's check if we have any tenants
DO $$
DECLARE
    tenant_count INTEGER;
    tenant_record RECORD;
BEGIN
    SELECT COUNT(*) INTO tenant_count FROM tenants;
    
    IF tenant_count = 0 THEN
        RAISE NOTICE 'No tenants found in the database. Cannot insert default templates.';
        RAISE NOTICE 'Default templates will be created when tenants are added.';
    ELSE
        RAISE NOTICE 'Found % tenant(s). Creating default templates for each tenant.', tenant_count;
        
        -- Loop through each tenant and create default templates
        FOR tenant_record IN SELECT id, name FROM tenants LOOP
            
            -- Insert default templates for this tenant (skip if already exists)
            INSERT INTO notification_templates (tenant_id, template_name, template_type, category, subject, message_template, variables, default_template) VALUES
            (tenant_record.id, 'Job Status Update', 'email', 'job_status', 'Job Status Update: {{job_title}}', 
             'Hello {{contact_name}},

Your job "{{job_title}}" status has been updated to: {{new_status}}

{{status_message}}

Best regards,
{{company_name}}',
             '["contact_name", "job_title", "new_status", "status_message", "company_name"]'::jsonb, true),

            (tenant_record.id, 'Payment Milestone Due', 'email', 'milestone', 'Payment Due: {{milestone_name}}', 
             'Hello {{contact_name}},

A payment milestone is now due for your job "{{job_title}}":

Milestone: {{milestone_name}}
Amount: {{amount}}
Due Date: {{due_date}}

Please contact us to arrange payment.

Best regards,
{{company_name}}',
             '["contact_name", "job_title", "milestone_name", "amount", "due_date", "company_name"]'::jsonb, true),

            (tenant_record.id, 'Team Assignment', 'in_app', 'assignment', 'New Job Assignment', 
             'You have been assigned to job: {{job_title}}
Role: {{role}}
Start Date: {{start_date}}

{{assignment_notes}}',
             '["job_title", "role", "start_date", "assignment_notes"]'::jsonb, true),

            (tenant_record.id, 'Inspection Reminder', 'email', 'reminder', 'Inspection Reminder: {{inspection_type}}', 
             'Hello,

This is a reminder that the following inspection is due:

Job: {{job_title}}
Inspection: {{inspection_type}}
Due Date: {{due_date}}
Location: {{job_address}}

Please schedule this inspection as soon as possible.

Best regards,
{{company_name}}',
             '["job_title", "inspection_type", "due_date", "job_address", "company_name"]'::jsonb, true),

            (tenant_record.id, 'Quote Request Response', 'email', 'quote', 'Quote Request: {{request_title}}', 
             'Hello {{vendor_name}},

We have a new quote request for your review:

Project: {{request_title}}
Deadline: {{response_deadline}}
Delivery Date: {{delivery_date}}

Please review the attached details and submit your quote by the deadline.

Best regards,
{{company_name}}',
             '["vendor_name", "request_title", "response_deadline", "delivery_date", "company_name"]'::jsonb, true)
            
            ON CONFLICT DO NOTHING;
            
            RAISE NOTICE 'Created default templates for tenant: %', tenant_record.name;
        END LOOP;
    END IF;
END $$;

-- Create a function to automatically add default templates for new tenants
CREATE OR REPLACE FUNCTION create_default_templates_for_tenant()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default templates for the new tenant
    INSERT INTO notification_templates (tenant_id, template_name, template_type, category, subject, message_template, variables, default_template) VALUES
    (NEW.id, 'Job Status Update', 'email', 'job_status', 'Job Status Update: {{job_title}}', 
     'Hello {{contact_name}},

Your job "{{job_title}}" status has been updated to: {{new_status}}

{{status_message}}

Best regards,
{{company_name}}',
     '["contact_name", "job_title", "new_status", "status_message", "company_name"]'::jsonb, true),

    (NEW.id, 'Payment Milestone Due', 'email', 'milestone', 'Payment Due: {{milestone_name}}', 
     'Hello {{contact_name}},

A payment milestone is now due for your job "{{job_title}}":

Milestone: {{milestone_name}}
Amount: {{amount}}
Due Date: {{due_date}}

Please contact us to arrange payment.

Best regards,
{{company_name}}',
     '["contact_name", "job_title", "milestone_name", "amount", "due_date", "company_name"]'::jsonb, true),

    (NEW.id, 'Team Assignment', 'in_app', 'assignment', 'New Job Assignment', 
     'You have been assigned to job: {{job_title}}
Role: {{role}}
Start Date: {{start_date}}

{{assignment_notes}}',
     '["job_title", "role", "start_date", "assignment_notes"]'::jsonb, true),

    (NEW.id, 'Inspection Reminder', 'email', 'reminder', 'Inspection Reminder: {{inspection_type}}', 
     'Hello,

This is a reminder that the following inspection is due:

Job: {{job_title}}
Inspection: {{inspection_type}}
Due Date: {{due_date}}
Location: {{job_address}}

Please schedule this inspection as soon as possible.

Best regards,
{{company_name}}',
     '["job_title", "inspection_type", "due_date", "job_address", "company_name"]'::jsonb, true),

    (NEW.id, 'Quote Request Response', 'email', 'quote', 'Quote Request: {{request_title}}', 
     'Hello {{vendor_name}},

We have a new quote request for your review:

Project: {{request_title}}
Deadline: {{response_deadline}}
Delivery Date: {{delivery_date}}

Please review the attached details and submit your quote by the deadline.

Best regards,
{{company_name}}',
     '["vendor_name", "request_title", "response_deadline", "delivery_date", "company_name"]'::jsonb, true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically add default templates for new tenants
DROP TRIGGER IF EXISTS create_default_templates_on_tenant_insert ON tenants;
CREATE TRIGGER create_default_templates_on_tenant_insert
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION create_default_templates_for_tenant();

-- Check results
SELECT 
    COUNT(DISTINCT tenant_id) as tenant_count,
    COUNT(*) as total_templates,
    COUNT(*) FILTER (WHERE default_template = true) as default_templates
FROM notification_templates;