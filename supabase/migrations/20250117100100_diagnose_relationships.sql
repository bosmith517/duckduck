-- Diagnose all relationships between leads and accounts/contacts tables

-- Check all foreign keys from leads table
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name,
    af.attname AS foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE c.contype = 'f'
    AND c.conrelid = 'leads'::regclass
    AND c.confrelid IN ('accounts'::regclass, 'contacts'::regclass)
ORDER BY c.conname;

-- Check for any implicit relationships created by Supabase
SELECT 
    c.conname,
    c.conrelid::regclass,
    c.confrelid::regclass,
    c.conkey,
    c.confkey
FROM pg_constraint c
WHERE c.contype = 'f'
    AND (
        (c.conrelid = 'leads'::regclass AND c.confrelid = 'accounts'::regclass)
        OR
        (c.conrelid = 'accounts'::regclass AND c.confrelid = 'leads'::regclass)
    );

-- Check if there are any foreign keys in accounts table pointing to leads
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.contype = 'f'
    AND c.conrelid = 'accounts'::regclass
    AND c.confrelid = 'leads'::regclass;

-- List all columns in leads table to see if there are multiple account-related columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'leads'
    AND table_schema = 'public'
    AND (column_name LIKE '%account%' OR column_name LIKE '%contact%')
ORDER BY ordinal_position;

-- Check if there are any RLS policies that might create implicit relationships
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('leads', 'accounts')
    AND schemaname = 'public'
    AND (qual LIKE '%account%' OR with_check LIKE '%account%')
LIMIT 10;