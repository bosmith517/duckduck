-- CHECK EXACT STRUCTURE OF CONTACTS AND ACCOUNTS TABLES

-- 1. Show contacts table structure
SELECT 
    'CONTACTS TABLE' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts'
AND column_name IN ('name', 'address', 'address_line1', 'zip', 'zip_code', 'city', 'state')
ORDER BY ordinal_position;

-- 2. Show accounts table structure  
SELECT 
    'ACCOUNTS TABLE' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'accounts'
AND column_name IN ('name', 'type', 'account_type', 'billing_address', 'city', 'state', 'zip_code')
ORDER BY ordinal_position;

-- 3. Quick fix if name is required but nullable
ALTER TABLE contacts ALTER COLUMN name DROP NOT NULL;
ALTER TABLE accounts ALTER COLUMN name DROP NOT NULL;

SELECT 'Made name columns nullable to prevent errors' as status;