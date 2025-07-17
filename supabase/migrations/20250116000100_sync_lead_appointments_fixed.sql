-- Migration to sync lead site visits with calendar_events table (fixed version)
-- This ensures appointments are visible in the unified schedule view

-- Create or replace function to sync lead site visits to calendar events
CREATE OR REPLACE FUNCTION sync_lead_site_visit_to_calendar()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if site_visit_date is set
  IF NEW.site_visit_date IS NOT NULL THEN
    -- Check if this is a new site visit or an update
    IF (TG_OP = 'INSERT') OR 
       (TG_OP = 'UPDATE' AND (OLD.site_visit_date IS NULL OR OLD.site_visit_date != NEW.site_visit_date)) THEN
      
      -- Delete any existing calendar event for this lead
      DELETE FROM calendar_events 
      WHERE lead_id = NEW.id AND event_type = 'site_visit';
      
      -- Create new calendar event
      INSERT INTO calendar_events (
        tenant_id,
        title,
        description,
        start_time,
        end_time,
        event_type,
        lead_id,
        assigned_to,
        location,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.tenant_id,
        COALESCE('Site Visit: ' || NEW.name, 'Site Visit'),
        COALESCE(
          'Site visit scheduled' || 
          E'\n\nClient: ' || COALESCE(NEW.name, 'Unknown') ||
          CASE 
            WHEN NEW.phone_number IS NOT NULL THEN E'\nPhone: ' || NEW.phone_number 
            ELSE '' 
          END ||
          CASE 
            WHEN NEW.email IS NOT NULL THEN E'\nEmail: ' || NEW.email 
            ELSE '' 
          END ||
          CASE 
            WHEN NEW.site_visit_notes IS NOT NULL THEN E'\nNotes: ' || NEW.site_visit_notes 
            ELSE '' 
          END,
          'Site visit scheduled'
        ),
        NEW.site_visit_date,
        NEW.site_visit_date + INTERVAL '1 hour', -- Default 1 hour duration
        'site_visit',
        NEW.id,
        NEW.assigned_rep,
        COALESCE(NEW.full_address, NEW.street_address, 'Address to be confirmed'),
        CASE 
          WHEN NEW.status = 'site_visit_completed' THEN 'completed'
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
          ELSE 'scheduled'
        END,
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  -- If site visit is being removed, delete the calendar event
  IF TG_OP = 'UPDATE' AND OLD.site_visit_date IS NOT NULL AND NEW.site_visit_date IS NULL THEN
    DELETE FROM calendar_events 
    WHERE lead_id = NEW.id AND event_type = 'site_visit';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead inserts and updates
DROP TRIGGER IF EXISTS sync_lead_site_visit_trigger ON leads;
CREATE TRIGGER sync_lead_site_visit_trigger
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_site_visit_to_calendar();

-- Sync existing lead site visits to calendar_events
INSERT INTO calendar_events (
  tenant_id,
  title,
  description,
  start_time,
  end_time,
  event_type,
  lead_id,
  assigned_to,
  location,
  status,
  created_at,
  updated_at
)
SELECT 
  l.tenant_id,
  'Site Visit: ' || COALESCE(l.name, 'Lead'),
  'Site visit scheduled' || 
  E'\n\nClient: ' || COALESCE(l.name, 'Unknown') ||
  CASE 
    WHEN l.phone_number IS NOT NULL THEN E'\nPhone: ' || l.phone_number 
    ELSE '' 
  END ||
  CASE 
    WHEN l.email IS NOT NULL THEN E'\nEmail: ' || l.email 
    ELSE '' 
  END ||
  CASE 
    WHEN l.site_visit_notes IS NOT NULL THEN E'\nNotes: ' || l.site_visit_notes 
    ELSE '' 
  END,
  l.site_visit_date,
  l.site_visit_date + INTERVAL '1 hour',
  'site_visit',
  l.id,
  l.assigned_rep,
  COALESCE(l.full_address, l.street_address, 'Address to be confirmed'),
  CASE 
    WHEN l.status = 'site_visit_completed' THEN 'completed'
    WHEN l.status = 'cancelled' THEN 'cancelled'
    ELSE 'scheduled'
  END,
  NOW(),
  NOW()
FROM leads l
WHERE l.site_visit_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce 
    WHERE ce.lead_id = l.id AND ce.event_type = 'site_visit'
  );

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead_id ON calendar_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_job_id ON calendar_events(job_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_id ON calendar_events(tenant_id);

-- Grant necessary permissions
GRANT ALL ON calendar_events TO authenticated;
GRANT ALL ON calendar_events TO service_role;