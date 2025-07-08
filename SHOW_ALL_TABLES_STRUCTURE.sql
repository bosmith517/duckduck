-- SHOW COMPLETE DATABASE STRUCTURE FOR LEADS WORKFLOW

-- 1. LEADS TABLE
SELECT 
    'LEADS TABLE COLUMNS:' as table_info,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- 2. CONTACTS TABLE  
SELECT 
    'CONTACTS TABLE COLUMNS:' as table_info,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

-- 3. ACCOUNTS TABLE
SELECT 
    'ACCOUNTS TABLE COLUMNS:' as table_info,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'accounts'
ORDER BY ordinal_position;

-- 4. CALENDAR_EVENTS TABLE
SELECT 
    'CALENDAR_EVENTS EXISTS:' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events')
        THEN '✅ YES'
        ELSE '❌ NO'
    END as status;

-- 5. Show sample data from leads
SELECT 
    'SAMPLE LEADS (last 5):' as data_check,
    *
FROM leads
ORDER BY created_at DESC
LIMIT 5;