-- Step 3: Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('user', 'contact', 'vendor', 'subcontractor', 'external')),
  recipient_id UUID,
  recipient_email TEXT,
  recipient_phone TEXT,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'in_app', 'webhook')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  entity_id UUID,
  entity_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type_category ON notifications(notification_type, category);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view notifications in their tenant" ON notifications;
DROP POLICY IF EXISTS "System can manage notifications" ON notifications;

CREATE POLICY "Users can view notifications in their tenant" ON notifications
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
    OR recipient_id = auth.uid()
  );

CREATE POLICY "System can manage notifications" ON notifications
  FOR ALL USING (true);

-- Create trigger
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();