-- Create the missing job_photos_view that the frontend components need
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE VIEW job_photos_view AS
SELECT 
  jp.*,
  j.job_number,
  j.title as job_title,
  jc.description as cost_description,
  jc.cost_type,
  COALESCE(up.first_name || ' ' || up.last_name, 'Unknown User') as taken_by_name
FROM job_photos jp
LEFT JOIN jobs j ON jp.job_id = j.id
LEFT JOIN job_costs jc ON jp.cost_entry_id = jc.id
LEFT JOIN user_profiles up ON jp.taken_by = up.id;

-- Grant permissions to the view
GRANT SELECT ON job_photos_view TO authenticated;
GRANT SELECT ON job_photos_view TO service_role;