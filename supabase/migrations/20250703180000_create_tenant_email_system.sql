-- Multi-tenant email system with single Resend account
-- Each tenant gets their own verified domain under one Resend account

-- Tenant email domains table
CREATE TABLE IF NOT EXISTS tenant_email_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Domain information
    domain_name VARCHAR(255) NOT NULL,
    resend_domain_id VARCHAR(255) UNIQUE, -- ID from Resend API
    
    -- Verification status and records
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    dns_records JSONB DEFAULT '[]'::JSONB, -- SPF, DKIM, MX records from Resend
    verification_token VARCHAR(255), -- Token for verification
    
    -- Domain settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Email sender configuration for this domain
    default_from_name VARCHAR(255) NOT NULL,
    default_from_email VARCHAR(255) NOT NULL,
    reply_to_email VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(tenant_id, domain_name)
);

-- Email usage tracking per tenant
CREATE TABLE IF NOT EXISTS tenant_email_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Time period tracking
    month_year VARCHAR(7) NOT NULL, -- Format: '2024-07'
    
    -- Usage counters
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    emails_complained INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    
    -- Plan limits (copied from tenant plan at time of creation)
    monthly_limit INTEGER DEFAULT 1000,
    daily_limit INTEGER DEFAULT 100,
    
    -- Daily breakdown (for rate limiting)
    daily_usage JSONB DEFAULT '{}'::JSONB, -- {"2024-07-01": 50, "2024-07-02": 30}
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(tenant_id, month_year)
);

-- Email events tracking (webhooks from Resend)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email identification
    resend_email_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255), -- For tracking across events
    
    -- Event details
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked')),
    
    -- Email details
    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    subject TEXT,
    
    -- Event metadata
    event_data JSONB DEFAULT '{}'::JSONB,
    bounce_reason TEXT,
    complaint_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email queue for batching/rate limiting
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email details
    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    reply_to VARCHAR(255),
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    
    -- Template information
    template_id UUID, -- Reference to notification_templates
    template_variables JSONB DEFAULT '{}'::JSONB,
    
    -- Queue status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5, -- 1-10, higher = more important
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Results
    resend_email_id VARCHAR(255),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_email_domains_tenant_id ON tenant_email_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_email_domains_status ON tenant_email_domains(status);
CREATE INDEX IF NOT EXISTS idx_tenant_email_domains_resend_id ON tenant_email_domains(resend_domain_id);

CREATE INDEX IF NOT EXISTS idx_tenant_email_usage_tenant_month ON tenant_email_usage(tenant_id, month_year);

CREATE INDEX IF NOT EXISTS idx_email_events_tenant_id ON email_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_timestamp ON email_events(event_timestamp);

CREATE INDEX IF NOT EXISTS idx_email_queue_tenant_id ON email_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON email_queue(next_retry_at);

-- Row Level Security (RLS)
ALTER TABLE tenant_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_email_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant isolation
CREATE POLICY "Users can manage their tenant email domains" ON tenant_email_domains
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view their tenant email usage" ON tenant_email_usage
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view their email events" ON email_events
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view their email queue" ON email_queue
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON tenant_email_domains TO authenticated;
GRANT SELECT ON tenant_email_usage TO authenticated;
GRANT SELECT ON email_events TO authenticated;
GRANT SELECT ON email_queue TO authenticated;

-- Functions for email system

-- Get tenant's verified domain
CREATE OR REPLACE FUNCTION get_tenant_verified_domain(p_tenant_id UUID)
RETURNS TABLE (
    domain_id UUID,
    domain_name VARCHAR(255),
    resend_domain_id VARCHAR(255),
    default_from_name VARCHAR(255),
    default_from_email VARCHAR(255),
    reply_to_email VARCHAR(255)
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ted.id,
        ted.domain_name,
        ted.resend_domain_id,
        ted.default_from_name,
        ted.default_from_email,
        ted.reply_to_email
    FROM tenant_email_domains ted
    WHERE ted.tenant_id = p_tenant_id
    AND ted.status = 'verified'
    AND ted.is_active = true
    ORDER BY ted.is_default DESC, ted.created_at ASC
    LIMIT 1;
END;
$$;

-- Check if tenant can send email (rate limiting)
CREATE OR REPLACE FUNCTION can_tenant_send_email(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_month VARCHAR(7);
    current_day VARCHAR(10);
    monthly_usage INTEGER;
    daily_usage INTEGER;
    monthly_limit INTEGER;
    daily_limit INTEGER;
    tenant_plan VARCHAR(20);
BEGIN
    current_month := TO_CHAR(NOW(), 'YYYY-MM');
    current_day := TO_CHAR(NOW(), 'YYYY-MM-DD');
    
    -- Get tenant plan for limits
    SELECT plan INTO tenant_plan FROM tenants WHERE id = p_tenant_id;
    
    -- Set limits based on plan
    CASE tenant_plan
        WHEN 'basic' THEN
            monthly_limit := 1000;
            daily_limit := 50;
        WHEN 'professional' THEN
            monthly_limit := 5000;
            daily_limit := 200;
        WHEN 'enterprise' THEN
            monthly_limit := 25000;
            daily_limit := 1000;
        ELSE
            monthly_limit := 100;
            daily_limit := 10;
    END CASE;
    
    -- Get current usage
    SELECT 
        COALESCE(emails_sent, 0),
        COALESCE((daily_usage->>current_day)::INTEGER, 0)
    INTO monthly_usage, daily_usage
    FROM tenant_email_usage
    WHERE tenant_id = p_tenant_id AND month_year = current_month;
    
    -- Check limits
    IF monthly_usage >= monthly_limit OR daily_usage >= daily_limit THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
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
    tenant_plan VARCHAR(20);
    monthly_limit INTEGER;
    daily_limit INTEGER;
BEGIN
    current_month := TO_CHAR(NOW(), 'YYYY-MM');
    current_day := TO_CHAR(NOW(), 'YYYY-MM-DD');
    
    -- Get tenant plan for limits
    SELECT plan INTO tenant_plan FROM tenants WHERE id = p_tenant_id;
    
    CASE tenant_plan
        WHEN 'basic' THEN
            monthly_limit := 1000;
            daily_limit := 50;
        WHEN 'professional' THEN
            monthly_limit := 5000;
            daily_limit := 200;
        WHEN 'enterprise' THEN
            monthly_limit := 25000;
            daily_limit := 1000;
        ELSE
            monthly_limit := 100;
            daily_limit := 10;
    END CASE;
    
    -- Insert or update usage record
    INSERT INTO tenant_email_usage (tenant_id, month_year, monthly_limit, daily_limit)
    VALUES (p_tenant_id, current_month, monthly_limit, daily_limit)
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

-- Add email to queue
CREATE OR REPLACE FUNCTION queue_email(
    p_tenant_id UUID,
    p_to_email VARCHAR(255),
    p_subject TEXT,
    p_html_body TEXT,
    p_text_body TEXT DEFAULT NULL,
    p_template_id UUID DEFAULT NULL,
    p_template_variables JSONB DEFAULT '{}'::JSONB,
    p_priority INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    queue_id UUID;
    domain_info RECORD;
BEGIN
    -- Get tenant's verified domain
    SELECT * INTO domain_info FROM get_tenant_verified_domain(p_tenant_id);
    
    IF domain_info.domain_id IS NULL THEN
        RAISE EXCEPTION 'No verified domain found for tenant %', p_tenant_id;
    END IF;
    
    -- Check if tenant can send email
    IF NOT can_tenant_send_email(p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % has exceeded email sending limits', p_tenant_id;
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
        priority
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
        p_priority
    ) RETURNING id INTO queue_id;
    
    RETURN queue_id;
END;
$$;

-- Create partial unique index for default domain constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_email_domains_default 
ON tenant_email_domains(tenant_id) 
WHERE is_default = true;

-- Comments
COMMENT ON TABLE tenant_email_domains IS 'Custom email domains per tenant verified through Resend';
COMMENT ON TABLE tenant_email_usage IS 'Email usage tracking and rate limiting per tenant';
COMMENT ON TABLE email_events IS 'Email delivery events from Resend webhooks';
COMMENT ON TABLE email_queue IS 'Email sending queue with rate limiting and retry logic';


supabase domains create --project-ref eskpnhbemnxkxafjbbdx --custom-hostname app.tradeworkspro.com