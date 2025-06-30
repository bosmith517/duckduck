-- Check the structure of job_costs table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'job_costs'
AND table_schema = 'public'
ORDER BY ordinal_position;