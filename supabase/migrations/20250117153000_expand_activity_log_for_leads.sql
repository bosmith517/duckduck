-- Expand job_activity_log to support lead activities and rename to customer_activity_log
-- This migration will:
-- 1. Add lead_id column to existing table
-- 2. Make job_id nullable (since leads don't have jobs yet)
-- 3. Add lead-specific activity types
-- 4. Add constraints to ensure either lead_id or job_id is present
-- 5. Create triggers for lead lifecycle events

-- First, add the lead_id column and make job_id nullable
ALTER TABLE job_activity_log 
ADD COLUMN lead_id uuid,
ALTER COLUMN job_id DROP NOT NULL;

-- Add foreign key constraint for lead_id
ALTER TABLE job_activity_log 
ADD CONSTRAINT job_activity_log_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

-- Add constraint to ensure either lead_id or job_id is present
ALTER TABLE job_activity_log 
ADD CONSTRAINT job_activity_log_entity_check 
CHECK ((lead_id IS NOT NULL) OR (job_id IS NOT NULL));

-- Update the activity_type check constraint to include lead activities
ALTER TABLE job_activity_log 
DROP CONSTRAINT job_activity_log_activity_type_check;

ALTER TABLE job_activity_log 
ADD CONSTRAINT job_activity_log_activity_type_check CHECK (
    ("activity_type"::text = ANY (ARRAY[
        -- Lead activities
        'lead_created'::character varying,
        'lead_called'::character varying,
        'lead_contacted'::character varying,
        'lead_qualified'::character varying,
        'lead_unqualified'::character varying,
        'lead_status_changed'::character varying,
        'lead_assigned'::character varying,
        'lead_follow_up_scheduled'::character varying,
        'lead_follow_up_completed'::character varying,
        'lead_converted'::character varying,
        'site_visit_scheduled'::character varying,
        'site_visit_completed'::character varying,
        'site_visit_cancelled'::character varying,
        -- Job activities (existing)
        'job_created'::character varying,
        'estimate_created'::character varying, 
        'estimate_sent'::character varying,
        'estimate_viewed'::character varying,
        'estimate_accepted'::character varying,
        'estimate_declined'::character varying,
        'work_started'::character varying,
        'work_completed'::character varying,
        'work_paused'::character varying,
        'photo_uploaded'::character varying,
        'note_added'::character varying,
        'status_changed'::character varying,
        'payment_received'::character varying,
        'invoice_created'::character varying,
        'invoice_sent'::character varying,
        'technician_assigned'::character varying,
        'location_update'::character varying,
        'call_made'::character varying,
        'sms_sent'::character varying,
        'email_sent'::character varying,
        'other'::character varying
    ]::text[]))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_activity_log_lead_id 
ON job_activity_log (lead_id);

CREATE INDEX IF NOT EXISTS idx_job_activity_log_lead_tenant 
ON job_activity_log (lead_id, tenant_id);

-- Update RLS policies to include lead access
DROP POLICY IF EXISTS "Users can view activities for their tenant" ON job_activity_log;
DROP POLICY IF EXISTS "Users can insert activities for their tenant" ON job_activity_log;
DROP POLICY IF EXISTS "Users can update their own activities" ON job_activity_log;

-- Create comprehensive RLS policies for both leads and jobs
CREATE POLICY "Users can view activities for their tenant"
ON job_activity_log FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert activities for their tenant"
ON job_activity_log FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id 
    FROM user_profiles 
    WHERE id = auth.uid()
  )
);

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

-- Create function to automatically log lead creation
CREATE OR REPLACE FUNCTION log_lead_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log on INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO job_activity_log (
      id,
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
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      NEW.created_by,
      'lead_created',
      'system',
      'Lead Created',
      'New lead from ' || NEW.lead_source || ': ' || NEW.caller_name,
      jsonb_build_object(
        'lead_source', NEW.lead_source,
        'caller_name', NEW.caller_name,
        'phone_number', NEW.phone_number,
        'initial_request', NEW.initial_request,
        'urgency', NEW.urgency
      ),
      true,
      true,
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log lead status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_activity_log (
      id,
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
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      auth.uid(),
      'lead_status_changed',
      'user',
      'Lead Status Updated',
      'Lead status changed from ' || COALESCE(OLD.status, 'New') || ' to ' || NEW.status,
      jsonb_build_object(
        'oldStatus', OLD.status,
        'newStatus', NEW.status
      ),
      true,
      true,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log lead conversion to job
CREATE OR REPLACE FUNCTION log_lead_conversion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if converted_to_job_id was added
  IF OLD.converted_to_job_id IS NULL AND NEW.converted_to_job_id IS NOT NULL THEN
    INSERT INTO job_activity_log (
      id,
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
      gen_random_uuid(),
      NEW.tenant_id,
      NEW.id,
      NEW.converted_to_job_id,
      auth.uid(),
      'lead_converted',
      'user',
      'Lead Converted to Job',
      'Lead successfully converted to job #' || COALESCE(
        (SELECT job_number FROM jobs WHERE id = NEW.converted_to_job_id),
        substring(NEW.converted_to_job_id::text, 1, 8)
      ),
      jsonb_build_object(
        'job_id', NEW.converted_to_job_id,
        'converted_at', NEW.converted_at,
        'lead_source', NEW.lead_source,
        'estimated_value', NEW.estimated_value
      ),
      true,
      true,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic lead activity logging
DROP TRIGGER IF EXISTS log_lead_creation_trigger ON leads;
CREATE TRIGGER log_lead_creation_trigger
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_creation();

DROP TRIGGER IF EXISTS log_lead_status_change_trigger ON leads;
CREATE TRIGGER log_lead_status_change_trigger
  AFTER UPDATE OF status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();

DROP TRIGGER IF EXISTS log_lead_conversion_trigger ON leads;
CREATE TRIGGER log_lead_conversion_trigger
  AFTER UPDATE OF converted_to_job_id ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_conversion();

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Expanded job_activity_log to support lead activities';
  RAISE NOTICE 'Added lead_id column and lead-specific activity types';
  RAISE NOTICE 'Created triggers for lead lifecycle events';
  RAISE NOTICE 'Updated RLS policies for lead access';
END $$;