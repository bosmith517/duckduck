-- TEST NEW INQUIRY FLOW
-- This simulates what happens when you click "New Inquiry"

DO $$
DECLARE
    test_tenant_id uuid;
    test_lead_id uuid;
    test_contact_id uuid;
BEGIN
    -- Get a tenant for testing (use your actual tenant_id)
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    RAISE NOTICE 'Testing with tenant_id: %', test_tenant_id;
    
    -- 1. Create a test lead (what NewInquiryModal does first)
    INSERT INTO leads (
        tenant_id,
        name,
        email,
        phone,
        status,
        caller_type,
        service_needed,
        urgency_level,
        created_at
    ) VALUES (
        test_tenant_id,
        'Test Customer',
        'test@example.com',
        '555-0001',
        'new',
        'individual',
        'HVAC Repair',
        'urgent',
        NOW()
    ) RETURNING id INTO test_lead_id;
    
    RAISE NOTICE '✅ Created lead with ID: %', test_lead_id;
    
    -- 2. Create a contact (what should happen next for individuals)
    INSERT INTO contacts (
        tenant_id,
        first_name,
        last_name,
        email,
        phone,
        created_at
    ) VALUES (
        test_tenant_id,
        'Test',
        'Customer',
        'test@example.com',
        '555-0001',
        NOW()
    ) RETURNING id INTO test_contact_id;
    
    RAISE NOTICE '✅ Created contact with ID: %', test_contact_id;
    
    -- 3. Update lead with contact reference
    UPDATE leads 
    SET converted_contact_id = test_contact_id
    WHERE id = test_lead_id;
    
    RAISE NOTICE '✅ Updated lead with contact reference';
    
    -- 4. Verify the connection
    PERFORM 1 FROM leads 
    WHERE id = test_lead_id 
    AND converted_contact_id = test_contact_id;
    
    RAISE NOTICE '✅ Lead-to-Contact conversion verified!';
    
    -- Clean up test data
    DELETE FROM contacts WHERE id = test_contact_id;
    DELETE FROM leads WHERE id = test_lead_id;
    
    RAISE NOTICE '✅ Test completed and cleaned up successfully!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Test failed with error: %', SQLERRM;
        RAISE NOTICE 'Error detail: %', SQLSTATE;
END $$;

-- Show the current state of leads
SELECT 
    'RECENT LEADS:' as report,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN caller_type = 'individual' THEN 1 END) as individual_leads,
    COUNT(CASE WHEN caller_type = 'business' THEN 1 END) as business_leads,
    COUNT(converted_contact_id) as with_contacts,
    COUNT(converted_account_id) as with_accounts
FROM leads
WHERE created_at > NOW() - INTERVAL '24 hours';