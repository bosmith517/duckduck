-- Simple fix for job_activity_log RLS policies without problematic triggers

-- Enable RLS if not already enabled
ALTER TABLE job_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view activities for their tenant" ON job_activity_log;
DROP POLICY IF EXISTS "Users can insert activities for their tenant" ON job_activity_log;
DROP POLICY IF EXISTS "Users can update their own activities" ON job_activity_log;
DROP POLICY IF EXISTS "Service role has full access" ON job_activity_log;

-- Create comprehensive RLS policies
-- Policy for viewing activities
CREATE POLICY "Users can view activities for their tenant"
ON job_activity_log FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy for inserting activities
CREATE POLICY "Users can insert activities for their tenant"
ON job_activity_log FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy for updating activities (only your own)
CREATE POLICY "Users can update their own activities"
ON job_activity_log FOR UPDATE
USING (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
  AND user_id = auth.uid()
);

-- Service role bypass
CREATE POLICY "Service role has full access"
ON job_activity_log FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Job activity log RLS policies configured successfully';
END $$;