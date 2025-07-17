-- Add approval fields to estimates table
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS signature_data TEXT;

-- Add index for approved estimates
CREATE INDEX IF NOT EXISTS idx_estimates_is_approved 
ON public.estimates(is_approved) 
WHERE is_approved = TRUE;

-- Add index for estimates by lead
CREATE INDEX IF NOT EXISTS idx_estimates_lead_id 
ON public.estimates(lead_id) 
WHERE lead_id IS NOT NULL;

-- Add converted_to_job_id to leads table for tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS converted_to_job_id UUID REFERENCES public.jobs(id),
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP;

-- Create a function to automatically link job back to estimate
CREATE OR REPLACE FUNCTION link_job_to_estimate()
RETURNS TRIGGER AS $$
BEGIN
  -- If job was created from an estimate, update the estimate
  IF NEW.estimate_id IS NOT NULL THEN
    UPDATE public.estimates 
    SET job_id = NEW.id
    WHERE id = NEW.estimate_id
    AND job_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for linking jobs to estimates
DROP TRIGGER IF EXISTS link_job_to_estimate_trigger ON public.jobs;
CREATE TRIGGER link_job_to_estimate_trigger
AFTER INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION link_job_to_estimate();

-- Create a view for approved estimates pending conversion
CREATE OR REPLACE VIEW approved_estimates_pending_conversion AS
SELECT 
  e.*,
  l.name as lead_name,
  l.phone_number as lead_phone,
  l.email as lead_email,
  l.full_address as lead_address,
  l.urgency as lead_urgency,
  CASE 
    WHEN e.job_id IS NOT NULL THEN 'converted'
    WHEN e.is_approved = TRUE THEN 'approved_pending'
    ELSE 'draft'
  END as conversion_status
FROM public.estimates e
LEFT JOIN public.leads l ON e.lead_id = l.id
WHERE e.is_approved = TRUE
AND e.job_id IS NULL;

-- Grant permissions on the view
GRANT SELECT ON approved_estimates_pending_conversion TO authenticated;

-- Add RLS policy for the view (inherits from base tables)
ALTER VIEW approved_estimates_pending_conversion SET (security_invoker = on);

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Successfully added estimate approval fields';
    RAISE NOTICE 'Added: is_approved, approved_at, approved_by, approval_notes, signature_data columns';
    RAISE NOTICE 'Created indexes for approved estimates and lead lookups';
    RAISE NOTICE 'Created trigger to automatically link jobs back to estimates';
    RAISE NOTICE 'Created view for tracking approved estimates pending conversion';
END $$;