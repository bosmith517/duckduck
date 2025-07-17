-- Add initial activities for existing jobs that don't have any activities
-- This will create "Job Created" activities for jobs that lack them

DO $$
DECLARE
  job_record RECORD;
  activity_count INTEGER;
BEGIN
  -- Process each job that doesn't have a 'job_created' activity
  FOR job_record IN 
    SELECT j.* 
    FROM jobs j
    WHERE NOT EXISTS (
      SELECT 1 FROM job_activity_log 
      WHERE job_id = j.id 
      AND activity_type = 'job_created'
    )
  LOOP
    -- Insert a 'Job Created' activity for this job
    INSERT INTO job_activity_log (
      tenant_id,
      job_id,
      activity_type,
      activity_category,
      title,
      description,
      is_visible_to_customer,
      is_milestone,
      created_at
    ) VALUES (
      job_record.tenant_id,
      job_record.id,
      'job_created',
      'system',
      'Job Created',
      'Job #' || COALESCE(job_record.job_number, substring(job_record.id::text, 1, 8)) || ' - ' || job_record.title,
      true,
      true,
      COALESCE(job_record.created_at, NOW())
    );
    
    -- Add a status update activity if the job isn't in 'Scheduled' status
    IF job_record.status != 'Scheduled' THEN
      INSERT INTO job_activity_log (
        tenant_id,
        job_id,
        activity_type,
        activity_category,
        title,
        description,
        metadata,
        is_visible_to_customer,
        is_milestone,
        created_at
      ) VALUES (
        job_record.tenant_id,
        job_record.id,
        'status_changed',
        'system',
        'Status Updated',
        'Job status set to ' || job_record.status,
        jsonb_build_object(
          'oldStatus', 'Scheduled',
          'newStatus', job_record.status
        ),
        true,
        true,
        COALESCE(job_record.created_at, NOW()) + interval '1 minute'
      );
    END IF;
  END LOOP;
  
  -- Get count of jobs processed
  SELECT COUNT(*) INTO activity_count
  FROM jobs j
  WHERE EXISTS (
    SELECT 1 FROM job_activity_log 
    WHERE job_id = j.id 
    AND activity_type = 'job_created'
  );
  
  RAISE NOTICE 'Added initial activities for existing jobs. Total jobs with activities: %', activity_count;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Added initial activities for existing jobs';
END $$;