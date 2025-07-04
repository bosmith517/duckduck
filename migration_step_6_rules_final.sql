-- Step 6: Update workflow_rules table with missing components
-- Enable RLS if not already enabled
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant_entity ON workflow_rules(tenant_id, entity_type, active);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger_event ON workflow_rules(trigger_event, active);

-- RLS Policies
DROP POLICY IF EXISTS "Users can view workflow rules in their tenant" ON workflow_rules;
DROP POLICY IF EXISTS "Users can manage workflow rules in their tenant" ON workflow_rules;

CREATE POLICY "Users can view workflow rules in their tenant" ON workflow_rules
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage workflow rules in their tenant" ON workflow_rules
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Create trigger
DROP TRIGGER IF EXISTS update_workflow_rules_updated_at ON workflow_rules;
CREATE TRIGGER update_workflow_rules_updated_at BEFORE UPDATE ON workflow_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();