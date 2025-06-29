-- Template-Driven Estimates Schema - Compatible with EXISTING Database
-- Based on the actual database schema provided by user

-- 1. Create estimate_templates table (completely new table)
CREATE TABLE IF NOT EXISTS estimate_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('installation', 'repair', 'maintenance', 'consultation', 'emergency', 'custom')),
  
  -- Base pricing structure
  base_price DECIMAL(10,2) DEFAULT 0.00,
  pricing_tiers JSONB NOT NULL DEFAULT '{
    "basic": {"name": "Basic Package", "description": "", "price": 0, "includes": []},
    "standard": {"name": "Standard Package", "description": "", "price": 0, "includes": []},
    "premium": {"name": "Premium Package", "description": "", "price": 0, "includes": []}
  }',
  
  -- Template configuration
  line_items JSONB DEFAULT '[]',
  variables JSONB DEFAULT '[]',
  
  -- Template metadata
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  estimated_duration_days INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add ONLY new columns to existing estimates table (avoid conflicts)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS template_id UUID,
ADD COLUMN IF NOT EXISTS selected_tier TEXT,
ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_from_template BOOLEAN DEFAULT false;

-- 3. Add foreign key constraint after column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_estimates_template_id'
  ) THEN
    ALTER TABLE estimates 
    ADD CONSTRAINT fk_estimates_template_id 
    FOREIGN KEY (template_id) REFERENCES estimate_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create estimate_variables table
CREATE TABLE IF NOT EXISTS estimate_variables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT NOT NULL CHECK (variable_type IN ('number', 'text', 'select', 'checkbox', 'area_measurement')),
  affects_pricing BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(estimate_id, variable_name)
);

-- 5. Create template_usage_analytics table
CREATE TABLE IF NOT EXISTS template_usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES estimate_templates(id) ON DELETE CASCADE,
  
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  customer_id UUID,
  customer_type TEXT CHECK (customer_type IN ('contact', 'account')),
  
  selected_tier TEXT,
  final_amount DECIMAL(10,2),
  creation_time_seconds INTEGER,
  was_sent BOOLEAN DEFAULT false,
  was_accepted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS on new tables only
ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_analytics ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
DROP POLICY IF EXISTS "Estimate templates are tenant-isolated" ON estimate_templates;
CREATE POLICY "Estimate templates are tenant-isolated" ON estimate_templates
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Estimate variables are tenant-isolated" ON estimate_variables;
CREATE POLICY "Estimate variables are tenant-isolated" ON estimate_variables
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Template usage analytics are tenant-isolated" ON template_usage_analytics;
CREATE POLICY "Template usage analytics are tenant-isolated" ON template_usage_analytics
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_estimate_templates_tenant ON estimate_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_service ON estimate_templates(service_type);
CREATE INDEX IF NOT EXISTS idx_estimate_variables_estimate ON estimate_variables(estimate_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_estimates_template_id ON estimates(template_id);

-- 9. Grant permissions
GRANT ALL ON estimate_templates TO authenticated;
GRANT ALL ON estimate_variables TO authenticated;
GRANT ALL ON template_usage_analytics TO authenticated;