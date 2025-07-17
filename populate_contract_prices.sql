-- Script to populate contract_price for existing jobs
-- This is a one-time migration to set reasonable contract prices for jobs that don't have them

-- Update jobs where contract_price is 0 or null
-- Set contract_price to estimated_cost * 1.5 (50% markup) as a reasonable default
UPDATE jobs 
SET contract_price = CASE 
  WHEN estimated_cost > 0 THEN estimated_cost * 1.5
  ELSE 1000  -- Default contract price if no estimated cost
END
WHERE contract_price = 0 OR contract_price IS NULL;

-- For the specific Scott Davis job mentioned by the user
UPDATE jobs 
SET 
  contract_price = 1000,
  estimated_cost = 300
WHERE title LIKE '%Scott Davis%' 
  AND title LIKE '%Electrical Service%';

-- Show the updated jobs
SELECT 
  title,
  contract_price,
  estimated_cost,
  actual_cost,
  (contract_price - actual_cost) as expected_profit,
  CASE 
    WHEN contract_price > 0 THEN ROUND(((contract_price - actual_cost) / contract_price * 100), 2)
    ELSE 0
  END as profit_margin_percent
FROM jobs 
WHERE contract_price > 0
ORDER BY title;