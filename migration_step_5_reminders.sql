-- Step 5: Create automated_reminders table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_automated_reminders_tenant_remind_at ON automated_reminders(tenant_id, remind_at, active);
CREATE INDEX IF NOT EXISTS idx_automated_reminders_entity ON automated_reminders(entity_type, entity_id);

-- Enable RLS
ALTER TABLE automated_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view automated reminders in their tenant" ON automated_reminders;
DROP POLICY IF EXISTS "Users can manage automated reminders in their tenant" ON automated_reminders;

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

-- Create trigger
DROP TRIGGER IF EXISTS update_automated_reminders_updated_at ON automated_reminders;
CREATE TRIGGER update_automated_reminders_updated_at BEFORE UPDATE ON automated_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();