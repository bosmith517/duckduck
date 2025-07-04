-- Create a separate table for system-wide notification templates
-- This is the proper way to handle global templates without breaking foreign key constraints

-- Create system_notification_templates table
CREATE TABLE IF NOT EXISTS system_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'sms', 'in_app', 'webhook')),
  category TEXT NOT NULL CHECK (category IN ('job_status', 'milestone', 'assignment', 'reminder', 'alert', 'invoice', 'quote')),
  subject TEXT,
  message_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_system_notification_templates_category ON system_notification_templates(category, active);

-- Insert system-wide default templates
INSERT INTO system_notification_templates (template_name, template_type, category, subject, message_template, variables) VALUES
('Job Status Update', 'email', 'job_status', 'Job Status Update: {{job_title}}', 
 'Hello {{contact_name}},

Your job "{{job_title}}" status has been updated to: {{new_status}}

{{status_message}}

Best regards,
{{company_name}}',
 '["contact_name", "job_title", "new_status", "status_message", "company_name"]'::jsonb),

('Payment Milestone Due', 'email', 'milestone', 'Payment Due: {{milestone_name}}', 
 'Hello {{contact_name}},

A payment milestone is now due for your job "{{job_title}}":

Milestone: {{milestone_name}}
Amount: {{amount}}
Due Date: {{due_date}}

Please contact us to arrange payment.

Best regards,
{{company_name}}',
 '["contact_name", "job_title", "milestone_name", "amount", "due_date", "company_name"]'::jsonb),

('Team Assignment', 'in_app', 'assignment', 'New Job Assignment', 
 'You have been assigned to job: {{job_title}}
Role: {{role}}
Start Date: {{start_date}}

{{assignment_notes}}',
 '["job_title", "role", "start_date", "assignment_notes"]'::jsonb),

('Inspection Reminder', 'email', 'reminder', 'Inspection Reminder: {{inspection_type}}', 
 'Hello,

This is a reminder that the following inspection is due:

Job: {{job_title}}
Inspection: {{inspection_type}}
Due Date: {{due_date}}
Location: {{job_address}}

Please schedule this inspection as soon as possible.

Best regards,
{{company_name}}',
 '["job_title", "inspection_type", "due_date", "job_address", "company_name"]'::jsonb),

('Quote Request Response', 'email', 'quote', 'Quote Request: {{request_title}}', 
 'Hello {{vendor_name}},

We have a new quote request for your review:

Project: {{request_title}}
Deadline: {{response_deadline}}
Delivery Date: {{delivery_date}}

Please review the attached details and submit your quote by the deadline.

Best regards,
{{company_name}}',
 '["vendor_name", "request_title", "response_deadline", "delivery_date", "company_name"]'::jsonb)

ON CONFLICT (template_name) DO NOTHING;

-- Modify notification_templates table to reference system templates
ALTER TABLE notification_templates 
ADD COLUMN IF NOT EXISTS system_template_id UUID REFERENCES system_notification_templates(id);

-- Add comment to clarify the purpose
COMMENT ON TABLE system_notification_templates IS 'System-wide notification templates that can be used as a base by all tenants';
COMMENT ON COLUMN notification_templates.system_template_id IS 'Reference to system template this was created from';

-- Create a view to easily access all templates (system + tenant-specific)
CREATE OR REPLACE VIEW all_notification_templates AS
SELECT 
    nt.id,
    nt.tenant_id,
    COALESCE(nt.template_name, st.template_name) as template_name,
    COALESCE(nt.template_type, st.template_type) as template_type,
    COALESCE(nt.category, st.category) as category,
    COALESCE(nt.subject, st.subject) as subject,
    COALESCE(nt.message_template, st.message_template) as message_template,
    COALESCE(nt.variables, st.variables) as variables,
    nt.default_template,
    nt.active,
    nt.system_template_id,
    CASE WHEN nt.system_template_id IS NOT NULL THEN true ELSE false END as is_from_system_template
FROM notification_templates nt
LEFT JOIN system_notification_templates st ON nt.system_template_id = st.id

UNION ALL

SELECT 
    st.id,
    NULL as tenant_id,
    st.template_name,
    st.template_type,
    st.category,
    st.subject,
    st.message_template,
    st.variables,
    true as default_template,
    st.active,
    NULL as system_template_id,
    false as is_from_system_template
FROM system_notification_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM notification_templates nt 
    WHERE nt.system_template_id = st.id
);

-- Create function to copy system template to tenant
CREATE OR REPLACE FUNCTION copy_system_template_to_tenant(
    p_tenant_id UUID,
    p_system_template_id UUID
) RETURNS UUID AS $$
DECLARE
    v_new_template_id UUID;
BEGIN
    INSERT INTO notification_templates (
        tenant_id,
        template_name,
        template_type,
        category,
        subject,
        message_template,
        variables,
        system_template_id,
        default_template,
        active
    )
    SELECT 
        p_tenant_id,
        template_name || ' (Copy)',
        template_type,
        category,
        subject,
        message_template,
        variables,
        id,
        false,
        true
    FROM system_notification_templates
    WHERE id = p_system_template_id
    RETURNING id INTO v_new_template_id;
    
    RETURN v_new_template_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_system_notification_templates_updated_at 
BEFORE UPDATE ON system_notification_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant appropriate permissions (adjust based on your security model)
GRANT SELECT ON system_notification_templates TO authenticated;
GRANT SELECT ON all_notification_templates TO authenticated;