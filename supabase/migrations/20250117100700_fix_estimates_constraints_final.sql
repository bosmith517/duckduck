-- Final fix for estimates constraints - remove blocking constraint and add flexible one

-- Drop the constraint that's blocking journey estimates
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_must_have_client_or_contact;

-- Also ensure the flexible constraint exists
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_check;

ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_reference_check;

-- Add the flexible constraint that allows lead_id
ALTER TABLE public.estimates 
ADD CONSTRAINT estimates_client_reference_check 
CHECK (
  account_id IS NOT NULL OR 
  contact_id IS NOT NULL OR 
  lead_id IS NOT NULL
);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT estimates_client_reference_check ON public.estimates IS 
'Ensures estimate is linked to at least one client entity: account (business), contact (residential), or lead (journey workflow).';

-- Verify what constraints remain
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE 'Remaining CHECK constraints on estimates table:';
    
    FOR constraint_record IN
        SELECT 
            conname AS constraint_name,
            pg_get_constraintdef(c.oid) AS constraint_definition
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE t.relname = 'estimates'
            AND n.nspname = 'public'
            AND contype = 'c'  -- Only check constraints
        ORDER BY conname
    LOOP
        RAISE NOTICE '  - %: %', 
            constraint_record.constraint_name,
            constraint_record.constraint_definition;
    END LOOP;
    
    RAISE NOTICE 'Constraint fix completed successfully.';
END $$;