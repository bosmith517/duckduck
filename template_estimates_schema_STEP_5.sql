-- STEP 5: Add indexes and RLS (run after step 4 succeeds)

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimate_templates_tenant_service ON estimate_templates(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_usage ON estimate_templates(tenant_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_variables_estimate ON estimate_variables(estimate_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_estimates_template_id ON estimates(template_id);

-- Enable RLS on new tables
ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Estimate templates are tenant-isolated" ON estimate_templates;
CREATE POLICY "Estimate templates are tenant-isolated" ON estimate_templates
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

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