-- Fix existing workflow_rules table to reference tenants instead of companies
-- This will update the foreign key constraint if it exists

DO $$
BEGIN
    -- Check if workflow_rules table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_rules') THEN
        
        -- Drop the old foreign key constraint if it exists
        ALTER TABLE workflow_rules DROP CONSTRAINT IF EXISTS workflow_rules_tenant_id_fkey;
        
        -- Add the correct foreign key constraint
        ALTER TABLE workflow_rules 
        ADD CONSTRAINT workflow_rules_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Fixed workflow_rules foreign key constraint';
    END IF;
END $$;