-- Real-Time Job Costing Database Schema
-- Run this directly in the Supabase SQL Editor

-- Create job_costs table for tracking all job-related expenses
CREATE TABLE IF NOT EXISTS job_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Cost details
  category TEXT NOT NULL CHECK (category IN ('labor', 'materials', 'equipment', 'permits', 'travel', 'overhead', 'other')),
  subcategory TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  
  -- Vendor and receipt information
  vendor_name TEXT,
  receipt_url TEXT,
  receipt_number TEXT,
  
  -- Cost metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_reimbursable BOOLEAN DEFAULT false,
  is_billable BOOLEAN DEFAULT true,
  markup_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  -- Approval workflow
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,
  
  -- User tracking
  technician_id UUID REFERENCES user_profiles(id),
  created_by UUID REFERENCES user_profiles(id) DEFAULT auth.uid(),
  
  -- OCR and scanning metadata
  scanned_via_mobile BOOLEAN DEFAULT false,
  ocr_confidence DECIMAL(3,2),
  ocr_raw_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create job_cost_categories table for standardized categorization
CREATE TABLE IF NOT EXISTS job_cost_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  category TEXT NOT NULL,
  subcategory TEXT,
  display_name TEXT NOT NULL,
  description TEXT,
  default_markup_percentage DECIMAL(5,2) DEFAULT 0.00,
  is_billable_default BOOLEAN DEFAULT true,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, category, subcategory)
);

-- Create job_budgets table for budget tracking and variance analysis
CREATE TABLE IF NOT EXISTS job_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Budget breakdown by category
  labor_budget DECIMAL(10,2) DEFAULT 0.00,
  materials_budget DECIMAL(10,2) DEFAULT 0.00,
  equipment_budget DECIMAL(10,2) DEFAULT 0.00,
  permits_budget DECIMAL(10,2) DEFAULT 0.00,
  travel_budget DECIMAL(10,2) DEFAULT 0.00,
  overhead_budget DECIMAL(10,2) DEFAULT 0.00,
  other_budget DECIMAL(10,2) DEFAULT 0.00,
  
  -- Total budget and margins
  total_budget DECIMAL(10,2) NOT NULL,
  target_profit_margin DECIMAL(10,2) DEFAULT 0.00,
  target_profit_percentage DECIMAL(5,2) DEFAULT 20.00,
  
  -- Budget metadata
  created_from_estimate BOOLEAN DEFAULT false,
  estimate_id UUID REFERENCES estimates(id),
  budget_version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create job_profitability_snapshots for historical tracking
CREATE TABLE IF NOT EXISTS job_profitability_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Financial snapshot
  estimated_revenue DECIMAL(10,2) NOT NULL,
  actual_revenue DECIMAL(10,2) DEFAULT 0.00,
  total_costs DECIMAL(10,2) NOT NULL,
  profit_margin DECIMAL(10,2) NOT NULL,
  profit_percentage DECIMAL(5,2) NOT NULL,
  
  -- Cost breakdown
  labor_costs DECIMAL(10,2) DEFAULT 0.00,
  material_costs DECIMAL(10,2) DEFAULT 0.00,
  equipment_costs DECIMAL(10,2) DEFAULT 0.00,
  other_costs DECIMAL(10,2) DEFAULT 0.00,
  
  -- Status and alerts
  profitability_status TEXT NOT NULL CHECK (profitability_status IN ('profitable', 'break_even', 'losing_money', 'over_budget')),
  cost_variance DECIMAL(10,2) DEFAULT 0.00,
  budget_utilization_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  -- Alert flags
  requires_attention BOOLEAN DEFAULT false,
  alert_reason TEXT,
  
  snapshot_date TIMESTAMPTZ DEFAULT NOW()
);

-- Create cost_approval_workflows table for approval processes
CREATE TABLE IF NOT EXISTS cost_approval_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Workflow rules
  category TEXT NOT NULL,
  amount_threshold DECIMAL(10,2) NOT NULL,
  requires_approval BOOLEAN DEFAULT true,
  
  -- Approval hierarchy
  approver_role TEXT CHECK (approver_role IN ('admin', 'manager', 'supervisor')),
  approver_user_id UUID REFERENCES user_profiles(id),
  auto_approve_under_threshold BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update jobs table to include profitability tracking columns
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS estimated_profit_margin DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS actual_profit_margin DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS profit_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_job_costs DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cost_last_updated TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS profitability_status TEXT CHECK (profitability_status IN ('profitable', 'break_even', 'losing_money', 'pending')),
ADD COLUMN IF NOT EXISTS budget_alert_threshold DECIMAL(5,2) DEFAULT 90.00;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_costs_job_id ON job_costs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_tenant_category ON job_costs(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_job_costs_date ON job_costs(date DESC);
CREATE INDEX IF NOT EXISTS idx_job_costs_technician ON job_costs(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_budgets_job_id ON job_budgets(job_id);
CREATE INDEX IF NOT EXISTS idx_job_profitability_job_id ON job_profitability_snapshots(job_id);
CREATE INDEX IF NOT EXISTS idx_job_profitability_date ON job_profitability_snapshots(snapshot_date DESC);

-- Enable RLS on all tables
ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_profitability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_approval_workflows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Job costs are tenant-isolated" ON job_costs;
CREATE POLICY "Job costs are tenant-isolated" ON job_costs
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Job cost categories are tenant-isolated" ON job_cost_categories;
CREATE POLICY "Job cost categories are tenant-isolated" ON job_cost_categories
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Job budgets are tenant-isolated" ON job_budgets;
CREATE POLICY "Job budgets are tenant-isolated" ON job_budgets
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Job profitability snapshots are tenant-isolated" ON job_profitability_snapshots;
CREATE POLICY "Job profitability snapshots are tenant-isolated" ON job_profitability_snapshots
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Cost approval workflows are tenant-isolated" ON cost_approval_workflows;
CREATE POLICY "Cost approval workflows are tenant-isolated" ON cost_approval_workflows
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- Function to calculate job profitability in real-time
CREATE OR REPLACE FUNCTION calculate_job_profitability(job_id_param UUID)
RETURNS TABLE (
  total_costs DECIMAL(10,2),
  labor_costs DECIMAL(10,2),
  material_costs DECIMAL(10,2),
  equipment_costs DECIMAL(10,2),
  other_costs DECIMAL(10,2),
  profit_margin DECIMAL(10,2),
  profit_percentage DECIMAL(5,2),
  profitability_status TEXT
) AS $$
DECLARE
  job_record RECORD;
  costs_record RECORD;
  calculated_profit DECIMAL(10,2);
  calculated_percentage DECIMAL(5,2);
  status TEXT;
BEGIN
  -- Get job details
  SELECT estimated_value, total_amount INTO job_record
  FROM jobs j
  WHERE j.id = job_id_param;
  
  -- Calculate costs by category
  SELECT 
    COALESCE(SUM(amount), 0) as total,
    COALESCE(SUM(CASE WHEN category = 'labor' THEN amount ELSE 0 END), 0) as labor,
    COALESCE(SUM(CASE WHEN category = 'materials' THEN amount ELSE 0 END), 0) as materials,
    COALESCE(SUM(CASE WHEN category = 'equipment' THEN amount ELSE 0 END), 0) as equipment,
    COALESCE(SUM(CASE WHEN category NOT IN ('labor', 'materials', 'equipment') THEN amount ELSE 0 END), 0) as other
  INTO costs_record
  FROM job_costs
  WHERE job_id = job_id_param AND approval_status = 'approved';
  
  -- Calculate profit
  calculated_profit := COALESCE(job_record.total_amount, job_record.estimated_value, 0) - costs_record.total;
  
  -- Calculate percentage
  IF COALESCE(job_record.total_amount, job_record.estimated_value, 0) > 0 THEN
    calculated_percentage := (calculated_profit / COALESCE(job_record.total_amount, job_record.estimated_value)) * 100;
  ELSE
    calculated_percentage := 0;
  END IF;
  
  -- Determine status
  IF calculated_profit < 0 THEN
    status := 'losing_money';
  ELSIF calculated_percentage < 5 THEN
    status := 'break_even';
  ELSE
    status := 'profitable';
  END IF;
  
  RETURN QUERY SELECT 
    costs_record.total,
    costs_record.labor,
    costs_record.materials,
    costs_record.equipment,
    costs_record.other,
    calculated_profit,
    calculated_percentage,
    status;
END;
$$ LANGUAGE plpgsql;

-- Function to update job profitability when costs change
CREATE OR REPLACE FUNCTION update_job_profitability()
RETURNS TRIGGER AS $$
DECLARE
  profitability_data RECORD;
BEGIN
  -- Calculate new profitability
  SELECT * INTO profitability_data
  FROM calculate_job_profitability(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.job_id 
      ELSE NEW.job_id 
    END
  );
  
  -- Update jobs table
  UPDATE jobs 
  SET 
    total_job_costs = profitability_data.total_costs,
    actual_profit_margin = profitability_data.profit_margin,
    profit_percentage = profitability_data.profit_percentage,
    profitability_status = profitability_data.profitability_status,
    cost_last_updated = NOW()
  WHERE id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.job_id 
    ELSE NEW.job_id 
  END;
  
  -- Create profitability snapshot
  INSERT INTO job_profitability_snapshots (
    tenant_id, job_id, estimated_revenue, total_costs,
    profit_margin, profit_percentage, profitability_status,
    labor_costs, material_costs, equipment_costs, other_costs
  )
  SELECT 
    j.tenant_id, j.id, COALESCE(j.total_amount, j.estimated_value, 0),
    profitability_data.total_costs, profitability_data.profit_margin,
    profitability_data.profit_percentage, profitability_data.profitability_status,
    profitability_data.labor_costs, profitability_data.material_costs,
    profitability_data.equipment_costs, profitability_data.other_costs
  FROM jobs j
  WHERE j.id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.job_id 
    ELSE NEW.job_id 
  END;
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Triggers for real-time profitability updates
DROP TRIGGER IF EXISTS trigger_update_job_profitability ON job_costs;
CREATE TRIGGER trigger_update_job_profitability
  AFTER INSERT OR UPDATE OR DELETE ON job_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_job_profitability();

-- Function to check for profit margin alerts
CREATE OR REPLACE FUNCTION check_profit_margin_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if job is losing money or over budget
  IF NEW.profitability_status = 'losing_money' OR NEW.profit_percentage < 5 THEN
    -- In a real implementation, this would trigger notifications
    -- For now, we'll just update the requires_attention flag
    UPDATE job_profitability_snapshots 
    SET 
      requires_attention = true,
      alert_reason = CASE 
        WHEN NEW.profitability_status = 'losing_money' THEN 'Job is losing money'
        WHEN NEW.profit_percentage < 5 THEN 'Profit margin below 5%'
        ELSE 'Requires attention'
      END
    WHERE job_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profit margin alerts
DROP TRIGGER IF EXISTS trigger_profit_margin_alerts ON jobs;
CREATE TRIGGER trigger_profit_margin_alerts
  AFTER UPDATE OF profitability_status, profit_percentage ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION check_profit_margin_alerts();

-- Insert default cost categories
INSERT INTO job_cost_categories (tenant_id, category, subcategory, display_name, description, default_markup_percentage, icon, color) 
SELECT 
  t.id as tenant_id,
  category,
  subcategory,
  display_name,
  description,
  default_markup_percentage,
  icon,
  color
FROM tenants t
CROSS JOIN (
  VALUES 
    ('labor', NULL, 'Labor', 'Technician hours and wages', 0.00, 'user', 'primary'),
    ('labor', 'regular_hours', 'Regular Hours', 'Standard work hours', 0.00, 'clock', 'primary'),
    ('labor', 'overtime', 'Overtime', 'Overtime premium hours', 50.00, 'time', 'warning'),
    ('materials', NULL, 'Materials', 'Parts and supplies', 20.00, 'package', 'success'),
    ('materials', 'parts', 'Parts', 'Replacement parts and components', 25.00, 'wrench', 'success'),
    ('materials', 'supplies', 'Supplies', 'Consumable supplies', 15.00, 'box', 'success'),
    ('equipment', NULL, 'Equipment', 'Tools and machinery', 10.00, 'wrench', 'warning'),
    ('equipment', 'tools', 'Tools', 'Hand tools and equipment', 10.00, 'hammer', 'warning'),
    ('equipment', 'rental', 'Equipment Rental', 'Rented machinery', 0.00, 'truck', 'warning'),
    ('permits', NULL, 'Permits', 'Permits and inspections', 0.00, 'document', 'info'),
    ('travel', NULL, 'Travel', 'Mileage and travel expenses', 0.00, 'location', 'secondary'),
    ('overhead', NULL, 'Overhead', 'Indirect costs', 0.00, 'setting-2', 'dark'),
    ('other', NULL, 'Other', 'Miscellaneous expenses', 0.00, 'more-horizontal', 'muted')
) AS defaults(category, subcategory, display_name, description, default_markup_percentage, icon, color)
ON CONFLICT (tenant_id, category, subcategory) DO NOTHING;

-- Create view for job profitability dashboard
CREATE OR REPLACE VIEW job_profitability_dashboard AS
SELECT 
  j.id as job_id,
  j.title as job_title,
  j.status as job_status,
  j.estimated_value,
  j.total_amount as actual_revenue,
  j.total_job_costs,
  j.actual_profit_margin,
  j.profit_percentage,
  j.profitability_status,
  j.cost_last_updated,
  
  -- Cost breakdown
  COALESCE(costs.labor_costs, 0) as labor_costs,
  COALESCE(costs.material_costs, 0) as material_costs,
  COALESCE(costs.equipment_costs, 0) as equipment_costs,
  COALESCE(costs.other_costs, 0) as other_costs,
  
  -- Budget comparison
  COALESCE(b.total_budget, 0) as total_budget,
  CASE 
    WHEN b.total_budget > 0 THEN (j.total_job_costs / b.total_budget) * 100
    ELSE 0 
  END as budget_utilization_percentage,
  
  -- Customer info
  COALESCE(c.first_name || ' ' || c.last_name, a.name) as customer_name,
  
  j.created_at,
  j.updated_at
  
FROM jobs j
LEFT JOIN (
  SELECT 
    job_id,
    SUM(CASE WHEN category = 'labor' THEN amount ELSE 0 END) as labor_costs,
    SUM(CASE WHEN category = 'materials' THEN amount ELSE 0 END) as material_costs,
    SUM(CASE WHEN category = 'equipment' THEN amount ELSE 0 END) as equipment_costs,
    SUM(CASE WHEN category NOT IN ('labor', 'materials', 'equipment') THEN amount ELSE 0 END) as other_costs
  FROM job_costs 
  WHERE approval_status = 'approved'
  GROUP BY job_id
) costs ON j.id = costs.job_id
LEFT JOIN job_budgets b ON j.id = b.job_id AND b.is_active = true
LEFT JOIN contacts c ON j.contact_id = c.id
LEFT JOIN accounts a ON j.account_id = a.id;

-- Grant necessary permissions
GRANT ALL ON job_costs TO authenticated;
GRANT ALL ON job_cost_categories TO authenticated;
GRANT ALL ON job_budgets TO authenticated;
GRANT ALL ON job_profitability_snapshots TO authenticated;
GRANT ALL ON cost_approval_workflows TO authenticated;
GRANT SELECT ON job_profitability_dashboard TO authenticated;