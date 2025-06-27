-- Complete Multi-Tenant Schema with Proper Foreign Key Constraints
-- This restores the full multi-tenant architecture for TaurusTech

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

-- Proper SIP Configurations table WITH foreign key constraints
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_active ON sip_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_username ON sip_configurations(sip_username);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants table
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- RLS Policies for sip_configurations  
CREATE POLICY "Users can view their tenant's SIP configuration" ON sip_configurations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all SIP configurations" ON sip_configurations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage SIP configurations for their tenant" ON sip_configurations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- Function to ensure user belongs to tenant (for validation)
CREATE OR REPLACE FUNCTION validate_user_tenant(user_uuid UUID, tenant_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_uuid 
        AND tenant_id = tenant_uuid
    );
END;
$$;

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