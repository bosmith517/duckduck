-- Populate contract_price for ALL jobs from their accepted estimates
-- This will apply the same logic we used for Scott Davis to every job in the system

-- First, update jobs that have an associated estimate_id
UPDATE jobs j
SET contract_price = e.total_amount
FROM estimates e
WHERE j.estimate_id = e.id 
  AND e.status = 'approved'
  AND (j.contract_price IS NULL OR j.contract_price = 0);

-- Then, update jobs that have a lead_id but no estimate_id
-- Find the most recent approved estimate for that lead
UPDATE jobs j
SET contract_price = e.total_amount
FROM (
  SELECT DISTINCT ON (lead_id) 
    lead_id, 
    total_amount
  FROM estimates
  WHERE status = 'approved'
    AND lead_id IS NOT NULL
  ORDER BY lead_id, created_at DESC
) e
WHERE j.lead_id = e.lead_id
  AND j.estimate_id IS NULL
  AND (j.contract_price IS NULL OR j.contract_price = 0);

-- For jobs that still don't have a contract price, 
-- use estimated_cost * 1.3 (30% markup) as a default
UPDATE jobs
SET contract_price = CASE 
  WHEN estimated_cost > 0 THEN estimated_cost * 1.3
  ELSE 1000 -- Default if no estimated cost
END
WHERE contract_price IS NULL OR contract_price = 0;

-- Show the results
SELECT 
  COUNT(*) as total_jobs,
  COUNT(CASE WHEN contract_price > 0 THEN 1 END) as jobs_with_contract_price,
  COUNT(CASE WHEN contract_price = 0 OR contract_price IS NULL THEN 1 END) as jobs_without_contract_price
FROM jobs;