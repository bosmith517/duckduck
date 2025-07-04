-- Fix default templates insertion by temporarily disabling foreign key checks
-- or using a different approach for system templates

-- Option 1: Create templates without tenant_id constraint for system defaults
-- First, let's modify the table to allow null tenant_id for system templates
DO $$
BEGIN
    -- Check if we can modify the constraint
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'notification_templates_tenant_id_fkey' 
               AND table_name = 'notification_templates') THEN
        
        -- Drop the existing foreign key constraint
        ALTER TABLE notification_templates DROP CONSTRAINT notification_templates_tenant_id_fkey;
        
        -- Make tenant_id nullable for system templates
        ALTER TABLE notification_templates ALTER COLUMN tenant_id DROP NOT NULL;
        
        -- Add a new constraint that allows null tenant_id for default templates
        ALTER TABLE notification_templates 
        ADD CONSTRAINT notification_templates_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED;
        
        -- Add a check constraint to ensure either tenant_id is provided OR it's a default template
        ALTER TABLE notification_templates 
        ADD CONSTRAINT check_tenant_or_default 
        CHECK (tenant_id IS NOT NULL OR default_template = true);
        
        RAISE NOTICE 'Modified notification_templates constraints for system templates';
    END IF;
END $$;

-- Now insert the default templates with NULL tenant_id
INSERT INTO notification_templates (tenant_id, template_name, template_type, category, subject, message_template, variables, default_template) VALUES
(NULL, 'Job Status Update', 'email', 'job_status', 'Job Status Update: {{job_title}}', 
 'Hello {{contact_name}},

Your job "{{job_title}}" status has been updated to: {{new_status}}

{{status_message}}

Best regards,
{{company_name}}',
 '["contact_name", "job_title", "new_status", "status_message", "company_name"]'::jsonb, true),

(NULL, 'Payment Milestone Due', 'email', 'milestone', 'Payment Due: {{milestone_name}}', 
 'Hello {{contact_name}},

A payment milestone is now due for your job "{{job_title}}":

Milestone: {{milestone_name}}
Amount: {{amount}}
Due Date: {{due_date}}

Please contact us to arrange payment.

Best regards,
{{company_name}}',
 '["contact_name", "job_title", "milestone_name", "amount", "due_date", "company_name"]'::jsonb, true),

(NULL, 'Team Assignment', 'in_app', 'assignment', 'New Job Assignment', 
 'You have been assigned to job: {{job_title}}
Role: {{role}}
Start Date: {{start_date}}

{{assignment_notes}}',
 '["job_title", "role", "start_date", "assignment_notes"]'::jsonb, true),

(NULL, 'Inspection Reminder', 'email', 'reminder', 'Inspection Reminder: {{inspection_type}}', 
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

(NULL, 'Quote Request Response', 'email', 'quote', 'Quote Request: {{request_title}}', 
 'Hello {{vendor_name}},

We have a new quote request for your review:

Project: {{request_title}}
Deadline: {{response_deadline}}
Delivery Date: {{delivery_date}}

Please review the attached details and submit your quote by the deadline.

Best regards,
{{company_name}}',
 '["vendor_name", "request_title", "response_deadline", "delivery_date", "company_name"]'::jsonb, true)

ON CONFLICT (id) DO NOTHING;