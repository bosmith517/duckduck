-- FIXED DEPLOYMENT SCRIPT: Handle Existing Database Structure
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: CHECK AND UPDATE EXISTING TABLES
-- ========================================

-- Add missing columns to tenants table if they don't exist
DO $$ 
BEGIN
    -- Add subdomain column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subdomain') THEN
        ALTER TABLE tenants ADD COLUMN subdomain VARCHAR(50) UNIQUE;
    END IF;
    
    -- Add plan column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'plan') THEN
        ALTER TABLE tenants ADD COLUMN plan VARCHAR(20) DEFAULT 'basic';
        ALTER TABLE tenants ADD CONSTRAINT check_plan CHECK (plan IN ('basic', 'professional', 'enterprise'));
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'is_active') THEN
        ALTER TABLE tenants ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Update user_profiles table to ensure proper structure
DO $$
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        ALTER TABLE user_profiles ADD COLUMN role VARCHAR(20) DEFAULT 'agent';
        ALTER TABLE user_profiles ADD CONSTRAINT check_role CHECK (role IN ('admin', 'agent', 'viewer', 'owner'));
    END IF;
    
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_active') THEN
        ALTER TABLE user_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- ========================================
-- STEP 2: CREATE SIGNALWIRE TABLES
-- ========================================

-- Drop and recreate sip_configurations with proper structure
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

-- Create or update signalwire_phone_numbers table
DROP TABLE IF EXISTS signalwire_phone_numbers CASCADE;
CREATE TABLE signalwire_phone_numbers (
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

-- Update calls table if needed
DO $$
BEGIN
    -- Add contact_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'contact_id') THEN
        ALTER TABLE calls ADD COLUMN contact_id UUID;
    END IF;
END $$;

-- ========================================
-- STEP 3: CREATE INDEXES
-- ========================================

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

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their tenant's SIP configuration" ON sip_configurations;
DROP POLICY IF EXISTS "Service role can manage all SIP configurations" ON sip_configurations;
DROP POLICY IF EXISTS "Admins can manage SIP configurations for their tenant" ON sip_configurations;
DROP POLICY IF EXISTS "Users can view their tenant's phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Service role can manage all phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Users can view calls for their tenant" ON calls;
DROP POLICY IF EXISTS "Users can insert calls for their tenant" ON calls;
DROP POLICY IF EXISTS "Users can update calls for their tenant" ON calls;
DROP POLICY IF EXISTS "Service role can manage all calls" ON calls;

-- Create RLS policies
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can view profiles in their tenant" ON user_profiles
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

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

CREATE POLICY "Users can view their tenant's phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view calls for their tenant" ON calls
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert calls for their tenant" ON calls
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update calls for their tenant" ON calls
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

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
-- DEPLOYMENT COMPLETE
-- ========================================

SELECT 'Fixed multi-tenant database schema deployment completed successfully!' as status,
       'Tables updated to handle existing structure' as note;