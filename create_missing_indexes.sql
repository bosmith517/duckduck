-- Create indexes only if the columns exist
DO $$
BEGIN
    -- Check if workflow_rules table and required columns exist before creating indexes
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflow_rules' 
        AND column_name IN ('tenant_id', 'entity_type', 'active')
        GROUP BY table_name 
        HAVING COUNT(*) = 3
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_workflow_rules_tenant_entity ON workflow_rules(tenant_id, entity_type, active);
        RAISE NOTICE 'Created idx_workflow_rules_tenant_entity index';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflow_rules' 
        AND column_name IN ('trigger_event', 'active')
        GROUP BY table_name 
        HAVING COUNT(*) = 2
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_workflow_rules_trigger_event ON workflow_rules(trigger_event, active);
        RAISE NOTICE 'Created idx_workflow_rules_trigger_event index';
    END IF;
END $$;