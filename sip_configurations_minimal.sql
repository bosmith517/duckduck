-- Minimal SIP Configurations table without strict foreign key constraint
-- This version uses tenant_id as a string and validates via user_profiles table

-- Drop the table if it exists to recreate without foreign key constraint
DROP TABLE IF EXISTS sip_configurations CASCADE;

-- Create SIP Configurations table for storing tenant phone service settings
CREATE TABLE IF NOT EXISTS sip_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- References user_profiles.tenant_id but no FK constraint
    
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_active ON sip_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_username ON sip_configurations(sip_username);

-- Row Level Security (RLS) policies
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sip_configurations
CREATE POLICY "Users can view their tenant's SIP configuration" ON sip_configurations
    FOR SELECT USING (
        tenant_id::text IN (
            SELECT tenant_id::text FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all SIP configurations" ON sip_configurations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can insert SIP configurations for their tenant" ON sip_configurations
    FOR INSERT WITH CHECK (
        tenant_id::text IN (
            SELECT tenant_id::text FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Function to get tenant SIP config (updated for no FK constraint)
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