-- Update the Scott Davis job to have correct contract price
-- Job: "Electrical Service - Scott Davis JOB-20250716-0001"
-- Contract Price: $1000
-- Labor Cost: $300

UPDATE jobs 
SET 
  contract_price = 1000,
  estimated_cost = 300,
  actual_cost = 300
WHERE title LIKE '%Scott Davis%' 
  AND title LIKE '%Electrical Service%';

-- Check the update
SELECT 
  id,
  title,
  contract_price,
  estimated_cost,
  actual_cost,
  (contract_price - actual_cost) as expected_profit,
  ((contract_price - actual_cost) / contract_price * 100) as profit_margin
FROM jobs 
WHERE title LIKE '%Scott Davis%' 
  AND title LIKE '%Electrical Service%';