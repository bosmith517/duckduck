-- Sample job costs data for testing the Real-Time Job Costing page
-- Run this in your Supabase SQL editor to populate job_costs table

-- First, let's get the tenant_id and some job IDs
-- Replace 'your-tenant-id' with your actual tenant ID from the jobs table

-- Sample job costs for existing jobs
INSERT INTO public.job_costs (
  job_id, 
  tenant_id, 
  cost_type, 
  description, 
  quantity, 
  unit_cost, 
  total_cost, 
  cost_date, 
  vendor_name, 
  status,
  created_at
) VALUES
-- Assuming we have job IDs, replace these with actual job IDs from your jobs table
-- Labor costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 0), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'Senior Technician - 4 hours', 
  4, 
  75.00, 
  300.00, 
  CURRENT_DATE - INTERVAL '2 days',
  'In-House Staff',
  'approved',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 0), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'Apprentice - 4 hours', 
  4, 
  45.00, 
  180.00, 
  CURRENT_DATE - INTERVAL '2 days',
  'In-House Staff',
  'approved',
  NOW() - INTERVAL '2 days'
),

-- Material costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 0), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Copper Pipes (50 ft)', 
  50, 
  3.25, 
  162.50, 
  CURRENT_DATE - INTERVAL '1 day',
  'Home Depot',
  'approved',
  NOW() - INTERVAL '1 day'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 0), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Pipe Fittings (assorted)', 
  1, 
  85.00, 
  85.00, 
  CURRENT_DATE - INTERVAL '1 day',
  'Ferguson Plumbing',
  'pending',
  NOW() - INTERVAL '1 day'
),

-- Equipment costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 0), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'equipment', 
  'Pipe Threading Machine Rental', 
  1, 
  120.00, 
  120.00, 
  CURRENT_DATE,
  'United Rentals',
  'pending',
  NOW()
),

-- Second job costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 1), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'HVAC Technician - 6 hours', 
  6, 
  85.00, 
  510.00, 
  CURRENT_DATE - INTERVAL '3 days',
  'In-House Staff',
  'approved',
  NOW() - INTERVAL '3 days'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 1), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Air Filter (High-Efficiency)', 
  2, 
  35.00, 
  70.00, 
  CURRENT_DATE - INTERVAL '2 days',
  'HVAC Supply Co',
  'approved',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 1), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Refrigerant R-410A (5 lbs)', 
  5, 
  12.50, 
  62.50, 
  CURRENT_DATE - INTERVAL '1 day',
  'Johnstone Supply',
  'approved',
  NOW() - INTERVAL '1 day'
),

-- Third job costs  
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 2), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'Electrician - 8 hours', 
  8, 
  90.00, 
  720.00, 
  CURRENT_DATE - INTERVAL '1 day',
  'In-House Staff',
  'approved',
  NOW() - INTERVAL '1 day'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 2), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Electrical Panel (200A)', 
  1, 
  350.00, 
  350.00, 
  CURRENT_DATE,
  'Rexel Electrical',
  'pending',
  NOW()
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 2), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Copper Wire 12 AWG (250 ft)', 
  250, 
  1.85, 
  462.50, 
  CURRENT_DATE,
  'Graybar Electric',
  'approved',
  NOW()
),

-- Fourth job costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 3), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'subcontractor', 
  'Roofing Subcontractor', 
  1, 
  2500.00, 
  2500.00, 
  CURRENT_DATE - INTERVAL '5 days',
  'ABC Roofing Co',
  'approved',
  NOW() - INTERVAL '5 days'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 3), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Asphalt Shingles (30 squares)', 
  30, 
  125.00, 
  3750.00, 
  CURRENT_DATE - INTERVAL '4 days',
  'Beacon Building Products',
  'approved',
  NOW() - INTERVAL '4 days'
),

-- Fifth job costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 4), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'Flooring Installer - 12 hours', 
  12, 
  55.00, 
  660.00, 
  CURRENT_DATE - INTERVAL '2 days',
  'In-House Staff',
  'approved',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 4), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'material', 
  'Luxury Vinyl Planks (800 sq ft)', 
  800, 
  4.25, 
  3400.00, 
  CURRENT_DATE - INTERVAL '3 days',
  'Floor & Decor',
  'approved',
  NOW() - INTERVAL '3 days'
),

-- Sixth job costs
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 5), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'labor', 
  'General Contractor - 10 hours', 
  10, 
  65.00, 
  650.00, 
  CURRENT_DATE,
  'In-House Staff',
  'pending',
  NOW()
),
(
  (SELECT id FROM jobs LIMIT 1 OFFSET 5), 
  (SELECT tenant_id FROM jobs LIMIT 1), 
  'overhead', 
  'Project Management Fee', 
  1, 
  200.00, 
  200.00, 
  CURRENT_DATE,
  'Internal',
  'approved',
  NOW()
);

-- Also add some job cost categories for better organization
INSERT INTO public.job_cost_categories (
  tenant_id,
  name,
  description,
  default_budget_percentage,
  color_code,
  is_active
) VALUES
(
  (SELECT tenant_id FROM jobs LIMIT 1),
  'Labor',
  'All labor-related costs including technicians and contractors',
  40.0,
  '#28a745',
  true
),
(
  (SELECT tenant_id FROM jobs LIMIT 1),
  'Materials',
  'Raw materials, supplies, and equipment purchases',
  35.0,
  '#007bff',
  true
),
(
  (SELECT tenant_id FROM jobs LIMIT 1),
  'Equipment',
  'Tool rentals and equipment costs',
  10.0,
  '#ffc107',
  true
),
(
  (SELECT tenant_id FROM jobs LIMIT 1),
  'Subcontractors',
  'Third-party contractor services',
  10.0,
  '#6f42c1',
  true
),
(
  (SELECT tenant_id FROM jobs LIMIT 1),
  'Overhead',
  'Administrative and indirect costs',
  5.0,
  '#6c757d',
  true
);

-- Update jobs table with some estimated values for comparison
UPDATE public.jobs 
SET 
  estimated_cost = 1500.00,
  total_budget = 1500.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 0);

UPDATE public.jobs 
SET 
  estimated_cost = 800.00,
  total_budget = 800.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 1);

UPDATE public.jobs 
SET 
  estimated_cost = 2000.00,
  total_budget = 2000.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 2);

UPDATE public.jobs 
SET 
  estimated_cost = 8000.00,
  total_budget = 8000.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 3);

UPDATE public.jobs 
SET 
  estimated_cost = 5000.00,
  total_budget = 5000.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 4);

UPDATE public.jobs 
SET 
  estimated_cost = 1200.00,
  total_budget = 1200.00,
  cost_tracking_enabled = true
WHERE id = (SELECT id FROM jobs LIMIT 1 OFFSET 5);