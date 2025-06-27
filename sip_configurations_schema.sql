-- SIP Configurations table for storing tenant phone service settings
CREATE TABLE IF NOT EXISTS sip_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- SIP Endpoint Details
    sip_username VARCHAR(100) NOT NULL UNIQUE,
    sip_password_encrypted TEXT NOT NULL, -- Encrypted password
    sip_domain VARCHAR(255) NOT NULL,
    sip_proxy VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    
    -- SignalWire Configuration
    signalwire_endpoint_id VARCHAR(100) UNIQUE,
    signalwire_project_id VARCHAR(100) NOT NULL,
    
    -- Service Status
    is_active BOOLEAN DEFAULT true,
    service_plan VARCHAR(50) DEFAULT 'basic', -- basic, professional, enterprise
    
    -- Phone Numbers associated with this SIP trunk
    primary_phone_number VARCHAR(20),
    
    -- Billing and Usage
    monthly_rate DECIMAL(10,2) DEFAULT 29.99,
    per_minute_rate DECIMAL(6,4) DEFAULT 0.02,
    included_minutes INTEGER DEFAULT 1000,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT unique_tenant_sip UNIQUE(tenant_id),
    CONSTRAINT valid_service_plan CHECK (service_plan IN ('basic', 'professional', 'enterprise'))
);

-- Phone Numbers table for SIP trunk management
CREATE TABLE IF NOT EXISTS sip_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sip_config_id UUID NOT NULL REFERENCES sip_configurations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Phone Number Details
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    country_code VARCHAR(5) NOT NULL DEFAULT '+1',
    area_code VARCHAR(10),
    number_type VARCHAR(20) DEFAULT 'local', -- local, toll-free, international
    
    -- SignalWire Details
    signalwire_number_id VARCHAR(100) UNIQUE,
    
    -- Configuration
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Features
    sms_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT true,
    fax_enabled BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_number_type CHECK (number_type IN ('local', 'toll-free', 'international'))
);

-- Call Logs table for SIP calls
CREATE TABLE IF NOT EXISTS sip_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sip_config_id UUID NOT NULL REFERENCES sip_configurations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    
    -- Call Details
    call_id VARCHAR(100) UNIQUE, -- SignalWire call ID
    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    
    -- Call Status and Timing
    call_status VARCHAR(20) NOT NULL, -- ringing, answered, busy, failed, no-answer
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    answer_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    billable_seconds INTEGER DEFAULT 0,
    
    -- Cost and Billing
    cost_per_minute DECIMAL(6,4),
    total_cost DECIMAL(8,4) DEFAULT 0.00,
    
    -- Additional Data
    caller_name VARCHAR(100),
    recording_url TEXT,
    transcription TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_direction CHECK (direction IN ('inbound', 'outbound')),
    CONSTRAINT valid_call_status CHECK (call_status IN ('ringing', 'answered', 'busy', 'failed', 'no-answer', 'cancelled'))
);

-- SIP Usage Statistics table
CREATE TABLE IF NOT EXISTS sip_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sip_config_id UUID NOT NULL REFERENCES sip_configurations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Usage Period
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    -- Usage Metrics
    total_calls INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    inbound_minutes INTEGER DEFAULT 0,
    outbound_minutes INTEGER DEFAULT 0,
    
    -- Costs
    base_monthly_cost DECIMAL(10,2) DEFAULT 0.00,
    overage_minutes INTEGER DEFAULT 0,
    overage_cost DECIMAL(10,2) DEFAULT 0.00,
    total_cost DECIMAL(10,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_tenant_period UNIQUE(tenant_id, billing_period_start, billing_period_end)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_active ON sip_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_phone_numbers_config_id ON sip_phone_numbers(sip_config_id);
CREATE INDEX IF NOT EXISTS idx_sip_phone_numbers_tenant_id ON sip_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_phone_numbers_number ON sip_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_sip_call_logs_config_id ON sip_call_logs(sip_config_id);
CREATE INDEX IF NOT EXISTS idx_sip_call_logs_tenant_id ON sip_call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_call_logs_start_time ON sip_call_logs(start_time);
CREATE INDEX IF NOT EXISTS idx_sip_usage_stats_tenant_period ON sip_usage_stats(tenant_id, billing_period_start);

-- Row Level Security (RLS) policies
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sip_configurations
CREATE POLICY "Users can view their tenant's SIP configuration" ON sip_configurations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage SIP configurations" ON sip_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND tenant_id = sip_configurations.tenant_id
            AND role IN ('admin', 'owner')
        )
    );

-- RLS Policies for sip_phone_numbers
CREATE POLICY "Users can view their tenant's phone numbers" ON sip_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage phone numbers" ON sip_phone_numbers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND tenant_id = sip_phone_numbers.tenant_id
            AND role IN ('admin', 'owner')
        )
    );

-- RLS Policies for sip_call_logs
CREATE POLICY "Users can view their tenant's call logs" ON sip_call_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "System can insert call logs" ON sip_call_logs
    FOR INSERT WITH CHECK (true); -- Allow system to insert call logs

-- RLS Policies for sip_usage_stats
CREATE POLICY "Users can view their tenant's usage stats" ON sip_usage_stats
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Functions for SIP management
CREATE OR REPLACE FUNCTION get_tenant_sip_config(tenant_uuid UUID)
RETURNS TABLE (
    config_id UUID,
    sip_username VARCHAR,
    sip_domain VARCHAR,
    sip_proxy VARCHAR,
    display_name VARCHAR,
    is_active BOOLEAN,
    service_plan VARCHAR,
    primary_phone_number VARCHAR
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.id,
        sc.sip_username,
        sc.sip_domain,
        sc.sip_proxy,
        sc.display_name,
        sc.is_active,
        sc.service_plan,
        sc.primary_phone_number
    FROM sip_configurations sc
    WHERE sc.tenant_id = tenant_uuid
    AND sc.is_active = true;
END;
$$;

-- Function to calculate monthly usage
CREATE OR REPLACE FUNCTION calculate_sip_usage(
    tenant_uuid UUID,
    period_start DATE,
    period_end DATE
)
RETURNS TABLE (
    total_calls BIGINT,
    total_minutes BIGINT,
    total_cost DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_calls,
        COALESCE(SUM(duration_seconds), 0)::BIGINT / 60 as total_minutes,
        COALESCE(SUM(total_cost), 0.00)::DECIMAL as total_cost
    FROM sip_call_logs
    WHERE tenant_id = tenant_uuid
    AND start_time >= period_start::TIMESTAMP WITH TIME ZONE
    AND start_time < (period_end + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE
    AND call_status = 'answered';
END;
$$;
