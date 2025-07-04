-- Check existing tenants and use one for the templates
DO $$
DECLARE
    v_tenant_id UUID;
    v_tenant_name TEXT;
BEGIN
    -- Get the first tenant from the database
    SELECT id, name INTO v_tenant_id, v_tenant_name
    FROM tenants
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenants found in the database. Please create a tenant first.';
    ELSE
        RAISE NOTICE 'Found tenant: % (ID: %)', v_tenant_name, v_tenant_id;
        
        -- Insert default templates for this tenant
        INSERT INTO notification_templates (tenant_id, template_name, template_type, category, subject, message_template, variables, default_template) VALUES
        (v_tenant_id, 'Job Status Update', 'email', 'job_status', 'Job Status Update: {{job_title}}', 
         'Hello {{contact_name}},

Your job "{{job_title}}" status has been updated to: {{new_status}}

{{status_message}}

Best regards,
{{company_name}}',
         '["contact_name", "job_title", "new_status", "status_message", "company_name"]'::jsonb, true),

        (v_tenant_id, 'Payment Milestone Due', 'email', 'milestone', 'Payment Due: {{milestone_name}}', 
         'Hello {{contact_name}},

A payment milestone is now due for your job "{{job_title}}":

Milestone: {{milestone_name}}
Amount: {{amount}}
Due Date: {{due_date}}

Please contact us to arrange payment.

Best regards,
{{company_name}}',
         '["contact_name", "job_title", "milestone_name", "amount", "due_date", "company_name"]'::jsonb, true),

        (v_tenant_id, 'Team Assignment', 'in_app', 'assignment', 'New Job Assignment', 
         'You have been assigned to job: {{job_title}}
Role: {{role}}
Start Date: {{start_date}}

{{assignment_notes}}',
         '["job_title", "role", "start_date", "assignment_notes"]'::jsonb, true),

        (v_tenant_id, 'Inspection Reminder', 'email', 'reminder', 'Inspection Reminder: {{inspection_type}}', 
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

        (v_tenant_id, 'Quote Request Response', 'email', 'quote', 'Quote Request: {{request_title}}', 
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
        
        RAISE NOTICE 'Successfully inserted default templates for tenant: %', v_tenant_name;
        
        -- Show count of templates
        SELECT COUNT(*) INTO v_tenant_id 
        FROM notification_templates 
        WHERE default_template = true;
        
        RAISE NOTICE 'Total default templates in database: %', v_tenant_id;
    END IF;
END $$;