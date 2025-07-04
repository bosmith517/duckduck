-- Step 4: Create notification_preferences table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_category ON notification_preferences(user_id, category);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;

CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Create trigger
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();