-- Fix the notification templates migration function
-- The error was trying to reference 'template_id' column that doesn't exist

-- Drop the broken function first
DROP FUNCTION IF EXISTS migrate_notification_templates_to_versioned();

-- Create the correct migration function using the actual column name 'id'
CREATE OR REPLACE FUNCTION migrate_notification_templates_to_versioned()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    template_record RECORD;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Migrate existing notification templates to the new versioned system
    FOR template_record IN 
        SELECT id, tenant_id, template_name, template_type, category, subject, message_template, variables, active, created_at, created_by
        FROM notification_templates
        WHERE template_name IS NOT NULL
    LOOP
        -- Check if a versioned template already exists for this template
        IF NOT EXISTS (
            SELECT 1 FROM email_template_versions 
            WHERE tenant_id = template_record.tenant_id 
            AND template_name = template_record.template_name
        ) THEN
            -- Create versioned template
            INSERT INTO email_template_versions (
                tenant_id,
                template_name,
                version,
                subject_template,
                html_template,
                text_template,
                variables,
                description,
                is_active,
                created_at,
                created_by
            ) VALUES (
                template_record.tenant_id,
                template_record.template_name,
                1,
                COALESCE(template_record.subject, 'No Subject'),
                template_record.message_template,
                NULL, -- text template
                template_record.variables,
                'Migrated from notification_templates',
                template_record.active,
                template_record.created_at,
                template_record.created_by
            );
            
            RAISE NOTICE 'Migrated template: % for tenant: %', template_record.template_name, template_record.tenant_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END;
$$;

-- Update the email queue table to properly reference email_template_versions
-- instead of notification_templates
ALTER TABLE email_queue 
DROP CONSTRAINT IF EXISTS email_queue_template_id_fkey;

-- Add proper foreign key to email_template_versions
ALTER TABLE email_queue 
ADD CONSTRAINT email_queue_template_id_fkey 
FOREIGN KEY (template_id) REFERENCES email_template_versions(id);

-- Add helpful comment
COMMENT ON FUNCTION migrate_notification_templates_to_versioned IS 'Migrates existing notification templates to the new versioned email template system';

-- Verification query to check migration status
-- SELECT 'Migration function ready for execution' as status;