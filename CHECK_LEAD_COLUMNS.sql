-- CHECK WHAT COLUMNS THE LEADS TABLE ACTUALLY HAS
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- Then check if recent leads are being converted
SELECT 
    l.id,
    l.tenant_id,
    l.status,
    l.caller_type,
    l.email,
    l.phone,
    l.created_at,
    CASE 
        WHEN l.converted_contact_id IS NOT NULL THEN '✅ Converted to Contact'
        WHEN l.converted_account_id IS NOT NULL THEN '✅ Converted to Account'
        ELSE '❌ NOT CONVERTED'
    END as conversion_status
FROM leads l
WHERE l.created_at > NOW() - INTERVAL '24 hours'
ORDER BY l.created_at DESC
LIMIT 10;

-- Count conversions
SELECT 
    COUNT(*) as total_leads_today,
    COUNT(converted_contact_id) as converted_to_contacts,
    COUNT(converted_account_id) as converted_to_accounts,
    COUNT(CASE WHEN caller_type IS NOT NULL AND converted_contact_id IS NULL AND converted_account_id IS NULL THEN 1 END) as failed_conversions
FROM leads
WHERE created_at > NOW() - INTERVAL '24 hours';