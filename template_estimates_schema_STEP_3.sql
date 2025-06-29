-- STEP 3: Create new tables (run after step 2 succeeds)

-- Create estimate_variables table for template variable tracking
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

-- Create template_usage_analytics table for tracking
CREATE TABLE IF NOT EXISTS template_usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES estimate_templates(id) ON DELETE CASCADE,
  
  -- Usage details
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  customer_id UUID,
  customer_type TEXT CHECK (customer_type IN ('contact', 'account')),
  
  -- Results
  selected_tier TEXT,
  final_amount DECIMAL(10,2),
  creation_time_seconds INTEGER,
  was_sent BOOLEAN DEFAULT false,
  was_accepted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);