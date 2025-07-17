-- Fix conflicting constraints on estimates table
-- The estimates_client_type_check constraint was preventing journey estimates from being created

-- Drop the conflicting constraint that requires exclusive account_id OR contact_id
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_type_check;

-- Keep the flexible constraint that allows lead_id as an alternative
-- (This should already exist from previous migrations but ensuring it's correct)
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_check;

ALTER TABLE public.estimates 
ADD CONSTRAINT estimates_client_check 
CHECK (
  account_id IS NOT NULL OR 
  contact_id IS NOT NULL OR 
  lead_id IS NOT NULL
);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT estimates_client_check ON public.estimates IS 
'Ensures estimate is linked to at least one client entity: account (business), contact (residential), or lead (journey workflow). Multiple references are allowed for journey workflow.';

-- Verify the constraint is working by checking existing data
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO violation_count
    FROM public.estimates
    WHERE account_id IS NULL 
      AND contact_id IS NULL 
      AND lead_id IS NULL;
    
    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Found % estimates with no client reference. Please fix these before applying constraint.', violation_count;
    END IF;
    
    RAISE NOTICE 'All estimates have valid client references. Constraint applied successfully.';
END $$;