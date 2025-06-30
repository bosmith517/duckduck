-- Populate job_costs table with sample data
-- Using the correct column names from your table structure

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
-- Job 1: Annual HVAC Maintenance (972a5e6e-77d1-418b-946d-044a51745d5a)
('972a5e6e-77d1-418b-946d-044a51745d5a', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Senior HVAC Technician - 4 hours', 4, 85.00, 340.00, CURRENT_DATE - INTERVAL '5 days', 'In-House Staff', 'approved', NOW() - INTERVAL '5 days'),
('972a5e6e-77d1-418b-946d-044a51745d5a', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Air Filters (MERV 13)', 2, 45.00, 90.00, CURRENT_DATE - INTERVAL '5 days', 'Ferguson HVAC Supply', 'approved', NOW() - INTERVAL '5 days'),
('972a5e6e-77d1-418b-946d-044a51745d5a', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Refrigerant R-410A (2 lbs)', 2, 25.00, 50.00, CURRENT_DATE - INTERVAL '5 days', 'Johnstone Supply', 'approved', NOW() - INTERVAL '5 days'),

-- Job 2: Emergency AC Repair (efeded72-0bbd-446f-95b9-b92e77b39db3)
('efeded72-0bbd-446f-95b9-b92e77b39db3', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Emergency Technician - 3 hours', 3, 120.00, 360.00, CURRENT_DATE - INTERVAL '10 days', 'In-House Staff', 'approved', NOW() - INTERVAL '10 days'),
('efeded72-0bbd-446f-95b9-b92e77b39db3', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Helper Technician - 3 hours', 3, 60.00, 180.00, CURRENT_DATE - INTERVAL '10 days', 'In-House Staff', 'approved', NOW() - INTERVAL '10 days'),
('efeded72-0bbd-446f-95b9-b92e77b39db3', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Capacitor 35/5 MFD', 1, 85.00, 85.00, CURRENT_DATE - INTERVAL '10 days', 'Grainger', 'approved', NOW() - INTERVAL '10 days'),
('efeded72-0bbd-446f-95b9-b92e77b39db3', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Contactor 40A 24V', 1, 125.00, 125.00, CURRENT_DATE - INTERVAL '10 days', 'Grainger', 'approved', NOW() - INTERVAL '10 days'),

-- Job 3: Furnace Tune-Up (8320042e-65bc-4bee-ab00-5a762b406db8)
('8320042e-65bc-4bee-ab00-5a762b406db8', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'HVAC Technician - 2 hours', 2, 85.00, 170.00, CURRENT_DATE - INTERVAL '15 days', 'In-House Staff', 'approved', NOW() - INTERVAL '15 days'),
('8320042e-65bc-4bee-ab00-5a762b406db8', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Furnace Filter 20x25x1', 1, 25.00, 25.00, CURRENT_DATE - INTERVAL '15 days', 'Home Depot', 'approved', NOW() - INTERVAL '15 days'),
('8320042e-65bc-4bee-ab00-5a762b406db8', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Thermocouple Universal', 1, 45.00, 45.00, CURRENT_DATE - INTERVAL '15 days', 'Ferguson HVAC Supply', 'approved', NOW() - INTERVAL '15 days'),

-- Job 4: Ductwork Inspection & Sealing (eba524ba-dc14-40f7-99b8-0cf78953d48e)
('eba524ba-dc14-40f7-99b8-0cf78953d48e', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Duct Specialist - 6 hours', 6, 95.00, 570.00, CURRENT_DATE - INTERVAL '20 days', 'In-House Staff', 'approved', NOW() - INTERVAL '20 days'),
('eba524ba-dc14-40f7-99b8-0cf78953d48e', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Helper - 6 hours', 6, 50.00, 300.00, CURRENT_DATE - INTERVAL '20 days', 'In-House Staff', 'approved', NOW() - INTERVAL '20 days'),
('eba524ba-dc14-40f7-99b8-0cf78953d48e', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Mastic Duct Sealant (5 gal)', 1, 120.00, 120.00, CURRENT_DATE - INTERVAL '20 days', 'Johnstone Supply', 'approved', NOW() - INTERVAL '20 days'),
('eba524ba-dc14-40f7-99b8-0cf78953d48e', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Foil Tape (10 rolls)', 10, 12.00, 120.00, CURRENT_DATE - INTERVAL '20 days', 'Ferguson HVAC Supply', 'approved', NOW() - INTERVAL '20 days'),
('eba524ba-dc14-40f7-99b8-0cf78953d48e', '10076fd5-e70f-4062-8192-e42173cf57fd', 'equipment', 'Duct Camera Rental', 1, 150.00, 150.00, CURRENT_DATE - INTERVAL '20 days', 'United Rentals', 'approved', NOW() - INTERVAL '20 days'),

-- Job 5: New Customer System Evaluation (377e8231-e246-44f3-9a72-f98136bca616)
('377e8231-e246-44f3-9a72-f98136bca616', '10076fd5-e70f-4062-8192-e42173cf57fd', 'labor', 'Senior Technician - System Evaluation', 3, 95.00, 285.00, CURRENT_DATE - INTERVAL '25 days', 'In-House Staff', 'approved', NOW() - INTERVAL '25 days'),
('377e8231-e246-44f3-9a72-f98136bca616', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Diagnostic Test Kit Supplies', 1, 35.00, 35.00, CURRENT_DATE - INTERVAL '25 days', 'HVAC Tools Direct', 'approved', NOW() - INTERVAL '25 days'),
('377e8231-e246-44f3-9a72-f98136bca616', '10076fd5-e70f-4062-8192-e42173cf57fd', 'overhead', 'Report Generation & Documentation', 1, 50.00, 50.00, CURRENT_DATE - INTERVAL '25 days', 'Internal', 'approved', NOW() - INTERVAL '25 days');

-- Add some pending costs for the scheduled job
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
('972a5e6e-77d1-418b-946d-044a51745d5a', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Replacement Belt', 1, 35.00, 35.00, CURRENT_DATE, 'Ferguson HVAC Supply', 'pending', NOW()),
('972a5e6e-77d1-418b-946d-044a51745d5a', '10076fd5-e70f-4062-8192-e42173cf57fd', 'material', 'Lubricants and Cleaners', 1, 45.00, 45.00, CURRENT_DATE, 'Grainger', 'pending', NOW());

-- Verify the data was inserted
SELECT 
  j.title as job_title,
  jc.cost_type,
  jc.description,
  jc.total_cost,
  jc.status,
  jc.vendor_name
FROM job_costs jc
JOIN jobs j ON j.id = jc.job_id
ORDER BY j.title, jc.created_at;