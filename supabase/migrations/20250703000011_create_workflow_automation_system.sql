-- Create workflow automation and notification system

-- Workflow rules table for defining automation triggers
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'job', 'inspection', 'milestone', 'team_assignment', 'material_order', 'quote_request')),
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('status_change', 'date_reached', 'field_updated', 'created', 'overdue', 'completed')),
  trigger_conditions JSONB DEFAULT '{}'::JSONB, -- Conditions that must be met
  actions JSONB DEFAULT '[]'::JSONB, -- Actions to take when triggered
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions table for tracking automation runs
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_rule_id UUID NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL, -- ID of the record that triggered the workflow
  entity_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}'::JSONB, -- Data that caused the trigger
  actions_executed JSONB DEFAULT '[]'::JSONB, -- Actions that were performed
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'sms', 'in_app', 'webhook')),
  category TEXT NOT NULL CHECK (category IN ('job_status', 'milestone', 'assignment', 'reminder', 'alert', 'invoice', 'quote')),
  subject TEXT, -- For email notifications
  message_template TEXT NOT NULL, -- Template with placeholders
  variables JSONB DEFAULT '[]'::JSONB, -- Available template variables
  default_template BOOLEAN DEFAULT false, -- System default templates
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'contact', 'vendor', 'subcontractor', 'external')),
  recipient_id UUID, -- user_id, contact_id, vendor_id, etc.
  recipient_email TEXT,
  recipient_phone TEXT,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'in_app', 'webhook')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB, -- Additional data/context
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  entity_id UUID, -- Related job, lead, etc.
  entity_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences table for user preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly', 'disabled')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Automated reminders table for scheduled notifications
CREATE TABLE IF NOT EXISTS automated_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_date', 'follow_up', 'payment', 'inspection', 'delivery')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_frequency TEXT CHECK (reminder_frequency IN ('once', 'daily', 'weekly', 'monthly')),
  max_reminders INTEGER DEFAULT 1,
  reminders_sent INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance

--CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger_event ON workflow_rules(trigger_event, active);

--CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_status ON workflow_executions(tenant_id, status);
--CREATE INDEX IF NOT EXISTS idx_workflow_executions_rule_id ON workflow_executions(workflow_rule_id);
--CREATE INDEX IF NOT EXISTS idx_workflow_executions_entity ON workflow_executions(entity_type, entity_id);

--CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_type ON notification_templates(tenant_id, --template_type, active);
--CREATE INDEX IF NOT EXISTS idx_notification_templates_category ON notification_templates(category, active);

--CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
--CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
--CREATE INDEX IF NOT EXISTS idx_notifications_type_category ON notifications(notification_type, category);
--CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
--CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

--CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_category ON notification_preferences(user_id, category);

--CREATE INDEX IF NOT EXISTS idx_automated_reminders_tenant_remind_at ON automated_reminders(tenant_id, remind_at, active);
--CREATE INDEX IF NOT EXISTS idx_automated_reminders_entity ON automated_reminders(entity_type, entity_id);

-- Enable RLS
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_rules
CREATE POLICY "Users can view workflow rules in their tenant" ON workflow_rules
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage workflow rules in their tenant" ON workflow_rules
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for workflow_executions
CREATE POLICY "Users can view workflow executions in their tenant" ON workflow_executions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can manage workflow executions" ON workflow_executions
  FOR ALL USING (true); -- Allow system processes to manage executions

-- RLS Policies for notification_templates
CREATE POLICY "Users can view notification templates in their tenant" ON notification_templates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
    OR default_template = true
  );

CREATE POLICY "Users can manage notification templates in their tenant" ON notification_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- RLS Policies for notifications
CREATE POLICY "Users can view notifications in their tenant" ON notifications
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
    OR recipient_id = auth.uid()
  );

CREATE POLICY "System can manage notifications" ON notifications
  FOR ALL USING (true); -- Allow system processes to manage notifications

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for automated_reminders
CREATE POLICY "Users can view automated reminders in their tenant" ON automated_reminders
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage automated reminders in their tenant" ON automated_reminders
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_workflow_rules_updated_at BEFORE UPDATE ON workflow_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automated_reminders_updated_at BEFORE UPDATE ON automated_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: Default notification templates are now handled in the system_notification_templates table
-- This keeps templates independent of tenant IDs and avoids foreign key constraints

-- Create workflow automation function (PostgreSQL function to handle triggers)
CREATE OR REPLACE FUNCTION trigger_workflow_automation()
RETURNS TRIGGER AS $$
DECLARE
  rule_record workflow_rules%ROWTYPE;
  execution_id UUID;
  tenant_id_val UUID;
BEGIN
  -- Get tenant_id from the record
  CASE TG_TABLE_NAME
    WHEN 'jobs' THEN tenant_id_val := NEW.tenant_id;
    WHEN 'leads' THEN tenant_id_val := NEW.tenant_id;
    WHEN 'job_inspections' THEN 
      SELECT j.tenant_id INTO tenant_id_val FROM jobs j WHERE j.id = NEW.job_id;
    WHEN 'job_milestones' THEN 
      SELECT j.tenant_id INTO tenant_id_val FROM jobs j WHERE j.id = NEW.job_id;
    ELSE tenant_id_val := NULL;
  END CASE;

  IF tenant_id_val IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find applicable workflow rules
  FOR rule_record IN 
    SELECT * FROM workflow_rules 
    WHERE tenant_id = tenant_id_val 
      AND entity_type = TG_TABLE_NAME 
      AND trigger_event = 'status_change'
      AND active = true
  LOOP
    -- Create workflow execution record
    INSERT INTO workflow_executions (
      tenant_id, workflow_rule_id, entity_id, entity_type, 
      trigger_data, status
    ) VALUES (
      tenant_id_val, rule_record.id, NEW.id, TG_TABLE_NAME,
      jsonb_build_object(
        'old_status', COALESCE(OLD.status, ''),
        'new_status', NEW.status,
        'changed_at', NOW()
      ),
      'pending'
    ) RETURNING id INTO execution_id;

    -- Here you would typically queue the workflow for background processing
    -- For now, we'll just log that a workflow was triggered
    
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for workflow automation on key tables
CREATE TRIGGER jobs_workflow_trigger
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation();

CREATE TRIGGER leads_workflow_trigger
  AFTER UPDATE OF status ON leads
  FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation();

CREATE TRIGGER inspections_workflow_trigger
  AFTER UPDATE OF status ON job_inspections
  FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation();

CREATE TRIGGER milestones_workflow_trigger
  AFTER UPDATE OF status ON job_milestones
  FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation();