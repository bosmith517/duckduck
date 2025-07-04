-- Step 1: Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_rule_id UUID NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}'::JSONB,
  actions_executed JSONB DEFAULT '[]'::JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant_status ON workflow_executions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_rule_id ON workflow_executions(workflow_rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_entity ON workflow_executions(entity_type, entity_id);

-- Enable RLS
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view workflow executions in their tenant" ON workflow_executions;
DROP POLICY IF EXISTS "System can manage workflow executions" ON workflow_executions;

CREATE POLICY "Users can view workflow executions in their tenant" ON workflow_executions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can manage workflow executions" ON workflow_executions
  FOR ALL USING (true);