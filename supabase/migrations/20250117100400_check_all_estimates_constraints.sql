-- Check all constraints on the estimates table
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE 'Checking all constraints on estimates table...';
    
    FOR constraint_record IN
        SELECT 
            conname AS constraint_name,
            contype AS constraint_type,
            CASE 
                WHEN contype = 'c' THEN 'CHECK'
                WHEN contype = 'f' THEN 'FOREIGN KEY' 
                WHEN contype = 'p' THEN 'PRIMARY KEY'
                WHEN contype = 'u' THEN 'UNIQUE'
                WHEN contype = 'x' THEN 'EXCLUDE'
                ELSE contype::text
            END AS type_name,
            pg_get_constraintdef(c.oid) AS constraint_definition
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE t.relname = 'estimates'
            AND n.nspname = 'public'
            AND contype = 'c'  -- Only check constraints
        ORDER BY conname
    LOOP
        RAISE NOTICE 'Constraint: % (%) - %', 
            constraint_record.constraint_name,
            constraint_record.type_name,
            constraint_record.constraint_definition;
    END LOOP;
END $$;

-- Also check for any views or functions that might be affecting estimates
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%estimates%'
    AND definition LIKE '%client%'
    AND schemaname = 'public'
LIMIT 10;