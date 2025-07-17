-- Check the constraint on activity_category
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'job_activity_log'::regclass
AND conname LIKE '%activity_category%';

-- Also check the table definition
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'job_activity_log'
AND column_name = 'activity_category';

-- Check what values exist in the table
SELECT DISTINCT activity_category
FROM job_activity_log
ORDER BY activity_category;