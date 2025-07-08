-- TEST LEAD CONVERSION
-- This will show you exactly what's happening with your leads

-- 1. Show recent leads and their conversion status
SELECT 
    l.id,
    l.name as lead_name,
    l.email,
    l.caller_type,
    l.created_at,
    CASE 
        WHEN l.converted_contact_id IS NOT NULL THEN '✅ Converted to Contact'
        WHEN l.converted_account_id IS NOT NULL THEN '✅ Converted to Account'
        ELSE '❌ NOT CONVERTED'
    END as conversion_status,
    c.name as contact_name,
    a.name as account_name
FROM leads l
LEFT JOIN contacts c ON l.converted_contact_id = c.id
LEFT JOIN accounts a ON l.converted_account_id = a.id
WHERE l.created_at > NOW() - INTERVAL '24 hours'
ORDER BY l.created_at DESC
LIMIT 10;

-- 2. Count leads by conversion status
SELECT 
    'LEAD CONVERSION STATS (Last 7 Days):' as report,
    COUNT(*) as total_leads,
    COUNT(converted_contact_id) as converted_to_contacts,
    COUNT(converted_account_id) as converted_to_accounts,
    COUNT(*) - COUNT(converted_contact_id) - COUNT(converted_account_id) as not_converted
FROM leads
WHERE created_at > NOW() - INTERVAL '7 days';

-- 3. Show if the columns exist
SELECT 
    'CRITICAL COLUMNS CHECK:' as check_type,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'caller_type') as has_caller_type,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_contact_id') as has_converted_contact_id,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'converted_account_id') as has_converted_account_id;

-- 4. Show any leads with caller_type but no conversion
SELECT 
    'FAILED CONVERSIONS:' as issue,
    id,
    name,
    email,
    caller_type,
    created_at,
    'Should have been converted but wasn''t' as problem
FROM leads
WHERE caller_type IS NOT NULL
AND converted_contact_id IS NULL
AND converted_account_id IS NULL
AND created_at > NOW() - INTERVAL '24 hours'
LIMIT 5;