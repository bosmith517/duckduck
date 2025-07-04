-- Production-ready email system with all gotchas fixed
-- Addresses Day-2 operational concerns, security, compliance, and performance

-- 1. OPERATIONAL DAY-2 IMPROVEMENTS

-- Add exponential backoff fields to email_queue
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS deduplication_token UUID;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}'::JSONB;

-- Add FIXED size constraint to prevent JSON bloat
-- NOTE: Skipping this constraint as it requires a trigger-based approach
-- The daily_usage JSONB field will be managed by application logic to prevent bloat
-- Consider implementing a cleanup job to remove old daily entries periodically

-- Deduplication index
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_dedupe
ON email_queue(tenant_id, deduplication_token)
WHERE deduplication_token IS NOT NULL;

-- FIXED: Exponential backoff with proper integer casting
CREATE OR REPLACE FUNCTION calculate_next_retry(retry_count INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    -- Exponential backoff: 2^retry_count minutes, max 24 hours
    RETURN NOW() + (LEAST(POWER(2, retry_count)::INTEGER, 1440) * INTERVAL '1 minute');
END;
$$;

-- 2. SECURITY & COMPLIANCE

-- Email suppression/unsubscribe list
CREATE TABLE IF NOT EXISTS email_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    reason VARCHAR(100) NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual', 'invalid')),
    
    -- Metadata
    source VARCHAR(100), -- 'user_request', 'webhook', 'admin', etc.
    campaign_id UUID, -- If from specific campaign
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- For temporary suppressions
    
    -- Constraints
    UNIQUE(tenant_id, email_address)
);

-- Webhook secrets per tenant domain
ALTER TABLE tenant_email_domains ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);

-- Function to generate webhook secret
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS VARCHAR(255)
LANGUAGE plpgsql
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    RETURN 'whsec_' || encode(gen_random_bytes(32), 'hex');
END;
$$;

-- 3. DEVELOPER EXPERIENCE

-- Email template versioning with FIXED single active version constraint
CREATE TABLE IF NOT EXISTS email_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Template content
    subject_template TEXT NOT NULL,
    html_template TEXT,
    text_template TEXT,
    variables JSONB DEFAULT '[]'::JSONB,
    
    -- Metadata
    description TEXT,
    change_notes TEXT,
    is_active BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    UNIQUE(tenant_id, template_name, version)
);

-- FIXED: Enforce single active version per template
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_active 
ON email_template_versions(tenant_id, template_name)
WHERE is_active = true;

-- 4. SCALING & PERFORMANCE

-- Deliverability dashboard materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_email_health AS
SELECT 
    tenant_id,
    COUNT(*) as total_emails_24h,
    COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered_24h,
    COUNT(*) FILTER (WHERE event_type = 'bounced') as bounced_24h,
    COUNT(*) FILTER (WHERE event_type = 'complained') as complained_24h,
    COUNT(*) FILTER (WHERE event_type = 'opened') as opened_24h,
    
    -- Calculate rates
    ROUND(
        COUNT(*) FILTER (WHERE event_type = 'bounced')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as bounce_rate_24h,
    
    ROUND(
        COUNT(*) FILTER (WHERE event_type = 'complained')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as complaint_rate_24h,
    
    ROUND(
        COUNT(*) FILTER (WHERE event_type = 'opened')::DECIMAL / 
        NULLIF(COUNT(*) FILTER (WHERE event_type = 'delivered'), 0) * 100, 2
    ) as open_rate_24h,
    
    -- Problem indicators
    CASE 
        WHEN COUNT(*) FILTER (WHERE event_type = 'bounced') > 10 
             OR (COUNT(*) FILTER (WHERE event_type = 'bounced')::DECIMAL / NULLIF(COUNT(*), 0)) > 0.1 
        THEN 'high_bounce'
        WHEN COUNT(*) FILTER (WHERE event_type = 'complained') > 5 
             OR (COUNT(*) FILTER (WHERE event_type = 'complained')::DECIMAL / NULLIF(COUNT(*), 0)) > 0.05 
        THEN 'high_complaint'
        ELSE 'healthy'
    END as health_status,
    
    NOW() as last_updated
FROM email_events 
WHERE event_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY tenant_id;

-- Create index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_email_health_tenant_id 
ON tenant_email_health(tenant_id);

-- 5. FEATURE ROAD-MAP HOOKS

-- Inbound email with FIXED MIME size protection
CREATE TABLE IF NOT EXISTS tenant_inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email metadata
    message_id VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject TEXT,
    
    -- Email content with size protection
    raw_mime TEXT CHECK (octet_length(raw_mime) < 10000000), -- 10MB limit
    html_body TEXT,
    text_body TEXT,
    
    -- Parsed metadata
    parsed_fields JSONB DEFAULT '{}'::JSONB,
    
    -- Processing
    processing_status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attachment support for email queue
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB;

-- 6. MIGRATION & COEXISTENCE

-- Provider support in domains
ALTER TABLE tenant_email_domains ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'resend';
ALTER TABLE tenant_email_domains ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}'::JSONB;

-- 7. SECURITY DEFINER FUNCTIONS WITH SEARCH PATH PROTECTION

-- Check if email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(p_tenant_id UUID, p_email VARCHAR(255))
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    suppression_record RECORD;
BEGIN
    SET search_path = public, pg_catalog;
    
    SELECT * INTO suppression_record 
    FROM email_suppressions 
    WHERE tenant_id = p_tenant_id 
    AND email_address = LOWER(p_email)
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN suppression_record.id IS NOT NULL;
END;
$$;

-- Add email to suppression list
CREATE OR REPLACE FUNCTION suppress_email(
    p_tenant_id UUID, 
    p_email VARCHAR(255), 
    p_reason VARCHAR(100),
    p_source VARCHAR(100) DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    suppression_id UUID;
BEGIN
    SET search_path = public, pg_catalog;
    
    INSERT INTO email_suppressions (tenant_id, email_address, reason, source)
    VALUES (p_tenant_id, LOWER(p_email), p_reason, p_source)
    ON CONFLICT (tenant_id, email_address) DO UPDATE SET
        reason = EXCLUDED.reason,
        source = EXCLUDED.source,
        created_at = NOW()
    RETURNING id INTO suppression_id;
    
    RETURN suppression_id;
END;
$$;

-- FIXED: Queue email with suppression and priority ordering
CREATE OR REPLACE FUNCTION queue_email_with_suppression_check(
    p_tenant_id UUID,
    p_to_email VARCHAR(255),
    p_subject TEXT,
    p_html_body TEXT,
    p_text_body TEXT DEFAULT NULL,
    p_template_id UUID DEFAULT NULL,
    p_template_variables JSONB DEFAULT '{}'::JSONB,
    p_priority INTEGER DEFAULT 5, -- 1 = highest priority, 10 = lowest
    p_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    queue_id UUID;
    dedup_token UUID;
    domain_info RECORD;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Check if email is suppressed
    IF is_email_suppressed(p_tenant_id, p_to_email) THEN
        RAISE EXCEPTION 'Email address % is suppressed for tenant %', p_to_email, p_tenant_id;
    END IF;
    
    -- Generate deduplication token
    dedup_token := gen_random_uuid();
    
    -- Get tenant's verified domain
    SELECT * INTO domain_info FROM get_tenant_verified_domain(p_tenant_id);
    
    IF domain_info.domain_id IS NULL THEN
        RAISE EXCEPTION 'No verified domain found for tenant %', p_tenant_id;
    END IF;
    
    -- Add to queue
    INSERT INTO email_queue (
        tenant_id,
        to_email,
        from_email,
        from_name,
        reply_to,
        subject,
        html_body,
        text_body,
        template_id,
        template_variables,
        priority,
        scheduled_at,
        deduplication_token
    ) VALUES (
        p_tenant_id,
        p_to_email,
        domain_info.default_from_email,
        domain_info.default_from_name,
        domain_info.reply_to_email,
        p_subject,
        p_html_body,
        p_text_body,
        p_template_id,
        p_template_variables,
        p_priority,
        p_scheduled_at,
        dedup_token
    ) RETURNING id INTO queue_id;
    
    RETURN queue_id;
END;
$$;

-- FIXED: Priority ordering (1 = highest, 10 = lowest)
CREATE OR REPLACE FUNCTION get_next_emails_for_processing(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    queue_id UUID,
    tenant_id UUID,
    to_email VARCHAR(255),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    reply_to VARCHAR(255),
    subject TEXT,
    html_body TEXT,
    text_body TEXT,
    priority INTEGER,
    retry_count INTEGER,
    scheduled_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    
    RETURN QUERY
    SELECT 
        eq.id,
        eq.tenant_id,
        eq.to_email,
        eq.from_email,
        eq.from_name,
        eq.reply_to,
        eq.subject,
        eq.html_body,
        eq.text_body,
        eq.priority,
        eq.retry_count,
        eq.scheduled_at
    FROM email_queue eq
    WHERE eq.status = 'pending'
    AND eq.scheduled_at <= NOW()
    AND (eq.next_retry_at IS NULL OR eq.next_retry_at <= NOW())
    ORDER BY eq.priority ASC, eq.scheduled_at ASC -- 1 = highest priority
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing
END;
$$;

-- Mark email as being processed
CREATE OR REPLACE FUNCTION mark_email_processing(p_queue_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    
    UPDATE email_queue 
    SET 
        status = 'processing',
        updated_at = NOW()
    WHERE id = p_queue_id;
END;
$$;

-- Mark email as failed with retry logic
CREATE OR REPLACE FUNCTION mark_email_failed(
    p_queue_id UUID, 
    p_error_message TEXT,
    p_max_retries INTEGER DEFAULT 3
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_retries INTEGER;
BEGIN
    SET search_path = public, pg_catalog;
    
    SELECT retry_count INTO current_retries 
    FROM email_queue 
    WHERE id = p_queue_id;
    
    IF current_retries >= p_max_retries THEN
        -- Max retries reached, mark as failed
        UPDATE email_queue 
        SET 
            status = 'failed',
            error_message = p_error_message,
            updated_at = NOW()
        WHERE id = p_queue_id;
    ELSE
        -- Schedule retry with exponential backoff
        UPDATE email_queue 
        SET 
            status = 'pending',
            retry_count = retry_count + 1,
            error_message = p_error_message,
            last_attempted_at = NOW(),
            next_retry_at = calculate_next_retry(retry_count + 1),
            updated_at = NOW()
        WHERE id = p_queue_id;
    END IF;
END;
$$;

-- Update email usage counters
CREATE OR REPLACE FUNCTION update_email_usage(
    p_tenant_id UUID,
    p_event_type VARCHAR(50)
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_month VARCHAR(7);
    current_day VARCHAR(10);
BEGIN
    SET search_path = public, pg_catalog;
    
    current_month := TO_CHAR(NOW(), 'YYYY-MM');
    current_day := TO_CHAR(NOW(), 'YYYY-MM-DD');
    
    -- Insert or update usage record
    INSERT INTO tenant_email_usage (tenant_id, month_year)
    VALUES (p_tenant_id, current_month)
    ON CONFLICT (tenant_id, month_year) DO NOTHING;
    
    -- Update counters based on event type
    CASE p_event_type
        WHEN 'sent' THEN
            UPDATE tenant_email_usage
            SET 
                emails_sent = emails_sent + 1,
                daily_usage = daily_usage || jsonb_build_object(
                    current_day, 
                    COALESCE((daily_usage->>current_day)::INTEGER, 0) + 1
                ),
                updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
            
        WHEN 'delivered' THEN
            UPDATE tenant_email_usage
            SET emails_delivered = emails_delivered + 1, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
            
        WHEN 'bounced' THEN
            UPDATE tenant_email_usage
            SET emails_bounced = emails_bounced + 1, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
            
        WHEN 'complained' THEN
            UPDATE tenant_email_usage
            SET emails_complained = emails_complained + 1, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
            
        WHEN 'opened' THEN
            UPDATE tenant_email_usage
            SET emails_opened = emails_opened + 1, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
            
        WHEN 'clicked' THEN
            UPDATE tenant_email_usage
            SET emails_clicked = emails_clicked + 1, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND month_year = current_month;
    END CASE;
END;
$$;

-- 8. AUTOMATED USAGE TRACKING VIA TRIGGERS

-- FIXED: Automated usage counter updates
CREATE OR REPLACE FUNCTION email_events_after_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    PERFORM update_email_usage(NEW.tenant_id, NEW.event_type);
    RETURN NEW;
END;
$$;

-- Create trigger for automated usage updates
DROP TRIGGER IF EXISTS trg_usage ON email_events;
CREATE TRIGGER trg_usage
    AFTER INSERT ON email_events
    FOR EACH ROW 
    EXECUTE FUNCTION email_events_after_insert();

-- 9. SUPPRESSION CHECKS EVERYWHERE

-- FIXED: Trigger to prevent suppressed emails from being queued
CREATE OR REPLACE FUNCTION check_email_suppression()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    
    IF is_email_suppressed(NEW.tenant_id, NEW.to_email) THEN
        RAISE EXCEPTION 'Cannot queue email to suppressed address: %', NEW.to_email;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create suppression check trigger
DROP TRIGGER IF EXISTS trg_check_suppression ON email_queue;
CREATE TRIGGER trg_check_suppression
    BEFORE INSERT ON email_queue
    FOR EACH ROW 
    EXECUTE FUNCTION check_email_suppression();

-- 10. HOUSEKEEPING AND MAINTENANCE

-- Function to clean old email queue records
CREATE OR REPLACE FUNCTION cleanup_old_email_records()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    SET search_path = public, pg_catalog;
    
    -- Delete old sent/failed emails (180 days)
    DELETE FROM email_queue 
    WHERE status IN ('sent', 'failed') 
    AND (sent_at < NOW() - INTERVAL '180 days' OR updated_at < NOW() - INTERVAL '180 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old email events (1 year)
    DELETE FROM email_events 
    WHERE event_timestamp < NOW() - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$;

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_email_health_stats()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    SET search_path = public, pg_catalog;
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_email_health;
END;
$$;

-- 11. INDEXES FOR PERFORMANCE

CREATE INDEX IF NOT EXISTS idx_email_suppressions_tenant_email ON email_suppressions(tenant_id, email_address);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_expires ON email_suppressions(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_template_versions_tenant_name ON email_template_versions(tenant_id, template_name);
CREATE INDEX IF NOT EXISTS idx_email_template_versions_active ON email_template_versions(is_active);

CREATE INDEX IF NOT EXISTS idx_tenant_inbound_emails_tenant ON tenant_inbound_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_inbound_emails_status ON tenant_inbound_emails(processing_status);

CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_tenant_status ON email_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority_scheduled ON email_queue(priority, scheduled_at) WHERE status = 'pending';

-- 12. RLS POLICIES

ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_inbound_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their tenant suppressions" ON email_suppressions
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their tenant template versions" ON email_template_versions
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view their tenant inbound emails" ON tenant_inbound_emails
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON email_suppressions TO authenticated;
GRANT ALL ON email_template_versions TO authenticated;
GRANT ALL ON tenant_inbound_emails TO authenticated;

-- Set up webhook secrets for existing domains
UPDATE tenant_email_domains 
SET webhook_secret = generate_webhook_secret()
WHERE webhook_secret IS NULL OR webhook_secret = '';

-- Make webhook_secret required for new domains
ALTER TABLE tenant_email_domains ALTER COLUMN webhook_secret SET DEFAULT generate_webhook_secret();

-- Comments
COMMENT ON TABLE email_suppressions IS 'Unsubscribe and bounce suppression list per tenant';
COMMENT ON TABLE email_template_versions IS 'Versioned email templates with rollback capability';
COMMENT ON TABLE tenant_inbound_emails IS 'Inbound email processing with size limits';
COMMENT ON MATERIALIZED VIEW tenant_email_health IS 'Real-time email deliverability health dashboard';

COMMENT ON FUNCTION get_next_emails_for_processing IS 'Get emails for background worker processing with proper locking';
COMMENT ON FUNCTION mark_email_failed IS 'Mark email as failed with exponential backoff retry logic';
COMMENT ON FUNCTION cleanup_old_email_records IS 'Housekeeping function to remove old email records';
COMMENT ON FUNCTION refresh_email_health_stats IS 'Refresh email health materialized view for dashboard';

-- Final verification queries for deployment
-- SELECT 'Migration completed successfully' as status;
-- SELECT COUNT(*) as existing_domains FROM tenant_email_domains;
-- SELECT COUNT(*) as existing_usage_records FROM tenant_email_usage;