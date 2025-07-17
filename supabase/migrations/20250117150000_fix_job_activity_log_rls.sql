-- Fix job_activity_log RLS policies and ensure activities can be read

-- First, check if RLS is enabled
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

-- Create a function to automatically log job creation
CREATE OR REPLACE FUNCTION log_job_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log on INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO job_activity_log (
      id,
      tenant_id,
      job_id,
      user_id,
      activity_type,
      activity_category,
      title,
      description,
      is_visible_to_customer,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      auth.uid(),
      'job_created',
      'system',
      'Job Created',
      'Job #' || COALESCE(NEW.job_number, substring(NEW.id::text, 1, 8)) || ' - ' || NEW.title,
      true,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to log job status changes
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_activity_log (
      id,
      tenant_id,
      job_id,
      user_id,
      activity_type,
      activity_category,
      title,
      description,
      metadata,
      is_visible_to_customer,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      auth.uid(),
      'status_changed',
      'job',
      'Status Updated',
      'Job status changed from ' || COALESCE(OLD.status, 'New') || ' to ' || NEW.status,
      jsonb_build_object(
        'oldStatus', OLD.status,
        'newStatus', NEW.status
      ),
      true,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic activity logging
DROP TRIGGER IF EXISTS log_job_creation_trigger ON jobs;
CREATE TRIGGER log_job_creation_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_creation();

DROP TRIGGER IF EXISTS log_job_status_change_trigger ON jobs;
CREATE TRIGGER log_job_status_change_trigger
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- Add a test activity for existing jobs (optional - remove in production)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- Add a creation activity for jobs that don't have any activities
  FOR job_record IN 
    SELECT j.* 
    FROM jobs j
    WHERE NOT EXISTS (
      SELECT 1 FROM job_activity_log 
      WHERE job_id = j.id 
      AND activity_type = 'job_created'
    )
    LIMIT 10  -- Limit to prevent too many inserts
  LOOP
    INSERT INTO job_activity_log (
      tenant_id,
      job_id,
      activity_type,
      activity_category,
      title,
      description,
      is_visible_to_customer,
      created_at
    ) VALUES (
      job_record.tenant_id,
      job_record.id,
      'job_created',
      'system',
      'Job Created',
      'Job #' || COALESCE(job_record.job_number, substring(job_record.id::text, 1, 8)) || ' - ' || job_record.title,
      true,
      COALESCE(job_record.created_at, NOW())
    );
  END LOOP;
  
  RAISE NOTICE 'Added creation activities for existing jobs';
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Job activity log RLS policies configured';
  RAISE NOTICE 'Automatic activity logging triggers created';
  RAISE NOTICE 'Test activities added for existing jobs';
END $$;