-- Backfill existing leads with initial activities
-- This will create historical activities for leads that existed before the activity logging system

DO $$
DECLARE
  lead_record RECORD;
  activity_count INTEGER := 0;
BEGIN
  -- Process each lead that doesn't have a 'lead_created' activity
  FOR lead_record IN 
    SELECT l.* 
    FROM leads l
    WHERE NOT EXISTS (
      SELECT 1 FROM job_activity_log 
      WHERE lead_id = l.id 
      AND activity_type = 'lead_created'
    )
  LOOP
    -- Insert a 'Lead Created' activity for this lead
    INSERT INTO job_activity_log (
      tenant_id,
      lead_id,
      user_id,
      activity_type,
      activity_category,
      title,
      description,
      metadata,
      is_visible_to_customer,
      is_milestone,
      created_at
    ) VALUES (
      lead_record.tenant_id,
      lead_record.id,
      lead_record.created_by,
      'lead_created',
      'system',
      'Lead Created',
      'New lead from ' || COALESCE(lead_record.lead_source, 'Unknown Source') || ': ' || lead_record.caller_name,
      jsonb_build_object(
        'lead_source', lead_record.lead_source,
        'caller_name', lead_record.caller_name,
        'phone_number', lead_record.phone_number,
        'initial_request', lead_record.initial_request,
        'urgency', lead_record.urgency,
        'backfilled', true
      ),
      true,
      true,
      lead_record.created_at
    );
    
    activity_count := activity_count + 1;
    
    -- If lead has been assigned, add assignment activity
    IF lead_record.assigned_to IS NOT NULL OR lead_record.assigned_rep IS NOT NULL THEN
      INSERT INTO job_activity_log (
        tenant_id,
        lead_id,
        user_id,
        activity_type,
        activity_category,
        title,
        description,
        metadata,
        is_visible_to_customer,
        is_milestone,
        created_at
      ) VALUES (
        lead_record.tenant_id,
        lead_record.id,
        COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
        'lead_assigned',
        'user',
        'Lead Assigned',
        'Lead assigned to ' || COALESCE(
          (SELECT first_name || ' ' || last_name FROM user_profiles WHERE id = COALESCE(lead_record.assigned_to, lead_record.assigned_rep)),
          'team member'
        ),
        jsonb_build_object(
          'assigned_to', COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
          'backfilled', true
        ),
        true,
        true,
        lead_record.created_at + interval '5 minutes'
      );
      
      activity_count := activity_count + 1;
    END IF;
    
    -- If lead has a site visit scheduled, add site visit activity
    IF lead_record.site_visit_date IS NOT NULL THEN
      INSERT INTO job_activity_log (
        tenant_id,
        lead_id,
        user_id,
        activity_type,
        activity_category,
        title,
        description,
        metadata,
        is_visible_to_customer,
        is_milestone,
        created_at
      ) VALUES (
        lead_record.tenant_id,
        lead_record.id,
        COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
        'site_visit_scheduled',
        'user',
        'Site Visit Scheduled',
        'Site visit scheduled for ' || lead_record.site_visit_date::date,
        jsonb_build_object(
          'site_visit_date', lead_record.site_visit_date,
          'backfilled', true
        ),
        true,
        true,
        LEAST(lead_record.site_visit_date, lead_record.created_at + interval '1 day')
      );
      
      activity_count := activity_count + 1;
      
      -- If site visit has notes, assume it was completed
      IF lead_record.site_visit_notes IS NOT NULL AND lead_record.site_visit_notes != '' THEN
        INSERT INTO job_activity_log (
          tenant_id,
          lead_id,
          user_id,
          activity_type,
          activity_category,
          title,
          description,
          metadata,
          is_visible_to_customer,
          is_milestone,
          created_at
        ) VALUES (
          lead_record.tenant_id,
          lead_record.id,
          COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
          'site_visit_completed',
          'user',
          'Site Visit Completed',
          'Site visit completed. Notes: ' || left(lead_record.site_visit_notes, 200),
          jsonb_build_object(
            'site_visit_notes', lead_record.site_visit_notes,
            'backfilled', true
          ),
          true,
          true,
          GREATEST(lead_record.site_visit_date, lead_record.created_at + interval '1 day')
        );
        
        activity_count := activity_count + 1;
      END IF;
    END IF;
    
    -- If lead has been converted to job, add conversion activity
    IF lead_record.converted_to_job_id IS NOT NULL THEN
      INSERT INTO job_activity_log (
        tenant_id,
        lead_id,
        job_id,
        user_id,
        activity_type,
        activity_category,
        title,
        description,
        metadata,
        is_visible_to_customer,
        is_milestone,
        created_at
      ) VALUES (
        lead_record.tenant_id,
        lead_record.id,
        lead_record.converted_to_job_id,
        COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
        'lead_converted',
        'user',
        'Lead Converted to Job',
        'Lead successfully converted to job #' || COALESCE(
          (SELECT job_number FROM jobs WHERE id = lead_record.converted_to_job_id),
          substring(lead_record.converted_to_job_id::text, 1, 8)
        ),
        jsonb_build_object(
          'job_id', lead_record.converted_to_job_id,
          'converted_at', lead_record.converted_at,
          'lead_source', lead_record.lead_source,
          'estimated_value', lead_record.estimated_value,
          'backfilled', true
        ),
        true,
        true,
        COALESCE(lead_record.converted_at, lead_record.updated_at, NOW())
      );
      
      activity_count := activity_count + 1;
    END IF;
    
    -- Add status change activity if not default status
    IF lead_record.status != 'New' THEN
      INSERT INTO job_activity_log (
        tenant_id,
        lead_id,
        user_id,
        activity_type,
        activity_category,
        title,
        description,
        metadata,
        is_visible_to_customer,
        is_milestone,
        created_at
      ) VALUES (
        lead_record.tenant_id,
        lead_record.id,
        COALESCE(lead_record.assigned_to, lead_record.assigned_rep),
        'lead_status_changed',
        'user',
        'Lead Status Updated',
        'Lead status changed to ' || lead_record.status,
        jsonb_build_object(
          'oldStatus', 'New',
          'newStatus', lead_record.status,
          'backfilled', true
        ),
        true,
        true,
        COALESCE(lead_record.updated_at, lead_record.created_at + interval '30 minutes')
      );
      
      activity_count := activity_count + 1;
    END IF;
    
  END LOOP;
  
  RAISE NOTICE 'Backfilled % activities for existing leads', activity_count;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Backfilled activities for existing leads';
END $$;