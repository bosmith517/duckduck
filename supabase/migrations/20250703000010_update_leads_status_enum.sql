-- Update leads table status to support site visit workflow
-- This migration updates the status column to include the full workflow states

-- First, we need to update any existing statuses to match our new workflow
UPDATE public.leads 
SET status = 'new' 
WHERE status = 'New' OR status = 'NEW';

UPDATE public.leads 
SET status = 'qualified' 
WHERE status = 'Qualified' OR status = 'QUALIFIED';

UPDATE public.leads 
SET status = 'unqualified' 
WHERE status = 'Unqualified' OR status = 'UNQUALIFIED';

UPDATE public.leads 
SET status = 'converted' 
WHERE status = 'Converted' OR status = 'CONVERTED';

-- Now alter the column to support all workflow states
-- Note: PostgreSQL doesn't have a direct way to modify VARCHAR constraints
-- So we'll drop and recreate the constraint if it exists
ALTER TABLE public.leads 
ALTER COLUMN status TYPE character varying;

-- Add a check constraint for the allowed statuses
ALTER TABLE public.leads 
DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads 
ADD CONSTRAINT leads_status_check 
CHECK (status IN (
    'new',
    'site_visit_scheduled',
    'site_visit_completed', 
    'estimate_ready',
    'qualified',
    'unqualified',
    'converted'
));

-- Update the default value
ALTER TABLE public.leads 
ALTER COLUMN status SET DEFAULT 'new';

-- Add a comment to document the workflow
COMMENT ON COLUMN public.leads.status IS 'Lead workflow: new → site_visit_scheduled → site_visit_completed → estimate_ready → converted';