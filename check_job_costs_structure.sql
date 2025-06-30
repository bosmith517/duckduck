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

-- Also check if we have any jobs
SELECT id, title, tenant_id, status 
FROM jobs 
LIMIT 5;

-- Check what columns we actually have in job_costs
SELECT * FROM job_costs LIMIT 1;