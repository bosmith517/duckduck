-- Check and document the relationships between leads and accounts/contacts

-- First, let's see what foreign keys exist
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    RAISE NOTICE 'Checking foreign key relationships for leads table...';
    
    FOR fk_record IN
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'leads'
            AND tc.table_schema = 'public'
            AND ccu.table_name IN ('accounts', 'contacts')
    LOOP
        RAISE NOTICE 'Found FK: % on %.% -> %.%', 
            fk_record.constraint_name,
            fk_record.table_name,
            fk_record.column_name,
            fk_record.foreign_table_name,
            fk_record.foreign_column_name;
    END LOOP;
END $$;

-- Check if there are any other columns that might create relationships
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
    AND table_schema = 'public'
    AND column_name LIKE '%account%'
ORDER BY ordinal_position;

-- Check reverse relationships (accounts/contacts pointing to leads)
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    RAISE NOTICE 'Checking reverse relationships to leads table...';
    
    FOR fk_record IN
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('accounts', 'contacts')
            AND ccu.table_name = 'leads'
            AND tc.table_schema = 'public'
    LOOP
        RAISE NOTICE 'Found reverse FK: % on %.% -> %.%', 
            fk_record.constraint_name,
            fk_record.table_name,
            fk_record.column_name,
            fk_record.foreign_table_name,
            fk_record.foreign_column_name;
    END LOOP;
END $$;

-- Let's also check if there are any views or computed relationships
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%leads%'
    AND definition LIKE '%accounts%'
    AND schemaname = 'public'
LIMIT 5;