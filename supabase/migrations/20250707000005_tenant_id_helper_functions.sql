-- Helper functions to maintain tenant_id consistency across related records

-- 1. Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant_id found for current user';
    END IF;
    
    RETURN v_tenant_id;
END;
$$;

-- 2. Function to validate tenant_id matches current user's tenant
CREATE OR REPLACE FUNCTION validate_tenant_id(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_tenant_id UUID;
BEGIN
    -- Get current user's tenant_id
    SELECT tenant_id INTO v_user_tenant_id
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Return true if they match
    RETURN v_user_tenant_id = p_tenant_id;
END;
$$;

-- 3. Function to validate cross-table tenant consistency
CREATE OR REPLACE FUNCTION validate_cross_table_tenant_id(
    p_table_name TEXT,
    p_record_id UUID,
    p_expected_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_tenant_id UUID;
    v_query TEXT;
BEGIN
    -- Build dynamic query to get tenant_id from specified table
    v_query := format('SELECT tenant_id FROM %I WHERE id = $1', p_table_name);
    
    -- Execute query
    EXECUTE v_query INTO v_actual_tenant_id USING p_record_id;
    
    -- Return true if tenant_ids match
    RETURN v_actual_tenant_id = p_expected_tenant_id;
END;
$$;

-- 4. Trigger function to validate tenant_id consistency on foreign key references
CREATE OR REPLACE FUNCTION validate_tenant_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ref_tenant_id UUID;
BEGIN
    -- Check various foreign key relationships based on table
    CASE TG_TABLE_NAME
        WHEN 'contacts' THEN
            -- If account_id is set, ensure it belongs to same tenant
            IF NEW.account_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM accounts
                WHERE id = NEW.account_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Account belongs to different tenant';
                END IF;
            END IF;
            
        WHEN 'jobs' THEN
            -- Check contact tenant_id
            IF NEW.contact_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM contacts
                WHERE id = NEW.contact_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Contact belongs to different tenant';
                END IF;
            END IF;
            
            -- Check account tenant_id
            IF NEW.account_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM accounts
                WHERE id = NEW.account_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Account belongs to different tenant';
                END IF;
            END IF;
            
        WHEN 'estimates' THEN
            -- Check job tenant_id
            IF NEW.job_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM jobs
                WHERE id = NEW.job_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Job belongs to different tenant';
                END IF;
            END IF;
            
        WHEN 'invoices' THEN
            -- Check job tenant_id
            IF NEW.job_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM jobs
                WHERE id = NEW.job_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Job belongs to different tenant';
                END IF;
            END IF;
            
            -- Check account tenant_id
            IF NEW.account_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM accounts
                WHERE id = NEW.account_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Account belongs to different tenant';
                END IF;
            END IF;
            
        WHEN 'job_documents' THEN
            -- Check job tenant_id
            IF NEW.job_id IS NOT NULL THEN
                SELECT tenant_id INTO v_ref_tenant_id
                FROM jobs
                WHERE id = NEW.job_id;
                
                IF v_ref_tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Job belongs to different tenant';
                END IF;
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$;

-- 5. Add validation triggers to key tables
DO $$
BEGIN
    -- Add triggers only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_tenant_reference_trigger' AND tgrelid = 'contacts'::regclass) THEN
        CREATE TRIGGER validate_tenant_reference_trigger
        BEFORE INSERT OR UPDATE ON contacts
        FOR EACH ROW
        EXECUTE FUNCTION validate_tenant_reference();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_tenant_reference_trigger' AND tgrelid = 'jobs'::regclass) THEN
        CREATE TRIGGER validate_tenant_reference_trigger
        BEFORE INSERT OR UPDATE ON jobs
        FOR EACH ROW
        EXECUTE FUNCTION validate_tenant_reference();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_tenant_reference_trigger' AND tgrelid = 'estimates'::regclass) THEN
        CREATE TRIGGER validate_tenant_reference_trigger
        BEFORE INSERT OR UPDATE ON estimates
        FOR EACH ROW
        EXECUTE FUNCTION validate_tenant_reference();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_tenant_reference_trigger' AND tgrelid = 'invoices'::regclass) THEN
        CREATE TRIGGER validate_tenant_reference_trigger
        BEFORE INSERT OR UPDATE ON invoices
        FOR EACH ROW
        EXECUTE FUNCTION validate_tenant_reference();
    END IF;
    
    -- Note: job_documents table trigger will be added when that table is created
    -- in its own migration file
END $$;

-- 6. Function to safely copy data between tenants (for admin use)
CREATE OR REPLACE FUNCTION copy_record_to_tenant(
    p_source_table TEXT,
    p_source_id UUID,
    p_target_tenant_id UUID,
    p_update_references BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
    v_columns TEXT;
    v_query TEXT;
BEGIN
    -- This function should only be used by super admins
    -- Add appropriate permission checks here
    
    -- Generate new UUID for the copy
    v_new_id := gen_random_uuid();
    
    -- Get column names excluding 'id' and 'tenant_id'
    SELECT string_agg(column_name, ', ')
    INTO v_columns
    FROM information_schema.columns
    WHERE table_name = p_source_table
    AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at')
    AND table_schema = 'public';
    
    -- Build and execute copy query
    v_query := format(
        'INSERT INTO %I (id, tenant_id, %s, created_at, updated_at) 
         SELECT $1, $2, %s, NOW(), NOW() 
         FROM %I 
         WHERE id = $3',
        p_source_table, v_columns, v_columns, p_source_table
    );
    
    EXECUTE v_query USING v_new_id, p_target_tenant_id, p_source_id;
    
    -- Log the copy operation
    INSERT INTO tenant_id_audit_log (
        table_name, 
        record_id, 
        issue_type, 
        details
    ) VALUES (
        p_source_table,
        v_new_id,
        'cross_tenant_copy',
        jsonb_build_object(
            'source_id', p_source_id,
            'target_tenant_id', p_target_tenant_id,
            'copied_at', NOW()
        )
    );
    
    RETURN v_new_id;
END;
$$;

-- 7. Function to fix orphaned records (admin use)
CREATE OR REPLACE FUNCTION fix_orphaned_tenant_records(
    p_table_name TEXT,
    p_default_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_query TEXT;
BEGIN
    -- Update records with NULL tenant_id to use default tenant
    v_query := format(
        'UPDATE %I SET tenant_id = $1 WHERE tenant_id IS NULL',
        p_table_name
    );
    
    EXECUTE v_query USING p_default_tenant_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log the fix
    IF v_count > 0 THEN
        INSERT INTO tenant_id_audit_log (
            table_name,
            record_id,
            issue_type,
            details,
            resolved
        ) VALUES (
            p_table_name,
            p_default_tenant_id,
            'fixed_null_tenant_ids',
            jsonb_build_object(
                'count', v_count,
                'default_tenant_id', p_default_tenant_id
            ),
            TRUE
        );
    END IF;
    
    RETURN v_count;
END;
$$;

-- 8. Add helpful comments
COMMENT ON FUNCTION get_current_tenant_id() IS 'Returns the tenant_id for the current authenticated user';
COMMENT ON FUNCTION validate_tenant_id(UUID) IS 'Validates that the provided tenant_id matches the current user tenant';
COMMENT ON FUNCTION validate_cross_table_tenant_id(TEXT, UUID, UUID) IS 'Validates tenant_id consistency across related tables';
COMMENT ON FUNCTION validate_tenant_reference() IS 'Trigger function to ensure foreign key references are within the same tenant';
COMMENT ON FUNCTION copy_record_to_tenant(TEXT, UUID, UUID, BOOLEAN) IS 'Admin function to safely copy records between tenants';
COMMENT ON FUNCTION fix_orphaned_tenant_records(TEXT, UUID) IS 'Admin function to fix records with NULL tenant_id';

-- 9. Create a comprehensive tenant health check function
CREATE OR REPLACE FUNCTION check_tenant_health(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If no tenant specified, use current user's tenant
    IF p_tenant_id IS NULL THEN
        p_tenant_id := get_current_tenant_id();
    END IF;
    
    -- Check if tenant exists
    RETURN QUERY
    SELECT 
        'tenant_exists'::TEXT,
        CASE WHEN EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) 
             THEN 'pass'::TEXT 
             ELSE 'fail'::TEXT 
        END,
        jsonb_build_object('tenant_id', p_tenant_id);
    
    -- Check user count
    RETURN QUERY
    SELECT 
        'user_count'::TEXT,
        'info'::TEXT,
        jsonb_build_object(
            'count', (SELECT COUNT(*) FROM user_profiles WHERE tenant_id = p_tenant_id),
            'active', (SELECT COUNT(*) FROM user_profiles WHERE tenant_id = p_tenant_id AND is_active = true)
        );
    
    -- Check for orphaned records
    RETURN QUERY
    SELECT 
        'orphaned_contacts'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'pass'::TEXT ELSE 'fail'::TEXT END,
        jsonb_build_object('count', COUNT(*))
    FROM contacts
    WHERE account_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM accounts 
        WHERE id = contacts.account_id 
        AND tenant_id = contacts.tenant_id
    )
    AND tenant_id = p_tenant_id;
    
    -- Check data distribution
    RETURN QUERY
    SELECT 
        'data_distribution'::TEXT,
        'info'::TEXT,
        jsonb_build_object(
            'leads', (SELECT COUNT(*) FROM leads WHERE tenant_id = p_tenant_id),
            'contacts', (SELECT COUNT(*) FROM contacts WHERE tenant_id = p_tenant_id),
            'accounts', (SELECT COUNT(*) FROM accounts WHERE tenant_id = p_tenant_id),
            'jobs', (SELECT COUNT(*) FROM jobs WHERE tenant_id = p_tenant_id),
            'invoices', (SELECT COUNT(*) FROM invoices WHERE tenant_id = p_tenant_id)
        );
END;
$$;

COMMENT ON FUNCTION check_tenant_health(UUID) IS 'Comprehensive health check for a tenant data integrity';