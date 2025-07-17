-- Add equipment_cost and overhead_cost columns to estimates table
-- These are important for proper job costing calculations

ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS equipment_cost NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0.00;

-- Add comment to explain the columns
COMMENT ON COLUMN estimates.equipment_cost IS 'Equipment rental or usage costs for the estimate';
COMMENT ON COLUMN estimates.overhead_cost IS 'Overhead costs (admin, insurance, etc.) for the estimate';

-- Now fix the Master Bathroom remodel job with complete data
WITH job_estimate AS (
  SELECT 
    j.id as job_id,
    j.title,
    j.job_number,
    j.estimate_id,
    e.id as estimate_id_found,
    e.estimate_number,
    e.total_amount,
    e.material_cost,
    e.labor_cost,
    e.equipment_cost,
    e.overhead_cost
  FROM jobs j
  LEFT JOIN estimates e ON (
    e.id = j.estimate_id 
    OR (e.estimate_number = 'EST-20250712-0001' AND j.title = 'Master bathroom remodel')
  )
  WHERE j.id = '51c020b6-117f-4a65-ac40-0ea2ac836eda'
    OR j.title = 'Master bathroom remodel'
)
-- Update the job with the missing data
UPDATE jobs j
SET 
  job_number = CASE 
    WHEN j.job_number IS NULL OR j.job_number = '' 
    THEN 'JOB-20250712-0001' 
    ELSE j.job_number 
  END,
  estimate_id = COALESCE(j.estimate_id, je.estimate_id_found),
  contract_price = COALESCE(j.contract_price, je.total_amount, j.estimated_cost * 1.3),
  estimated_cost = COALESCE(j.estimated_cost, je.total_amount),
  estimated_material_cost = COALESCE(j.estimated_material_cost, je.material_cost, 0),
  estimated_labor_cost = COALESCE(j.estimated_labor_cost, je.labor_cost, 0),
  estimated_equipment_cost = COALESCE(j.estimated_equipment_cost, je.equipment_cost, 0),
  estimated_overhead_cost = COALESCE(j.estimated_overhead_cost, je.overhead_cost, 0),
  updated_at = NOW()
FROM job_estimate je
WHERE j.id = je.job_id;

-- Also fix any other jobs that have an estimate_id but missing contract_price
UPDATE jobs j
SET 
  contract_price = e.total_amount,
  estimated_material_cost = COALESCE(j.estimated_material_cost, e.material_cost, 0),
  estimated_labor_cost = COALESCE(j.estimated_labor_cost, e.labor_cost, 0),
  estimated_equipment_cost = COALESCE(j.estimated_equipment_cost, e.equipment_cost, 0),
  estimated_overhead_cost = COALESCE(j.estimated_overhead_cost, e.overhead_cost, 0),
  updated_at = NOW()
FROM estimates e
WHERE j.estimate_id = e.id
  AND j.estimate_id IS NOT NULL
  AND (j.contract_price IS NULL OR j.contract_price = 0);

-- Verify the fix
SELECT 
  j.id,
  j.job_number,
  j.title,
  j.contract_price,
  j.estimated_cost,
  j.actual_cost,
  j.estimate_id,
  e.estimate_number,
  e.total_amount as estimate_total
FROM jobs j
LEFT JOIN estimates e ON j.estimate_id = e.id
WHERE j.id = '51c020b6-117f-4a65-ac40-0ea2ac836eda'
   OR j.title = 'Master bathroom remodel';