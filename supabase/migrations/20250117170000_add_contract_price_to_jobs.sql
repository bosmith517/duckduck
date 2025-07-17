-- Add contract_price and enhanced cost tracking fields to jobs table
-- This migration adds fields needed for proper job costing without deleting anything

-- Add contract_price field to store the amount being charged to the client
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contract_price DECIMAL(10,2) DEFAULT 0;

-- Add estimated cost breakdown fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_material_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_labor_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_equipment_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_overhead_cost DECIMAL(10,2) DEFAULT 0;

-- Add completion percentage field
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_percentage DECIMAL(5,2) DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN jobs.contract_price IS 'Total amount being charged to the client';
COMMENT ON COLUMN jobs.estimated_material_cost IS 'Estimated cost of materials';
COMMENT ON COLUMN jobs.estimated_labor_cost IS 'Estimated cost of labor';
COMMENT ON COLUMN jobs.estimated_equipment_cost IS 'Estimated cost of equipment';
COMMENT ON COLUMN jobs.estimated_overhead_cost IS 'Estimated overhead costs';
COMMENT ON COLUMN jobs.completion_percentage IS 'Job completion percentage (0-100)';

-- Add cost subcategories and enhanced tracking to job_costs table
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS cost_subtype VARCHAR(100);
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS markup_type VARCHAR(20) DEFAULT 'flat';
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE job_costs ADD COLUMN IF NOT EXISTS budget_category VARCHAR(100);

-- Add comments for job_costs enhancements
COMMENT ON COLUMN job_costs.cost_subtype IS 'Subcategory for more detailed cost tracking (e.g., paint, drywall for materials)';
COMMENT ON COLUMN job_costs.markup_percentage IS 'Markup percentage applied to this cost';
COMMENT ON COLUMN job_costs.markup_type IS 'Type of markup: flat or margin';
COMMENT ON COLUMN job_costs.is_approved IS 'Whether this cost entry has been approved';
COMMENT ON COLUMN job_costs.approved_by IS 'User who approved this cost entry';
COMMENT ON COLUMN job_costs.approval_notes IS 'Notes from the approval process';
COMMENT ON COLUMN job_costs.budget_category IS 'Budget category this cost maps to';

-- Update RLS policies to include new fields (if needed)
-- The existing RLS policies should automatically cover the new fields

-- For the example job mentioned by user, let's set some default values
-- This is optional but helps with the transition
UPDATE jobs 
SET contract_price = estimated_cost 
WHERE contract_price = 0 AND estimated_cost > 0;

-- Add check constraints to ensure data integrity
ALTER TABLE jobs ADD CONSTRAINT jobs_contract_price_positive CHECK (contract_price >= 0);
ALTER TABLE jobs ADD CONSTRAINT jobs_completion_percentage_range CHECK (completion_percentage >= 0 AND completion_percentage <= 100);
ALTER TABLE job_costs ADD CONSTRAINT job_costs_markup_percentage_positive CHECK (markup_percentage >= 0);