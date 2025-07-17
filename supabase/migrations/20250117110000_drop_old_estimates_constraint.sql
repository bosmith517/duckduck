-- Drop the old estimates_client_type_check constraint that's blocking journey workflow
-- This constraint requires exactly one of account_id or contact_id, preventing lead-only estimates

-- First check if the constraint exists and drop it
ALTER TABLE public.estimates 
DROP CONSTRAINT IF EXISTS estimates_client_type_check;

-- Log what we're doing
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE 'Dropped old estimates_client_type_check constraint that was blocking journey workflow';
    RAISE NOTICE 'The flexible estimates_client_reference_check constraint remains, allowing lead_id';
    
    -- Show current constraints
    RAISE NOTICE '';
    RAISE NOTICE 'Current CHECK constraints on estimates table:';
    
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
END $$;

-- Comment on the table to document the constraint strategy
COMMENT ON TABLE public.estimates IS 
'Estimates can be created in three contexts:
1. Journey workflow - linked to lead_id (lead may not have account/contact yet)
2. Change order - linked to job_id and account/contact
3. Standalone - linked directly to account_id (business) or contact_id (residential)
The estimates_client_reference_check constraint ensures at least one relationship exists.';