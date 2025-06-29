-- Template-Driven Estimates Database Schema (SAFE VERSION)
-- Run this directly in the Supabase SQL Editor

-- Create estimate_templates table for template-driven estimates
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
  markup_percentage DECIMAL(5,2) DEFAULT 20.00,
  tax_rate DECIMAL(5,2) DEFAULT 8.50,
  
  -- Template metadata
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  estimated_duration_days INTEGER DEFAULT 1,
  
  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approval_threshold DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add template-related columns to existing estimate_line_items table
ALTER TABLE estimate_line_items 
ADD COLUMN IF NOT EXISTS template_line_item_id UUID,
ADD COLUMN IF NOT EXISTS markup_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;

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

-- Update existing estimates table to support templates (only add columns that don't conflict)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES estimate_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS selected_tier TEXT CHECK (selected_tier IN ('basic', 'standard', 'premium')),
ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_from_template BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_duration_days INTEGER DEFAULT 1;

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimate_templates_tenant_service ON estimate_templates(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_usage ON estimate_templates(tenant_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_variables_estimate ON estimate_variables(estimate_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_estimates_template_id ON estimates(template_id);

-- Enable RLS on new tables (existing tables may already have RLS enabled)
ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Estimate templates are tenant-isolated" ON estimate_templates;
CREATE POLICY "Estimate templates are tenant-isolated" ON estimate_templates
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- Note: estimate_line_items table already exists with RLS policies, so we don't modify them

DROP POLICY IF EXISTS "Estimate variables are tenant-isolated" ON estimate_variables;
CREATE POLICY "Estimate variables are tenant-isolated" ON estimate_variables
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Template usage analytics are tenant-isolated" ON template_usage_analytics;
CREATE POLICY "Template usage analytics are tenant-isolated" ON template_usage_analytics
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

-- Grant necessary permissions
GRANT ALL ON estimate_templates TO authenticated;
GRANT ALL ON estimate_variables TO authenticated;
GRANT ALL ON template_usage_analytics TO authenticated;