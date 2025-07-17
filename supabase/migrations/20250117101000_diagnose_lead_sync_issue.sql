-- Diagnose why leads aren't getting contact/account relationships

-- First, check if the triggers exist
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'Checking triggers on leads table...';
    
    FOR trigger_record IN
        SELECT 
            tgname AS trigger_name,
            proname AS function_name,
            tgenabled AS is_enabled
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'leads'
            AND tgname IN ('sync_lead_contacts_accounts', 'before_lead_insert_trigger')
    LOOP
        RAISE NOTICE 'Trigger: % calls function: % (enabled: %)', 
            trigger_record.trigger_name,
            trigger_record.function_name,
            CASE trigger_record.is_enabled
                WHEN 'O' THEN 'Yes'
                WHEN 'D' THEN 'DISABLED'
                WHEN 'R' THEN 'Replica only'
                WHEN 'A' THEN 'Always'
                ELSE 'Unknown'
            END;
    END LOOP;
END $$;

-- Check if there are any leads without relationships
SELECT 
    COUNT(*) as total_leads,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as leads_with_account,
    COUNT(CASE WHEN contact_id IS NOT NULL THEN 1 END) as leads_with_contact,
    COUNT(CASE WHEN account_id IS NULL AND contact_id IS NULL THEN 1 END) as leads_without_relationships
FROM leads;

-- Show sample of leads without relationships
SELECT 
    id,
    name,
    caller_name,
    contact_type,
    phone_number,
    email,
    account_id,
    contact_id,
    created_at
FROM leads
WHERE account_id IS NULL AND contact_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- Let's manually test the sync function
DO $$
DECLARE
    test_lead RECORD;
    result_lead RECORD;
BEGIN
    -- Get a lead without relationships
    SELECT * INTO test_lead
    FROM leads
    WHERE account_id IS NULL AND contact_id IS NULL
    LIMIT 1;
    
    IF test_lead IS NOT NULL THEN
        RAISE NOTICE 'Testing sync for lead: % (%)', test_lead.id, test_lead.name;
        
        -- Manually call the sync function
        BEGIN
            -- Force an update to trigger the sync
            UPDATE leads 
            SET updated_at = NOW()
            WHERE id = test_lead.id
            RETURNING * INTO result_lead;
            
            RAISE NOTICE 'After sync - account_id: %, contact_id: %', 
                result_lead.account_id, 
                result_lead.contact_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error during sync: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'No leads found without relationships';
    END IF;
END $$;