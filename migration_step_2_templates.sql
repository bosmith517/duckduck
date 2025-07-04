-- Step 2: Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'sms', 'in_app', 'webhook')),
  category TEXT NOT NULL CHECK (category IN ('job_status', 'milestone', 'assignment', 'reminder', 'alert', 'invoice', 'quote')),
  subject TEXT,
  message_template TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::JSONB,
  default_template BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_type ON notification_templates(tenant_id, template_type, active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_category ON notification_templates(category, active);

-- Enable RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view notification templates in their tenant" ON notification_templates;
DROP POLICY IF EXISTS "Users can manage notification templates in their tenant" ON notification_templates;

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

-- Create trigger
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();