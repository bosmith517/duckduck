-- Update the estimates constraints to support the journey workflow
-- This allows estimates to be created with lead_id during the journey

-- Drop existing constraints
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_check;

ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_type_check;

-- Add updated constraint that allows lead_id as an alternative
-- and doesn't require exclusive account/contact
ALTER TABLE public.estimates 
ADD CONSTRAINT estimates_client_check 
CHECK (
  account_id IS NOT NULL OR 
  contact_id IS NOT NULL OR 
  lead_id IS NOT NULL
);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT estimates_client_check ON public.estimates IS 
'Ensures estimate is linked to at least one client entity: account (business), contact (residential), or lead (journey workflow)';