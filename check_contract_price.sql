-- Check current contract_price values in jobs table
-- This will help identify if the field exists and has proper values

-- First, check if the contract_price column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'jobs' 
  AND column_name = 'contract_price';

-- Check all jobs with their contract_price values
SELECT 
  id,
  title,
  status,
  contract_price,
  estimated_cost,
  actual_cost,
  (contract_price - COALESCE(actual_cost, 0)) as expected_profit,
  CASE 
    WHEN contract_price > 0 THEN ROUND(((contract_price - COALESCE(actual_cost, 0)) / contract_price * 100), 2)
    ELSE 0
  END as profit_margin_percent,
  created_at
FROM jobs 
ORDER BY created_at DESC;

-- Check specifically for Scott Davis job
SELECT 
  id,
  title,
  status,
  contract_price,
  estimated_cost,
  actual_cost,
  created_at,
  updated_at
FROM jobs 
WHERE title ILIKE '%Scott Davis%' 
  OR title ILIKE '%Electrical Service%';

-- Count jobs by contract_price status
SELECT 
  CASE 
    WHEN contract_price = 0 THEN 'Zero'
    WHEN contract_price IS NULL THEN 'NULL'
    WHEN contract_price > 0 THEN 'Has Value'
  END as contract_price_status,
  COUNT(*) as job_count
FROM jobs 
GROUP BY 
  CASE 
    WHEN contract_price = 0 THEN 'Zero'
    WHEN contract_price IS NULL THEN 'NULL'
    WHEN contract_price > 0 THEN 'Has Value'
  END
ORDER BY job_count DESC;