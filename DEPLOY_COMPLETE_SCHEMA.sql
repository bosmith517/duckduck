-- Complete TaurusTech Database Schema Deployment
-- Run this in your Supabase SQL Editor to set up the full multi-tenant structure
-- 
-- This will create all necessary tables for proper user registration and tenant management

-- ========================================
-- STEP 1: CREATE CORE TENANT TABLES
-- ========================================

-- Core Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    subdomain VARCHAR(50) UNIQUE,
    plan VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles with proper tenant relationship
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
-- STEP 2: CREATE SIGNALWIRE TABLES
-- ========================================

-- SignalWire Phone Numbers table
CREATE TABLE IF NOT EXISTS signalwire_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Phone Number Details
    number VARCHAR(20) NOT NULL UNIQUE,
    signalwire_number_id VARCHAR(100) UNIQUE,
    country_code VARCHAR(5) DEFAULT '+1',
    number_type VARCHAR(20) DEFAULT 'local' CHECK (number_type IN ('local', 'toll-free', 'international')),
    
    -- Service Configuration
    is_active BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT true,
    fax_enabled BOOLEAN DEFAULT false,
    
    -- Pricing
    monthly_cost DECIMAL(10,2) DEFAULT 1.00,
    per_minute_cost DECIMAL(6,4) DEFAULT 0.02,
    sms_cost DECIMAL(6,4) DEFAULT 0.0075,
    
    -- Assignment
    assigned_to_user_id UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_at TIMESTAMP WITH TIME ZONE
);

-- SIP Configurations table
CREATE TABLE IF NOT EXISTS sip_configurations (
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

-- Calls table for logging
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Call Details
    call_id VARCHAR(100) UNIQUE,
    signalwire_call_id VARCHAR(100),
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    
    -- User Association
    user_id UUID REFERENCES auth.users(id),
    
    -- Call Status
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'busy', 'failed', 'no-answer', 'completed')),
    duration_seconds INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Cost Tracking
    cost DECIMAL(10,4) DEFAULT 0.0000,
    
    -- Call Recording
    recording_url TEXT,
    recording_duration INTEGER
);

-- ========================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- SignalWire phone numbers indexes
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_tenant_id ON signalwire_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_number ON signalwire_phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_active ON signalwire_phone_numbers(is_active);

-- SIP configurations indexes
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_active ON sip_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_username ON sip_configurations(sip_username);

-- Calls indexes
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_to_number ON calls(to_number);

-- ========================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 5: CREATE RLS POLICIES
-- ========================================

-- Tenants policies
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;
CREATE POLICY "Users can update their own tenant" ON tenants
    FOR UPDATE USING (
        id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- User profiles policies
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

-- SignalWire phone numbers policies
DROP POLICY IF EXISTS "Users can view tenant phone numbers" ON signalwire_phone_numbers;
CREATE POLICY "Users can view tenant phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage tenant phone numbers" ON signalwire_phone_numbers;
CREATE POLICY "Admins can manage tenant phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- SIP configurations policies
DROP POLICY IF EXISTS "Users can view tenant sip configs" ON sip_configurations;
CREATE POLICY "Users can view tenant sip configs" ON sip_configurations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can manage tenant sip configs" ON sip_configurations;
CREATE POLICY "Admins can manage tenant sip configs" ON sip_configurations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Calls policies
DROP POLICY IF EXISTS "Users can view tenant calls" ON calls;
CREATE POLICY "Users can view tenant calls" ON calls
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert calls" ON calls;
CREATE POLICY "Users can insert calls" ON calls
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their own calls" ON calls;
CREATE POLICY "Users can update their own calls" ON calls
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ========================================
-- STEP 6: CREATE FUNCTIONS FOR TENANT SETUP
-- ========================================

-- Function to create a complete tenant setup
CREATE OR REPLACE FUNCTION create_tenant_setup(
    p_tenant_name TEXT,
    p_user_id UUID,
    p_user_email TEXT,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- Create the tenant
    INSERT INTO tenants (name)
    VALUES (p_tenant_name)
    RETURNING id INTO new_tenant_id;
    
    -- Create the user profile
    INSERT INTO user_profiles (id, tenant_id, email, first_name, last_name, role)
    VALUES (p_user_id, new_tenant_id, p_user_email, p_first_name, p_last_name, 'admin');
    
    RETURN new_tenant_id;
END;
$$;

-- ========================================
-- STEP 7: SAMPLE DATA FOR TESTING
-- ========================================

-- Insert a test tenant (only if not exists)
INSERT INTO tenants (id, name, subdomain, plan)
SELECT 
    '10076fd5-e70f-4062-8192-e42173cf57fd'::UUID,
    'TaurusTech Demo Company',
    'taurustech',
    'professional'
WHERE NOT EXISTS (
    SELECT 1 FROM tenants WHERE id = '10076fd5-e70f-4062-8192-e42173cf57fd'::UUID
);

-- ========================================
-- DEPLOYMENT COMPLETE
-- ========================================

-- Show final status
SELECT 
    'DEPLOYMENT COMPLETE' as status,
    COUNT(*) as tenant_count
FROM tenants;

-- Show table information
SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('tenants', 'user_profiles', 'signalwire_phone_numbers', 'sip_configurations', 'calls')
ORDER BY tablename;