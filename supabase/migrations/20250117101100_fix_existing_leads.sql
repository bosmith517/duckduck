-- Fix existing leads without relationships
-- This will force the sync trigger to run on all leads

DO $$
DECLARE
    lead_record RECORD;
    fixed_count INTEGER := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting to fix leads without relationships...';
    
    -- First, let's see the current state
    FOR lead_record IN
        SELECT 
            id,
            name,
            caller_name,
            contact_type,
            company_name,
            phone_number,
            email,
            account_id,
            contact_id
        FROM leads
        WHERE account_id IS NULL AND contact_id IS NULL
        ORDER BY created_at DESC
    LOOP
        BEGIN
            RAISE NOTICE 'Processing lead: % (%, type: %)', 
                lead_record.id, 
                COALESCE(lead_record.name, lead_record.caller_name, 'Unknown'),
                COALESCE(lead_record.contact_type, 'not set');
            
            -- Force the trigger to run by updating a tracked field
            UPDATE leads
            SET updated_at = NOW(),
                -- Ensure contact_type is set
                contact_type = CASE 
                    WHEN contact_type IS NULL THEN 'residential'
                    ELSE contact_type
                END
            WHERE id = lead_record.id;
            
            fixed_count := fixed_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error fixing lead %: %', lead_record.id, SQLERRM;
            error_count := error_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Lead fix complete. Fixed: %, Errors: %', fixed_count, error_count;
    
    -- Now check the results
    PERFORM COUNT(*) FROM leads WHERE account_id IS NULL AND contact_id IS NULL;
    IF COUNT(*) > 0 THEN
        RAISE NOTICE 'WARNING: There are still % leads without relationships', COUNT(*);
    ELSE
        RAISE NOTICE 'SUCCESS: All leads now have proper relationships';
    END IF;
END $$;

-- Show final state
SELECT 
    'Total leads' as metric,
    COUNT(*) as count
FROM leads
UNION ALL
SELECT 
    'Leads with account_id',
    COUNT(*)
FROM leads WHERE account_id IS NOT NULL
UNION ALL
SELECT 
    'Leads with contact_id',
    COUNT(*)
FROM leads WHERE contact_id IS NOT NULL
UNION ALL
SELECT 
    'Leads without relationships',
    COUNT(*)
FROM leads WHERE account_id IS NULL AND contact_id IS NULL;

-- Let's also check if the sync function is working properly
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Test the sync function directly
    SELECT sync_lead_to_contact_account() INTO test_result;
    RAISE NOTICE 'Sync function test result: %', test_result;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sync function error: %', SQLERRM;
END $$;