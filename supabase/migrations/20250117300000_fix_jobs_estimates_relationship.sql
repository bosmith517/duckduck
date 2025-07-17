-- Create a view that resolves the ambiguous relationship between jobs and estimates
-- This view shows all estimates related to a job (both directly linked and referenced)
CREATE OR REPLACE VIEW job_estimates_view AS
SELECT DISTINCT
    j.id as job_id,
    e.id as estimate_id,
    e.estimate_number,
    e.status,
    e.total_amount,
    e.version,
    e.created_at,
    e.project_title,
    e.tenant_id,
    CASE 
        WHEN e.job_id = j.id THEN 'job_estimate'  -- Estimate created for this job
        WHEN j.estimate_id = e.id THEN 'source_estimate'  -- Estimate that created this job
        ELSE 'unknown'
    END as relationship_type
FROM jobs j
LEFT JOIN estimates e ON (e.job_id = j.id OR j.estimate_id = e.id)
WHERE e.id IS NOT NULL;

-- Grant permissions on the view
GRANT SELECT ON job_estimates_view TO authenticated;
GRANT SELECT ON job_estimates_view TO anon;

-- Add comment to explain the view
COMMENT ON VIEW job_estimates_view IS 'Resolves the ambiguous relationship between jobs and estimates by showing all estimates related to a job';