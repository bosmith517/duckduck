-- Real-Time Job Costing Schema - ULTRA SAFE VERSION
-- This handles existing tables and avoids column conflicts

-- 1. Create job_cost_categories table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cost_categories') THEN
    CREATE TABLE job_cost_categories (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      default_budget_percentage DECIMAL(5,2) DEFAULT 0.00,
      color_code TEXT DEFAULT '#007bff',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, name)
    );
  END IF;
END $$;

-- 2. Create job_costs table if it doesn't exist (without foreign key to categories yet)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_costs') THEN
    CREATE TABLE job_costs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      job_id UUID NOT NULL,
      category_id UUID NOT NULL,
      
      -- Cost details
      description TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      cost_type TEXT NOT NULL CHECK (cost_type IN ('labor', 'materials', 'equipment', 'subcontractor', 'other')),
      
      -- Receipt/documentation
      receipt_url TEXT,
      receipt_data JSONB DEFAULT '{}',
      vendor_name TEXT,
      
      -- Approval workflow
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      
      -- Metadata
      created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 3. Create job_budgets table if it doesn't exist (without foreign key to categories yet)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_budgets') THEN
    CREATE TABLE job_budgets (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      job_id UUID NOT NULL,
      category_id UUID NOT NULL,
      
      budgeted_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      alert_threshold DECIMAL(5,2) DEFAULT 80.00, -- Alert when 80% of budget used
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(job_id, category_id)
    );
  END IF;
END $$;

-- 4. Create job_profitability_snapshots table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_profitability_snapshots') THEN
    CREATE TABLE job_profitability_snapshots (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      job_id UUID NOT NULL,
      
      -- Financial snapshot
      total_revenue DECIMAL(10,2) DEFAULT 0.00,
      total_costs DECIMAL(10,2) DEFAULT 0.00,
      gross_profit DECIMAL(10,2) DEFAULT 0.00,
      profit_margin DECIMAL(5,2) DEFAULT 0.00,
      
      -- Cost breakdown
      labor_costs DECIMAL(10,2) DEFAULT 0.00,
      material_costs DECIMAL(10,2) DEFAULT 0.00,
      equipment_costs DECIMAL(10,2) DEFAULT 0.00,
      subcontractor_costs DECIMAL(10,2) DEFAULT 0.00,
      other_costs DECIMAL(10,2) DEFAULT 0.00,
      
      -- Status indicators
      budget_status TEXT DEFAULT 'on_track' CHECK (budget_status IN ('on_track', 'warning', 'over_budget')),
      last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
      
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 5. Create cost_approval_workflows table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_approval_workflows') THEN
    CREATE TABLE cost_approval_workflows (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      cost_id UUID NOT NULL REFERENCES job_costs(id) ON DELETE CASCADE,
      
      workflow_step INTEGER NOT NULL DEFAULT 1,
      approver_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      notes TEXT,
      
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 6. Add columns to existing tables if they don't exist
DO $$
BEGIN
  -- Add budget columns to jobs table if they don't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'total_budget') THEN
      ALTER TABLE jobs ADD COLUMN total_budget DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'cost_tracking_enabled') THEN
      ALTER TABLE jobs ADD COLUMN cost_tracking_enabled BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'budget_alert_threshold') THEN
      ALTER TABLE jobs ADD COLUMN budget_alert_threshold DECIMAL(5,2) DEFAULT 80.00;
    END IF;
  END IF;
  
  -- Add missing columns to job_costs table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_costs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'category_id') THEN
      ALTER TABLE job_costs ADD COLUMN category_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'status') THEN
      ALTER TABLE job_costs ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'cost_type') THEN
      ALTER TABLE job_costs ADD COLUMN cost_type TEXT CHECK (cost_type IN ('labor', 'materials', 'equipment', 'subcontractor', 'other'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'receipt_url') THEN
      ALTER TABLE job_costs ADD COLUMN receipt_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'receipt_data') THEN
      ALTER TABLE job_costs ADD COLUMN receipt_data JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'vendor_name') THEN
      ALTER TABLE job_costs ADD COLUMN vendor_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'approved_by') THEN
      ALTER TABLE job_costs ADD COLUMN approved_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'approved_at') THEN
      ALTER TABLE job_costs ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'created_by') THEN
      ALTER TABLE job_costs ADD COLUMN created_by UUID;
    END IF;
  END IF;
  
  -- Add missing columns to job_budgets table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_budgets') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_budgets' AND column_name = 'category_id') THEN
      ALTER TABLE job_budgets ADD COLUMN category_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_budgets' AND column_name = 'budgeted_amount') THEN
      ALTER TABLE job_budgets ADD COLUMN budgeted_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_budgets' AND column_name = 'alert_threshold') THEN
      ALTER TABLE job_budgets ADD COLUMN alert_threshold DECIMAL(5,2) DEFAULT 80.00;
    END IF;
  END IF;
END $$;

-- 7. Create foreign key constraints safely (check columns exist first)
DO $$
BEGIN
  -- job_costs to job_cost_categories
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cost_categories') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_costs') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'category_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_job_costs_category_id') THEN
    ALTER TABLE job_costs 
    ADD CONSTRAINT fk_job_costs_category_id 
    FOREIGN KEY (category_id) REFERENCES job_cost_categories(id) ON DELETE CASCADE;
  END IF;
  
  -- job_budgets to job_cost_categories
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cost_categories') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_budgets') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_budgets' AND column_name = 'category_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_job_budgets_category_id') THEN
    ALTER TABLE job_budgets 
    ADD CONSTRAINT fk_job_budgets_category_id 
    FOREIGN KEY (category_id) REFERENCES job_cost_categories(id) ON DELETE CASCADE;
  END IF;

  -- job_costs to jobs (if jobs table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_costs' AND column_name = 'job_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_job_costs_job_id') THEN
    ALTER TABLE job_costs 
    ADD CONSTRAINT fk_job_costs_job_id 
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
  
  -- job_budgets to jobs (if jobs table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_budgets' AND column_name = 'job_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_job_budgets_job_id') THEN
    ALTER TABLE job_budgets 
    ADD CONSTRAINT fk_job_budgets_job_id 
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
  
  -- job_profitability_snapshots to jobs (if jobs table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'job_profitability_snapshots' AND column_name = 'job_id') AND
     NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_job_profitability_job_id') THEN
    ALTER TABLE job_profitability_snapshots 
    ADD CONSTRAINT fk_job_profitability_job_id 
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. Enable RLS on all new tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cost_categories') THEN
    ALTER TABLE job_cost_categories ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_costs') THEN
    ALTER TABLE job_costs ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_budgets') THEN
    ALTER TABLE job_budgets ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_profitability_snapshots') THEN
    ALTER TABLE job_profitability_snapshots ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_approval_workflows') THEN
    ALTER TABLE cost_approval_workflows ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 9. Create RLS policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Job cost categories are tenant-isolated" ON job_cost_categories;
CREATE POLICY "Job cost categories are tenant-isolated" ON job_cost_categories
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Job costs are tenant-isolated" ON job_costs;
CREATE POLICY "Job costs are tenant-isolated" ON job_costs
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

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_cost_categories_tenant ON job_cost_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_tenant_job ON job_costs(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_category ON job_costs(category_id);
CREATE INDEX IF NOT EXISTS idx_job_costs_status ON job_costs(status);
CREATE INDEX IF NOT EXISTS idx_job_budgets_tenant_job ON job_budgets(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_job_profitability_tenant_job ON job_profitability_snapshots(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_cost_approval_cost ON cost_approval_workflows(cost_id);
CREATE INDEX IF NOT EXISTS idx_cost_approval_approver ON cost_approval_workflows(approver_id);

-- 11. Grant permissions
GRANT ALL ON job_cost_categories TO authenticated;
GRANT ALL ON job_costs TO authenticated;
GRANT ALL ON job_budgets TO authenticated;
GRANT ALL ON job_profitability_snapshots TO authenticated;
GRANT ALL ON cost_approval_workflows TO authenticated;

-- 12. Insert default cost categories for each tenant
INSERT INTO job_cost_categories (tenant_id, name, description, default_budget_percentage, color_code)
SELECT 
  t.id as tenant_id,
  category_data.name,
  category_data.description,
  category_data.default_budget_percentage,
  category_data.color_code
FROM tenants t
CROSS JOIN (
  VALUES 
    ('Labor', 'Labor costs including technician time', 40.00, '#007bff'),
    ('Materials', 'Parts, supplies, and materials', 30.00, '#28a745'),
    ('Equipment', 'Tools and equipment rental/purchase', 10.00, '#ffc107'),
    ('Subcontractor', 'Third-party contractor costs', 15.00, '#17a2b8'),
    ('Other', 'Miscellaneous job expenses', 5.00, '#6c757d')
) AS category_data(name, description, default_budget_percentage, color_code)
WHERE NOT EXISTS (
  SELECT 1 FROM job_cost_categories jcc 
  WHERE jcc.tenant_id = t.id AND jcc.name = category_data.name
);