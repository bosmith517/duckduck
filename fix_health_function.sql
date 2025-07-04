-- Fix the ambiguous column reference error in get_email_system_health function

-- Drop and recreate the function with proper column qualification
DROP FUNCTION IF EXISTS get_email_system_health();

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
    FROM email_queue eq
    WHERE eq.status = 'pending'
    
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
    FROM email_queue eq
    WHERE eq.status = 'failed' 
    AND eq.updated_at > NOW() - INTERVAL '24 hours'
    
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
    FROM email_queue eq
    WHERE eq.status = 'processing' 
    AND eq.updated_at < NOW() - INTERVAL '10 minutes'
    
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
    FROM tenant_email_health teh
    WHERE teh.health_status = 'high_bounce';
END;
$$;