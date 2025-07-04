-- Create job_activity_log table
CREATE TABLE IF NOT EXISTS job_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  activity_category TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  reference_type TEXT,
  metadata JSONB DEFAULT '{}',
  is_visible_to_customer BOOLEAN DEFAULT false,
  is_milestone BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_activity_log_job_id ON job_activity_log(job_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_tenant_id ON job_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_user_id ON job_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_created_at ON job_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_activity_log_activity_type ON job_activity_log(activity_type);

-- Enable RLS
ALTER TABLE job_activity_log ENABLE ROW LEVEL SECURITY;



-- Create function to automatically update updated_at (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_job_activity_log_updated_at ON job_activity_log;

CREATE TRIGGER update_job_activity_log_updated_at BEFORE UPDATE ON job_activity_log
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some comments
COMMENT ON TABLE job_activity_log IS 'Tracks all activities and events related to jobs';
COMMENT ON COLUMN job_activity_log.activity_type IS 'Type of activity (e.g., job_created, estimate_sent, work_started, etc.)';
COMMENT ON COLUMN job_activity_log.activity_category IS 'Category of activity (system, user, customer, technician, admin)';
COMMENT ON COLUMN job_activity_log.is_visible_to_customer IS 'Whether this activity should be shown to customers in the portal';
COMMENT ON COLUMN job_activity_log.is_milestone IS 'Whether this activity represents a major milestone';
COMMENT ON COLUMN job_activity_log.metadata IS 'Additional data specific to the activity type';