-- Step 8: Create workflow automation function and triggers
-- Create workflow automation function (PostgreSQL function to handle triggers)
CREATE OR REPLACE FUNCTION trigger_workflow_automation()
RETURNS TRIGGER AS $$
DECLARE
  rule_record workflow_rules%ROWTYPE;
  execution_id UUID;
  tenant_id_val UUID;
BEGIN
  -- Get tenant_id from the record
  CASE TG_TABLE_NAME
    WHEN 'jobs' THEN tenant_id_val := NEW.tenant_id;
    WHEN 'leads' THEN tenant_id_val := NEW.tenant_id;
    WHEN 'job_inspections' THEN 
      SELECT j.tenant_id INTO tenant_id_val FROM jobs j WHERE j.id = NEW.job_id;
    WHEN 'job_milestones' THEN 
      SELECT j.tenant_id INTO tenant_id_val FROM jobs j WHERE j.id = NEW.job_id;
    ELSE tenant_id_val := NULL;
  END CASE;

  IF tenant_id_val IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find applicable workflow rules
  FOR rule_record IN 
    SELECT * FROM workflow_rules 
    WHERE tenant_id = tenant_id_val 
      AND entity_type = TG_TABLE_NAME 
      AND trigger_event = 'status_change'
      AND active = true
  LOOP
    -- Create workflow execution record
    INSERT INTO workflow_executions (
      tenant_id, workflow_rule_id, entity_id, entity_type, 
      trigger_data, status
    ) VALUES (
      tenant_id_val, rule_record.id, NEW.id, TG_TABLE_NAME,
      jsonb_build_object(
        'old_status', COALESCE(OLD.status, ''),
        'new_status', NEW.status,
        'changed_at', NOW()
      ),
      'pending'
    ) RETURNING id INTO execution_id;

    -- Here you would typically queue the workflow for background processing
    -- For now, we'll just log that a workflow was triggered
    
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS jobs_workflow_trigger ON jobs;
DROP TRIGGER IF EXISTS leads_workflow_trigger ON leads;
DROP TRIGGER IF EXISTS inspections_workflow_trigger ON job_inspections;
DROP TRIGGER IF EXISTS milestones_workflow_trigger ON job_milestones;

-- Create triggers for workflow automation on key tables (only if tables exist)
DO $$
BEGIN
  -- Check if jobs table exists and has status column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'status') THEN
    EXECUTE 'CREATE TRIGGER jobs_workflow_trigger
      AFTER UPDATE OF status ON jobs
      FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation()';
  END IF;

  -- Check if leads table exists and has status column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'status') THEN
    EXECUTE 'CREATE TRIGGER leads_workflow_trigger
      AFTER UPDATE OF status ON leads
      FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation()';
  END IF;

  -- Check if job_inspections table exists and has status column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_inspections' AND column_name = 'status') THEN
    EXECUTE 'CREATE TRIGGER inspections_workflow_trigger
      AFTER UPDATE OF status ON job_inspections
      FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation()';
  END IF;

  -- Check if job_milestones table exists and has status column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_milestones' AND column_name = 'status') THEN
    EXECUTE 'CREATE TRIGGER milestones_workflow_trigger
      AFTER UPDATE OF status ON job_milestones
      FOR EACH ROW EXECUTE FUNCTION trigger_workflow_automation()';
  END IF;
END $$;