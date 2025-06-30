-- Simple job costs insertion
-- First, run the check_job_costs_structure.sql to see your table structure
-- Then adjust this script based on the actual columns

-- Get a job ID and tenant ID from existing data
WITH job_data AS (
  SELECT id as job_id, tenant_id 
  FROM jobs 
  WHERE tenant_id IS NOT NULL
  LIMIT 1
)
-- Insert a test cost
INSERT INTO job_costs (
  job_id,
  tenant_id,
  description,
  amount,
  created_at
)
SELECT 
  job_id,
  tenant_id,
  'Test Material Cost',
  150.00,
  NOW()
FROM job_data;

-- Verify the insertion
SELECT * FROM job_costs;