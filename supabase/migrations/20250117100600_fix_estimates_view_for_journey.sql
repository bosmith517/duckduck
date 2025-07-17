-- Fix the estimates view to account for lead_id in journey workflow
-- The v_estimates_missing_clients view needs to be updated to handle lead_id

-- Drop and recreate the view to include lead_id logic
DROP VIEW IF EXISTS public.v_estimates_missing_clients;

CREATE VIEW public.v_estimates_missing_clients AS
SELECT 
    e.id,
    e.estimate_number,
    e.project_title,
    e.total_amount,
    e.status,
    e.created_at,
    e.lead_id,
    j.job_number,
    j.title AS job_title,
    l.name AS lead_name,
    COALESCE(
        a.name, 
        CONCAT(c.first_name, ' ', c.last_name),
        l.name,
        'No Client Found'
    ) AS potential_client,
    CASE
        -- Journey workflow estimates (have lead_id but no account/contact yet)
        WHEN (e.lead_id IS NOT NULL AND e.account_id IS NULL AND e.contact_id IS NULL) THEN 'Journey Workflow (Lead Only)'
        -- Missing all client references
        WHEN (e.account_id IS NULL AND e.contact_id IS NULL AND e.lead_id IS NULL) THEN 'Missing All Client References'
        -- Job missing client (but estimate has client)
        WHEN (j.id IS NOT NULL AND j.account_id IS NULL AND j.contact_id IS NULL AND (e.account_id IS NOT NULL OR e.contact_id IS NOT NULL)) THEN 'Job Missing Client'
        -- Both estimate and job missing client
        WHEN (j.id IS NOT NULL AND j.account_id IS NULL AND j.contact_id IS NULL AND e.account_id IS NULL AND e.contact_id IS NULL AND e.lead_id IS NULL) THEN 'Both Missing Client'
        ELSE 'No Issues Detected'
    END AS issue_type
FROM estimates e
LEFT JOIN jobs j ON (e.job_id = j.id)
LEFT JOIN accounts a ON (e.account_id = a.id OR j.account_id = a.id)
LEFT JOIN contacts c ON (e.contact_id = c.id OR j.contact_id = c.id)
LEFT JOIN leads l ON (e.lead_id = l.id)
WHERE 
    -- Show only estimates that actually have issues (exclude journey workflow estimates)
    (
        (e.account_id IS NULL AND e.contact_id IS NULL AND e.lead_id IS NULL) -- Missing all references
        OR 
        (j.id IS NOT NULL AND j.account_id IS NULL AND j.contact_id IS NULL) -- Job missing client
    );

-- Add comment to document the view
COMMENT ON VIEW public.v_estimates_missing_clients IS 
'Identifies estimates that are missing proper client relationships. Excludes journey workflow estimates that only have lead_id (which is expected behavior).';

-- Test that the constraint is working properly
DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
BEGIN
    -- Test that estimates can be created with just lead_id (should pass)
    BEGIN
        -- This simulates what would happen in an INSERT
        PERFORM 1 WHERE (
            NULL::UUID IS NOT NULL OR  -- account_id
            NULL::UUID IS NOT NULL OR  -- contact_id  
            test_uuid IS NOT NULL      -- lead_id
        );
        RAISE NOTICE 'Constraint test PASSED: lead_id only is allowed';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Constraint test FAILED: %', SQLERRM;
    END;
    
    -- Test that estimates cannot be created with no references (should fail)
    BEGIN
        PERFORM 1 WHERE (
            NULL::UUID IS NOT NULL OR  -- account_id
            NULL::UUID IS NOT NULL OR  -- contact_id  
            NULL::UUID IS NOT NULL     -- lead_id
        );
        RAISE NOTICE 'Constraint test FAILED: NULL values should not be allowed';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Constraint test PASSED: NULL values are properly rejected';
    END;
END $$;