-- Check current structure of workflow_rules table and add missing columns
DO $$
BEGIN
    -- Check if workflow_rules table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_rules') THEN
        
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'entity_type') THEN
            ALTER TABLE workflow_rules ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'job' CHECK (entity_type IN ('lead', 'job', 'inspection', 'milestone', 'team_assignment', 'material_order', 'quote_request'));
            RAISE NOTICE 'Added entity_type column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'trigger_event') THEN
            ALTER TABLE workflow_rules ADD COLUMN trigger_event TEXT NOT NULL DEFAULT 'status_change' CHECK (trigger_event IN ('status_change', 'date_reached', 'field_updated', 'created', 'overdue', 'completed'));
            RAISE NOTICE 'Added trigger_event column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'trigger_conditions') THEN
            ALTER TABLE workflow_rules ADD COLUMN trigger_conditions JSONB DEFAULT '{}'::JSONB;
            RAISE NOTICE 'Added trigger_conditions column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'actions') THEN
            ALTER TABLE workflow_rules ADD COLUMN actions JSONB DEFAULT '[]'::JSONB;
            RAISE NOTICE 'Added actions column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'active') THEN
            ALTER TABLE workflow_rules ADD COLUMN active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added active column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'description') THEN
            ALTER TABLE workflow_rules ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'created_by') THEN
            ALTER TABLE workflow_rules ADD COLUMN created_by UUID REFERENCES user_profiles(id);
            RAISE NOTICE 'Added created_by column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'created_at') THEN
            ALTER TABLE workflow_rules ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_rules' AND column_name = 'updated_at') THEN
            ALTER TABLE workflow_rules ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column';
        END IF;
        
        RAISE NOTICE 'Workflow_rules table structure updated';
        
    ELSE
        RAISE NOTICE 'Workflow_rules table does not exist';
    END IF;
END $$;

-- Show current table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'workflow_rules' 
ORDER BY ordinal_position;