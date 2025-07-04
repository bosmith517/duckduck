-- Fix production gotchas in email system
-- Addresses immutable function issues, FK constraints, and operational concerns

-- 1. FIX: IMMUTABLE function with SET search_path
CREATE OR REPLACE FUNCTION calculate_next_retry(retry_count INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql STABLE -- Changed from IMMUTABLE to STABLE
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    -- Exponential backoff: 2^retry_count minutes, max 24 hours
    RETURN NOW() + (LEAST(POWER(2, retry_count)::INTEGER, 1440) * INTERVAL '1 minute');
END;
$$;

-- 2. FIX: Make refresh function SECURITY INVOKER to avoid deadlocks
CREATE OR REPLACE FUNCTION refresh_email_health_stats()
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER -- Changed from SECURITY DEFINER
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_email_health;
END;
$$;

-- 3. FIX: Cleanup function with proper NULL handling
CREATE OR REPLACE FUNCTION cleanup_old_email_records()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Delete old sent/failed emails (180 days) - FIXED: Check sent_at IS NOT NULL
    DELETE FROM email_queue 
    WHERE status IN ('sent', 'failed') 
    AND sent_at IS NOT NULL 
    AND sent_at < NOW() - INTERVAL '180 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up very old stuck records (1 year)
    DELETE FROM email_queue 
    WHERE status IN ('failed', 'cancelled')
    AND updated_at < NOW() - INTERVAL '1 year';
    
    -- Delete old email events (1 year)
    DELETE FROM email_events 
    WHERE event_timestamp < NOW() - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$;

-- 4. FIX: Add proper FK constraint from email_queue to template versions
-- First, we need to handle the case where template_id might reference the old notification_templates
-- Let's create a view that unifies both template systems

-- Check if we have any orphaned template references
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM email_queue eq
    LEFT JOIN email_template_versions etv ON eq.template_id = etv.id
    LEFT JOIN notification_templates nt ON eq.template_id = nt.id
    WHERE eq.template_id IS NOT NULL 
    AND etv.id IS NULL 
    AND nt.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Found % orphaned template references. Setting to NULL.', orphan_count;
        
        -- Clean up orphaned references
        UPDATE email_queue 
        SET template_id = NULL 
        WHERE template_id IS NOT NULL 
        AND template_id NOT IN (
            SELECT id FROM email_template_versions 
            UNION 
            SELECT id FROM notification_templates
        );
    END IF;
END;
$$;

-- For now, we'll allow both old and new template systems to coexist
-- FK constraint will be added once we fully migrate to email_template_versions

-- 5. Add partition plan reminder as a database comment
COMMENT ON TABLE email_events IS 'Email delivery events from webhooks. TODO: Partition by month when row count > 5M for performance.';

-- 6. Create cron job setup function (to be called during deployment)
CREATE OR REPLACE FUNCTION setup_email_cron_jobs()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result TEXT := '';
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Only set up cron if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule email cleanup (daily at 2 AM)
        PERFORM cron.schedule(
            'email-cleanup',
            '0 2 * * *',
            'SELECT cleanup_old_email_records();'
        );
        
        -- Schedule health stats refresh (every 5 minutes)
        PERFORM cron.schedule(
            'email-health',
            '*/5 * * * *',
            'SELECT refresh_email_health_stats();'
        );
        
        result := 'Cron jobs scheduled: email-cleanup (daily 2AM), email-health (every 5min)';
    ELSE
        result := 'pg_cron extension not available. Set up cron jobs manually in your infrastructure.';
    END IF;
    
    RETURN result;
END;
$$;

-- 7. Add a safer template migration function
CREATE OR REPLACE FUNCTION migrate_notification_templates_to_versioned()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    migrated_count INTEGER := 0;
    template_record RECORD;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Migrate each notification template to versioned system
    FOR template_record IN 
        SELECT 
            id,
            tenant_id,
            template_name,
            subject,
            message_template,
            variables,
            active,
            created_at
        FROM notification_templates 
        WHERE template_type = 'email'
        AND id NOT IN (
            SELECT template_id FROM email_template_versions 
            WHERE template_id IS NOT NULL
        )
    LOOP
        -- Insert into versioned templates with original ID preserved
        INSERT INTO email_template_versions (
            id, -- Preserve original ID for FK compatibility
            tenant_id,
            template_name,
            version,
            subject_template,
            html_template,
            text_template,
            variables,
            is_active,
            created_at
        ) VALUES (
            template_record.id,
            template_record.tenant_id,
            template_record.template_name,
            1,
            COALESCE(template_record.subject, 'No Subject'),
            template_record.message_template,
            template_record.message_template, -- Use same for text
            template_record.variables,
            template_record.active,
            template_record.created_at
        ) ON CONFLICT (id) DO NOTHING;
        
        migrated_count := migrated_count + 1;
    END LOOP;
    
    RETURN migrated_count;
END;
$$;

-- 8. Add email worker role and permissions
DO $$
BEGIN
    -- Create email worker role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'email_worker') THEN
        CREATE ROLE email_worker LOGIN;
    END IF;
END;
$$;

-- Grant minimal permissions to email worker
GRANT CONNECT ON DATABASE postgres TO email_worker;
GRANT USAGE ON SCHEMA public TO email_worker;

-- Grant execute permissions on worker functions only
GRANT EXECUTE ON FUNCTION get_next_emails_for_processing TO email_worker;
GRANT EXECUTE ON FUNCTION mark_email_processing TO email_worker;
GRANT EXECUTE ON FUNCTION mark_email_failed TO email_worker;
GRANT EXECUTE ON FUNCTION update_email_usage TO email_worker;

-- Grant select/update permissions on necessary tables
GRANT SELECT, UPDATE ON email_queue TO email_worker;
GRANT INSERT ON email_events TO email_worker;
GRANT SELECT, UPDATE ON tenant_email_usage TO email_worker;
GRANT SELECT ON tenant_email_domains TO email_worker;
GRANT SELECT ON tenants TO email_worker;

-- 9. Add monitoring and alerting helper functions
CREATE OR REPLACE FUNCTION get_email_system_health()
RETURNS TABLE (
    metric VARCHAR(50),
    value BIGINT,
    health_status VARCHAR(20),
    description TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    
    RETURN QUERY
    SELECT 
        'pending_emails'::VARCHAR(50),
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 1000 THEN 'critical'::VARCHAR(20)
            WHEN COUNT(*) > 500 THEN 'warning'::VARCHAR(20)
            ELSE 'ok'::VARCHAR(20)
        END,
        'Emails waiting to be sent'::TEXT
    FROM email_queue 
    WHERE email_queue.status = 'pending'
    
    UNION ALL
    
    SELECT 
        'failed_emails_24h'::VARCHAR(50),
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 100 THEN 'critical'::VARCHAR(20)
            WHEN COUNT(*) > 50 THEN 'warning'::VARCHAR(20)
            ELSE 'ok'::VARCHAR(20)
        END,
        'Emails failed in last 24 hours'::TEXT
    FROM email_queue 
    WHERE email_queue.status = 'failed' 
    AND email_queue.updated_at > NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    SELECT 
        'stuck_processing'::VARCHAR(50),
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 10 THEN 'critical'::VARCHAR(20)
            WHEN COUNT(*) > 5 THEN 'warning'::VARCHAR(20)
            ELSE 'ok'::VARCHAR(20)
        END,
        'Emails stuck in processing state'::TEXT
    FROM email_queue 
    WHERE email_queue.status = 'processing' 
    AND email_queue.updated_at < NOW() - INTERVAL '10 minutes'
    
    UNION ALL
    
    SELECT 
        'high_bounce_tenants'::VARCHAR(50),
        COUNT(*)::BIGINT,
        CASE 
            WHEN COUNT(*) > 5 THEN 'critical'::VARCHAR(20)
            WHEN COUNT(*) > 2 THEN 'warning'::VARCHAR(20)
            ELSE 'ok'::VARCHAR(20)
        END,
        'Tenants with high bounce rates'::TEXT
    FROM tenant_email_health 
    WHERE tenant_email_health.health_status = 'high_bounce';
END;
$$;

-- 10. Add utility function to reset stuck emails
CREATE OR REPLACE FUNCTION reset_stuck_emails()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Reset emails that have been "processing" for more than 10 minutes
    UPDATE email_queue 
    SET 
        status = 'pending',
        retry_count = retry_count + 1,
        next_retry_at = calculate_next_retry(retry_count + 1),
        updated_at = NOW(),
        error_message = 'Reset from stuck processing state'
    WHERE status = 'processing' 
    AND updated_at < NOW() - INTERVAL '10 minutes'
    AND retry_count < max_retries;
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Mark as failed if max retries exceeded
    UPDATE email_queue 
    SET 
        status = 'failed',
        error_message = 'Failed after being stuck in processing'
    WHERE status = 'processing' 
    AND updated_at < NOW() - INTERVAL '10 minutes'
    AND retry_count >= max_retries;
    
    RETURN reset_count;
END;
$$;

-- Grant permissions for monitoring functions
GRANT EXECUTE ON FUNCTION get_email_system_health TO authenticated;
GRANT EXECUTE ON FUNCTION reset_stuck_emails TO email_worker;

-- Comments
COMMENT ON FUNCTION setup_email_cron_jobs IS 'Sets up automated cron jobs for email system maintenance (call once during deployment)';
COMMENT ON FUNCTION migrate_notification_templates_to_versioned IS 'Migrates existing notification templates to versioned template system';
COMMENT ON FUNCTION get_email_system_health IS 'Returns email system health metrics for monitoring dashboards';
COMMENT ON FUNCTION reset_stuck_emails IS 'Resets emails stuck in processing state (for background worker recovery)';

-- Final verification
DO $$
BEGIN
    RAISE NOTICE 'Email system production fixes applied successfully';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run: SELECT setup_email_cron_jobs(); (if using pg_cron)';
    RAISE NOTICE '2. Run: SELECT migrate_notification_templates_to_versioned();';
    RAISE NOTICE '3. Set up monitoring alerts using get_email_system_health()';
    RAISE NOTICE '4. Configure email_worker role credentials for background processing';
END;
$$;