-- Migration: Enhanced Form Sync Triggers
-- This creates specific database triggers for automatic cross-table synchronization

-- Drop existing generic triggers if they exist
DROP TRIGGER IF EXISTS sync_leads_data ON leads;
DROP TRIGGER IF EXISTS sync_estimates_data ON estimates;
DROP TRIGGER IF EXISTS sync_jobs_data ON jobs;

-- Enhanced function to handle cross-table sync with better error handling
CREATE OR REPLACE FUNCTION sync_form_data_enhanced()
RETURNS TRIGGER AS $$
DECLARE
    sync_rules RECORD;
    mapped_data JSONB;
    target_record_id UUID;
    sync_log_id UUID;
BEGIN
    -- Generate sync log ID
    sync_log_id := gen_random_uuid();
    
    -- Log the sync attempt
    INSERT INTO form_sync_logs (
        id,
        tenant_id,
        form_id,
        sync_date,
        status,
        original_data,
        metadata
    ) VALUES (
        sync_log_id,
        NEW.tenant_id,
        TG_ARGV[0],
        NOW(),
        'in_progress',
        row_to_json(NEW)::JSONB,
        jsonb_build_object(
            'table_name', TG_TABLE_NAME,
            'operation', TG_OP,
            'timestamp', NOW()
        )
    );
    
    -- Find applicable sync rules
    FOR sync_rules IN 
        SELECT * FROM form_sync_rules 
        WHERE source_form_id = TG_ARGV[0] 
        AND trigger_event = LOWER(TG_OP)
        AND is_active = TRUE
        AND tenant_id = NEW.tenant_id
        ORDER BY priority DESC
    LOOP
        BEGIN
            -- Process sync actions
            PERFORM process_sync_actions_enhanced(
                sync_rules.actions,
                NEW,
                OLD,
                sync_log_id
            );
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other rules
            UPDATE form_sync_logs
            SET errors = array_append(errors, 
                format('Rule %s: %s', sync_rules.rule_name, SQLERRM))
            WHERE id = sync_log_id;
        END;
    END LOOP;
    
    -- Update sync log status
    UPDATE form_sync_logs
    SET status = CASE 
        WHEN array_length(errors, 1) > 0 THEN 'failed'
        ELSE 'success'
    END,
    updated_at = NOW()
    WHERE id = sync_log_id;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log critical error
    UPDATE form_sync_logs
    SET status = 'failed',
        errors = array_append(errors, SQLERRM),
        updated_at = NOW()
    WHERE id = sync_log_id;
    
    -- Re-raise to prevent data corruption
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Enhanced action processor with specific sync logic
CREATE OR REPLACE FUNCTION process_sync_actions_enhanced(
    actions JSONB,
    new_record RECORD,
    old_record RECORD,
    sync_log_id UUID
) RETURNS VOID AS $$
DECLARE
    action JSONB;
    target_table TEXT;
    field_mappings JSONB;
    target_data JSONB;
    sync_result RECORD;
    field_mapping JSONB;
BEGIN
    -- Iterate through actions
    FOR action IN SELECT * FROM jsonb_array_elements(actions)
    LOOP
        target_table := action->>'targetTable';
        field_mappings := action->'fieldMappings';
        
        -- Build target data based on field mappings
        target_data := jsonb_build_object();
        
        -- Map fields
        FOR field_mapping IN SELECT * FROM jsonb_array_elements(field_mappings)
        LOOP
            target_data := target_data || jsonb_build_object(
                field_mapping->>'targetField',
                (row_to_json(new_record)::JSONB)->(field_mapping->>'sourceField')
            );
        END LOOP;
        
        -- Add tenant_id
        target_data := target_data || jsonb_build_object('tenant_id', new_record.tenant_id);
        
        -- Process based on action type
        CASE action->>'type'
            WHEN 'sync', 'create' THEN
                EXECUTE format(
                    'INSERT INTO %I (%s) VALUES (%s) 
                     ON CONFLICT (id, tenant_id) DO UPDATE SET %s
                     RETURNING id',
                    target_table,
                    (SELECT string_agg(key, ', ') FROM jsonb_object_keys(target_data) AS key),
                    (SELECT string_agg(format('$1->>%L', key), ', ') FROM jsonb_object_keys(target_data) AS key),
                    (SELECT string_agg(format('%I = EXCLUDED.%I', key, key), ', ') 
                     FROM jsonb_object_keys(target_data) AS key WHERE key != 'id')
                ) INTO sync_result USING target_data;
                
                -- Log created/updated record
                UPDATE form_sync_logs
                SET synced_tables = array_append(synced_tables, target_table),
                    created_records = CASE 
                        WHEN action->>'type' = 'create' 
                        THEN created_records || jsonb_build_array(
                            jsonb_build_object('table', target_table, 'id', sync_result.id)
                        )
                        ELSE created_records
                    END,
                    updated_records = CASE 
                        WHEN action->>'type' = 'sync' 
                        THEN updated_records || jsonb_build_array(
                            jsonb_build_object('table', target_table, 'id', sync_result.id)
                        )
                        ELSE updated_records
                    END
                WHERE id = sync_log_id;
                
            WHEN 'update' THEN
                -- Update existing record
                EXECUTE format(
                    'UPDATE %I SET %s WHERE id = $1 AND tenant_id = $2',
                    target_table,
                    (SELECT string_agg(format('%I = $3->>%L', key, key), ', ') 
                     FROM jsonb_object_keys(target_data) AS key WHERE key NOT IN ('id', 'tenant_id'))
                ) USING (target_data->>'id')::UUID, new_record.tenant_id, target_data;
                
            WHEN 'delete' THEN
                -- Delete related records
                EXECUTE format(
                    'DELETE FROM %I WHERE %s = $1 AND tenant_id = $2',
                    target_table,
                    COALESCE(action->>'linkField', 'id')
                ) USING new_record.id, new_record.tenant_id;
        END CASE;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    -- Log error to sync log
    UPDATE form_sync_logs
    SET errors = array_append(errors, format('Action error: %s', SQLERRM))
    WHERE id = sync_log_id;
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Specific sync trigger for leads table
CREATE TRIGGER sync_leads_data_trigger
    AFTER INSERT OR UPDATE ON leads
    FOR EACH ROW
    WHEN (pg_trigger_depth() < 1)
    EXECUTE FUNCTION sync_form_data_enhanced('lead-creation');

-- Specific sync trigger for estimates table
CREATE TRIGGER sync_estimates_data_trigger
    AFTER INSERT OR UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data_enhanced('estimate-creation');

-- Specific sync trigger for jobs table
CREATE TRIGGER sync_jobs_data_trigger
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data_enhanced('job-creation');

-- Specific sync trigger for contacts table
CREATE TRIGGER sync_contacts_data_trigger
    AFTER INSERT OR UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data_enhanced('contact-form');

-- Specific sync trigger for accounts table
CREATE TRIGGER sync_accounts_data_trigger
    AFTER INSERT OR UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data_enhanced('account-form');

-- Specific sync trigger for invoices table
CREATE TRIGGER sync_invoices_data_trigger
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION sync_form_data_enhanced('invoice-creation');

-- Lead to Contact/Account sync trigger
CREATE OR REPLACE FUNCTION sync_lead_to_contact_account()
RETURNS TRIGGER AS $$
DECLARE
    contact_id UUID;
    account_id UUID;
BEGIN
    -- Only process if lead has contact info
    IF NEW.name IS NOT NULL AND NEW.phone IS NOT NULL THEN
        -- Check if we need to create/update contact or account
        IF NEW.contact_type = 'residential' OR NEW.contact_type IS NULL THEN
            -- Upsert contact
            INSERT INTO contacts (
                tenant_id,
                first_name,
                last_name,
                phone,
                email,
                address,
                city,
                state,
                zip,
                created_at,
                updated_at
            ) VALUES (
                NEW.tenant_id,
                split_part(NEW.name, ' ', 1),
                CASE 
                    WHEN array_length(string_to_array(NEW.name, ' '), 1) > 1 
                    THEN array_to_string(ARRAY(SELECT unnest(string_to_array(NEW.name, ' ')) OFFSET 1), ' ')
                    ELSE ''
                END,
                NEW.phone,
                NEW.email,
                COALESCE(NEW.full_address, NEW.street_address),
                NEW.city,
                NEW.state,
                NEW.zip_code,
                NOW(),
                NOW()
            )
            ON CONFLICT (tenant_id, phone) 
            DO UPDATE SET
                email = COALESCE(EXCLUDED.email, contacts.email),
                address = COALESCE(EXCLUDED.address, contacts.address),
                city = COALESCE(EXCLUDED.city, contacts.city),
                state = COALESCE(EXCLUDED.state, contacts.state),
                zip = COALESCE(EXCLUDED.zip, contacts.zip),
                updated_at = NOW()
            RETURNING id INTO contact_id;
            
            -- Update lead with contact_id
            UPDATE leads SET contact_id = contact_id WHERE id = NEW.id;
            
        ELSIF NEW.contact_type = 'business' THEN
            -- Upsert account
            INSERT INTO accounts (
                tenant_id,
                name,
                phone,
                email,
                billing_address,
                billing_city,
                billing_state,
                billing_zip,
                created_at,
                updated_at
            ) VALUES (
                NEW.tenant_id,
                NEW.company_name,
                NEW.phone,
                NEW.email,
                COALESCE(NEW.full_address, NEW.street_address),
                NEW.city,
                NEW.state,
                NEW.zip_code,
                NOW(),
                NOW()
            )
            ON CONFLICT (tenant_id, name) 
            DO UPDATE SET
                phone = COALESCE(EXCLUDED.phone, accounts.phone),
                email = COALESCE(EXCLUDED.email, accounts.email),
                billing_address = COALESCE(EXCLUDED.billing_address, accounts.billing_address),
                billing_city = COALESCE(EXCLUDED.billing_city, accounts.billing_city),
                billing_state = COALESCE(EXCLUDED.billing_state, accounts.billing_state),
                billing_zip = COALESCE(EXCLUDED.billing_zip, accounts.billing_zip),
                updated_at = NOW()
            RETURNING id INTO account_id;
            
            -- Update lead with account_id
            UPDATE leads SET account_id = account_id WHERE id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_lead_contacts_accounts
    AFTER INSERT OR UPDATE OF name, phone, email, contact_type, company_name
    ON leads
    FOR EACH ROW
    WHEN (pg_trigger_depth() < 1)
    EXECUTE FUNCTION sync_lead_to_contact_account();

-- Estimate to Job auto-conversion trigger
CREATE OR REPLACE FUNCTION auto_convert_estimate_to_job()
RETURNS TRIGGER AS $$
DECLARE
    job_id UUID;
BEGIN
    -- Only process if estimate is approved and no job exists
    IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.job_id IS NULL THEN
        -- Create job from estimate
        INSERT INTO jobs (
            tenant_id,
            title,
            description,
            customer_id,
            contact_id,
            account_id,
            estimate_id,
            status,
            priority,
            scheduled_start,
            scheduled_end,
            job_value,
            created_at,
            updated_at
        )
        SELECT
            tenant_id,
            COALESCE(title, 'Job from Estimate #' || number),
            description,
            lead_id,
            (SELECT contact_id FROM leads WHERE id = NEW.lead_id),
            (SELECT account_id FROM leads WHERE id = NEW.lead_id),
            NEW.id,
            'scheduled',
            'medium',
            COALESCE(NEW.proposed_start_date, CURRENT_DATE + INTERVAL '7 days'),
            COALESCE(NEW.proposed_end_date, NEW.proposed_start_date + INTERVAL '1 day'),
            NEW.total,
            NOW(),
            NOW()
        FROM estimates
        WHERE id = NEW.id
        RETURNING id INTO job_id;
        
        -- Update estimate with job reference
        UPDATE estimates SET job_id = job_id WHERE id = NEW.id;
        
        -- Create calendar event for the job
        INSERT INTO calendar_events (
            tenant_id,
            title,
            description,
            start_time,
            end_time,
            event_type,
            related_to,
            related_id,
            status,
            created_at
        ) VALUES (
            NEW.tenant_id,
            'Job: ' || (SELECT title FROM jobs WHERE id = job_id),
            'Auto-created from approved estimate',
            (SELECT scheduled_start FROM jobs WHERE id = job_id),
            (SELECT scheduled_end FROM jobs WHERE id = job_id),
            'job',
            'jobs',
            job_id,
            'scheduled',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_convert_estimate_trigger
    AFTER UPDATE OF status
    ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION auto_convert_estimate_to_job();

-- Job completion to invoice trigger
CREATE OR REPLACE FUNCTION auto_create_invoice_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    invoice_id UUID;
BEGIN
    -- Only process if job is completed and no invoice exists
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Check if invoice already exists
        IF NOT EXISTS (
            SELECT 1 FROM invoices 
            WHERE job_id = NEW.id 
            AND tenant_id = NEW.tenant_id
        ) THEN
            -- Create invoice from job
            INSERT INTO invoices (
                tenant_id,
                job_id,
                customer_id,
                invoice_number,
                status,
                issue_date,
                due_date,
                subtotal,
                tax_rate,
                tax_amount,
                total,
                created_at,
                updated_at
            ) VALUES (
                NEW.tenant_id,
                NEW.id,
                NEW.customer_id,
                'INV-' || to_char(NOW(), 'YYYYMMDD') || '-' || substring(gen_random_uuid()::text, 1, 6),
                'draft',
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '30 days',
                COALESCE(NEW.job_value, 0),
                0.0875, -- Default 8.75% tax
                COALESCE(NEW.job_value * 0.0875, 0),
                COALESCE(NEW.job_value * 1.0875, 0),
                NOW(),
                NOW()
            ) RETURNING id INTO invoice_id;
            
            -- Copy line items from estimate if available
            IF NEW.estimate_id IS NOT NULL THEN
                INSERT INTO invoice_items (
                    tenant_id,
                    invoice_id,
                    description,
                    quantity,
                    unit_price,
                    total,
                    created_at
                )
                SELECT
                    tenant_id,
                    invoice_id,
                    description,
                    quantity,
                    unit_price,
                    total,
                    NOW()
                FROM estimate_items
                WHERE estimate_id = NEW.estimate_id
                AND tenant_id = NEW.tenant_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_invoice_trigger
    AFTER UPDATE OF status
    ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_invoice_on_completion();

-- Create index to improve sync performance
CREATE INDEX IF NOT EXISTS idx_leads_contact_account ON leads(contact_id, account_id);
CREATE INDEX IF NOT EXISTS idx_estimates_job_id ON estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_estimate_id ON jobs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);

-- Add default sync rules for common workflows
INSERT INTO form_sync_rules (tenant_id, rule_name, source_form_id, trigger_event, conditions, actions, priority, is_active)
SELECT 
    t.id,
    'Lead to Calendar Event',
    'lead-creation',
    'create',
    '[{"field": "site_visit_date", "operator": "not_null"}]'::JSONB,
    '[{
        "type": "create",
        "targetTable": "calendar_events",
        "fieldMappings": [
            {"sourceField": "name", "targetField": "title"},
            {"sourceField": "site_visit_date", "targetField": "start_time"},
            {"sourceField": "site_visit_date", "targetField": "end_time"},
            {"sourceField": "full_address", "targetField": "location"},
            {"sourceField": "id", "targetField": "related_id"}
        ]
    }]'::JSONB,
    100,
    TRUE
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM form_sync_rules 
    WHERE tenant_id = t.id 
    AND rule_name = 'Lead to Calendar Event'
);

-- Add more default rules as needed...

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_form_data_enhanced() TO authenticated;
GRANT EXECUTE ON FUNCTION process_sync_actions_enhanced(JSONB, RECORD, RECORD, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_lead_to_contact_account() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_convert_estimate_to_job() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_invoice_on_completion() TO authenticated;