-- Migration: Form Sync System
-- This creates the infrastructure for unified form and table integration

-- Create form sync logs table
CREATE TABLE IF NOT EXISTS form_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  form_id VARCHAR(100) NOT NULL,
  sync_date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
  synced_tables TEXT[],
  created_records JSONB DEFAULT '[]',
  updated_records JSONB DEFAULT '[]',
  errors TEXT[],
  original_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_form_sync_logs_tenant_id ON form_sync_logs(tenant_id);
CREATE INDEX idx_form_sync_logs_form_id ON form_sync_logs(form_id);
CREATE INDEX idx_form_sync_logs_sync_date ON form_sync_logs(sync_date DESC);
CREATE INDEX idx_form_sync_logs_status ON form_sync_logs(status);

-- Create form field mappings table
CREATE TABLE IF NOT EXISTS form_field_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_form_id VARCHAR(100) NOT NULL,
  source_field VARCHAR(100) NOT NULL,
  target_table VARCHAR(100) NOT NULL,
  target_field VARCHAR(100) NOT NULL,
  sync_behavior VARCHAR(20) CHECK (sync_behavior IN ('overwrite', 'append', 'ignore', 'create_new')),
  transform_function TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, source_form_id, source_field, target_table)
);

-- Add indexes
CREATE INDEX idx_form_field_mappings_tenant_id ON form_field_mappings(tenant_id);
CREATE INDEX idx_form_field_mappings_source_form ON form_field_mappings(source_form_id);
CREATE INDEX idx_form_field_mappings_target_table ON form_field_mappings(target_table);

-- Create form sync rules table
CREATE TABLE IF NOT EXISTS form_sync_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_name VARCHAR(200) NOT NULL,
  source_form_id VARCHAR(100) NOT NULL,
  trigger_event VARCHAR(20) CHECK (trigger_event IN ('create', 'update', 'delete')),
  conditions JSONB,
  actions JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_form_sync_rules_tenant_id ON form_sync_rules(tenant_id);
CREATE INDEX idx_form_sync_rules_source_form ON form_sync_rules(source_form_id);
CREATE INDEX idx_form_sync_rules_active ON form_sync_rules(is_active);

-- Create form prefill cache table
CREATE TABLE IF NOT EXISTS form_prefill_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_form_id VARCHAR(100) NOT NULL,
  target_form_id VARCHAR(100) NOT NULL,
  source_record_id UUID NOT NULL,
  prefill_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_form_prefill_cache_tenant_id ON form_prefill_cache(tenant_id);
CREATE INDEX idx_form_prefill_cache_forms ON form_prefill_cache(source_form_id, target_form_id);
CREATE INDEX idx_form_prefill_cache_expires ON form_prefill_cache(expires_at);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_form_sync_logs_updated_at BEFORE UPDATE ON form_sync_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_field_mappings_updated_at BEFORE UPDATE ON form_field_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_sync_rules_updated_at BEFORE UPDATE ON form_sync_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_prefill_cache_updated_at BEFORE UPDATE ON form_prefill_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle cross-table sync
CREATE OR REPLACE FUNCTION sync_form_data()
RETURNS TRIGGER AS $$
DECLARE
    sync_rules RECORD;
    mapped_data JSONB;
BEGIN
    -- Find applicable sync rules
    FOR sync_rules IN 
        SELECT * FROM form_sync_rules 
        WHERE source_form_id = TG_ARGV[0] 
        AND trigger_event = TG_OP::VARCHAR 
        AND is_active = TRUE
        AND tenant_id = NEW.tenant_id
        ORDER BY priority DESC
    LOOP
        -- Evaluate conditions if any
        IF sync_rules.conditions IS NOT NULL THEN
            -- Check if conditions are met (simplified)
            CONTINUE WHEN NOT (NEW::JSONB @> sync_rules.conditions);
        END IF;
        
        -- Process actions
        -- This is a simplified version - in production, you'd have more complex logic
        PERFORM process_sync_actions(sync_rules.actions, NEW, OLD);
    END LOOP;
    
    -- Log the sync
    INSERT INTO form_sync_logs (
        tenant_id,
        form_id,
        status,
        original_data,
        metadata
    ) VALUES (
        NEW.tenant_id,
        TG_ARGV[0],
        'success',
        row_to_json(NEW)::JSONB,
        jsonb_build_object(
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', NOW()
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to process sync actions
CREATE OR REPLACE FUNCTION process_sync_actions(
    actions JSONB,
    new_record RECORD,
    old_record RECORD
) RETURNS VOID AS $$
DECLARE
    action JSONB;
BEGIN
    -- Iterate through actions
    FOR action IN SELECT * FROM jsonb_array_elements(actions)
    LOOP
        -- Process based on action type
        -- This is simplified - real implementation would be more complex
        CASE action->>'type'
            WHEN 'sync' THEN
                -- Sync to another table
                NULL; -- Implementation would go here
            WHEN 'notify' THEN
                -- Send notification
                NULL; -- Implementation would go here
            WHEN 'update' THEN
                -- Update related records
                NULL; -- Implementation would go here
        END CASE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Example: Create sync trigger for leads table
CREATE TRIGGER sync_leads_data
    AFTER INSERT OR UPDATE OR DELETE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data('lead-creation');

-- Example: Create sync trigger for estimates table
CREATE TRIGGER sync_estimates_data
    AFTER INSERT OR UPDATE OR DELETE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data('estimate-creation');

-- Example: Create sync trigger for jobs table
CREATE TRIGGER sync_jobs_data
    AFTER INSERT OR UPDATE OR DELETE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data('job-creation');

-- Grant permissions
GRANT ALL ON form_sync_logs TO authenticated;
GRANT ALL ON form_field_mappings TO authenticated;
GRANT ALL ON form_sync_rules TO authenticated;
GRANT ALL ON form_prefill_cache TO authenticated;

-- Row Level Security
ALTER TABLE form_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_sync_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_prefill_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's sync logs" ON form_sync_logs
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert sync logs for their tenant" ON form_sync_logs
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view their tenant's field mappings" ON form_field_mappings
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage field mappings" ON form_field_mappings
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()) AND
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can view their tenant's sync rules" ON form_sync_rules
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage sync rules" ON form_sync_rules
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()) AND
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can access their tenant's prefill cache" ON form_prefill_cache
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));