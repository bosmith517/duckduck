-- DEPLOYMENT SCRIPT: Complete Multi-Tenant Database Schema
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: CORE TENANT INFRASTRUCTURE
-- ========================================

-- Core Tenants table (if not exists)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    subdomain VARCHAR(50) UNIQUE,
    plan VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles with proper tenant relationship (if not exists)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role VARCHAR(20) CHECK (role IN ('admin', 'agent', 'viewer', 'owner')) DEFAULT 'agent',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_per_tenant UNIQUE(id, tenant_id)
);

-- ========================================
-- STEP 2: SIGNALWIRE COMMUNICATION TABLES
-- ========================================

-- SIP Configurations (tenant-based phone service)
DROP TABLE IF EXISTS sip_configurations CASCADE;
CREATE TABLE sip_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- SIP Endpoint Details
    sip_username VARCHAR(100) NOT NULL UNIQUE,
    sip_password_encrypted TEXT NOT NULL,
    sip_domain VARCHAR(255) NOT NULL,
    sip_proxy VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    
    -- SignalWire Configuration
    signalwire_endpoint_id VARCHAR(100) UNIQUE,
    signalwire_project_id VARCHAR(100) NOT NULL,
    
    -- Service Status
    is_active BOOLEAN DEFAULT true,
    service_plan VARCHAR(50) DEFAULT 'basic' CHECK (service_plan IN ('basic', 'professional', 'enterprise')),
    
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
    CONSTRAINT unique_tenant_sip UNIQUE(tenant_id)
);

-- SignalWire Phone Numbers (tenant-isolated)
CREATE TABLE IF NOT EXISTS signalwire_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Phone Number Details
    number VARCHAR(20) NOT NULL UNIQUE,
    signalwire_number_id VARCHAR(100) UNIQUE,
    country_code VARCHAR(5) NOT NULL DEFAULT '+1',
    area_code VARCHAR(10),
    number_type VARCHAR(20) DEFAULT 'local',
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
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

-- Calls table (if not exists - with proper tenant isolation)
CREATE TABLE IF NOT EXISTS calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_sid TEXT UNIQUE,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ringing',
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID,
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- STEP 3: INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_active ON sip_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_username ON sip_configurations(sip_username);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_tenant_id ON signalwire_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_number ON signalwire_phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- ========================================
-- STEP 4: ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants table
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- RLS Policies for sip_configurations  
DROP POLICY IF EXISTS "Users can view their tenant's SIP configuration" ON sip_configurations;
CREATE POLICY "Users can view their tenant's SIP configuration" ON sip_configurations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage all SIP configurations" ON sip_configurations;
CREATE POLICY "Service role can manage all SIP configurations" ON sip_configurations
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage SIP configurations for their tenant" ON sip_configurations;
CREATE POLICY "Admins can manage SIP configurations for their tenant" ON sip_configurations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- RLS Policies for signalwire_phone_numbers
DROP POLICY IF EXISTS "Users can view their tenant's phone numbers" ON signalwire_phone_numbers;
CREATE POLICY "Users can view their tenant's phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage all phone numbers" ON signalwire_phone_numbers;
CREATE POLICY "Service role can manage all phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for calls
DROP POLICY IF EXISTS "Users can view calls for their tenant" ON calls;
CREATE POLICY "Users can view calls for their tenant" ON calls
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert calls for their tenant" ON calls;
CREATE POLICY "Users can insert calls for their tenant" ON calls
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage all calls" ON calls;
CREATE POLICY "Service role can manage all calls" ON calls
    FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- STEP 5: UTILITY FUNCTIONS
-- ========================================

-- Function to get tenant info for a user
CREATE OR REPLACE FUNCTION get_user_tenant(user_uuid UUID)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name VARCHAR,
    user_role VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.tenant_id,
        t.name,
        up.role
    FROM user_profiles up
    JOIN tenants t ON t.id = up.tenant_id
    WHERE up.id = user_uuid;
END;
$$;

-- ========================================
-- STEP 6: SEED DATA (SAMPLE TENANT)
-- ========================================

-- Insert a sample tenant if none exists
INSERT INTO tenants (id, name, subdomain, plan, is_active)
VALUES (
    gen_random_uuid(),
    'Demo Company',
    'demo',
    'professional',
    true
) ON CONFLICT DO NOTHING;

-- ========================================
-- DEPLOYMENT COMPLETE
-- ========================================

SELECT 'Multi-tenant database schema deployment completed successfully!' as status;