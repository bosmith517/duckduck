-- Safe Schema Deployment - Handles Existing Tables
-- Run this to safely create or update the schema

-- ========================================
-- STEP 1: HANDLE EXISTING TENANTS TABLE
-- ========================================

-- Check if tenants table exists and add missing columns
DO $$ 
BEGIN
    -- Create tenants table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        CREATE TABLE tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL,
            subdomain VARCHAR(50) UNIQUE,
            plan VARCHAR(20) DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'enterprise')),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created tenants table';
    ELSE
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'name') THEN
            ALTER TABLE tenants ADD COLUMN name VARCHAR(100);
            RAISE NOTICE 'Added name column to tenants table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subdomain') THEN
            ALTER TABLE tenants ADD COLUMN subdomain VARCHAR(50) UNIQUE;
            RAISE NOTICE 'Added subdomain column to tenants table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'plan') THEN
            ALTER TABLE tenants ADD COLUMN plan VARCHAR(20) DEFAULT 'basic';
            ALTER TABLE tenants ADD CONSTRAINT check_plan CHECK (plan IN ('basic', 'professional', 'enterprise'));
            RAISE NOTICE 'Added plan column to tenants table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'is_active') THEN
            ALTER TABLE tenants ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_active column to tenants table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'created_at') THEN
            ALTER TABLE tenants ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at column to tenants table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'updated_at') THEN
            ALTER TABLE tenants ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column to tenants table';
        END IF;
    END IF;
END $$;

-- ========================================
-- STEP 2: HANDLE USER_PROFILES TABLE
-- ========================================

DO $$
BEGIN
    -- Create user_profiles table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        CREATE TABLE user_profiles (
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
        RAISE NOTICE 'Created user_profiles table';
    ELSE
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'tenant_id') THEN
            -- This is critical - we need to add the tenant_id column and foreign key
            ALTER TABLE user_profiles ADD COLUMN tenant_id UUID;
            RAISE NOTICE 'Added tenant_id column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'email') THEN
            ALTER TABLE user_profiles ADD COLUMN email VARCHAR(255);
            RAISE NOTICE 'Added email column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'first_name') THEN
            ALTER TABLE user_profiles ADD COLUMN first_name VARCHAR(50);
            RAISE NOTICE 'Added first_name column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_name') THEN
            ALTER TABLE user_profiles ADD COLUMN last_name VARCHAR(50);
            RAISE NOTICE 'Added last_name column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
            ALTER TABLE user_profiles ADD COLUMN role VARCHAR(20) DEFAULT 'agent';
            ALTER TABLE user_profiles ADD CONSTRAINT check_role CHECK (role IN ('admin', 'agent', 'viewer', 'owner'));
            RAISE NOTICE 'Added role column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_active') THEN
            ALTER TABLE user_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
            RAISE NOTICE 'Added is_active column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'created_at') THEN
            ALTER TABLE user_profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at column to user_profiles table';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
            ALTER TABLE user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column to user_profiles table';
        END IF;
    END IF;
END $$;

-- ========================================
-- STEP 3: ADD FOREIGN KEY CONSTRAINTS SAFELY
-- ========================================

DO $$
BEGIN
    -- Add foreign key constraint for tenant_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_tenant_id_fkey' 
        AND table_name = 'user_profiles'
    ) THEN
        -- First, we need to ensure there's at least one tenant for existing users
        IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = '10076fd5-e70f-4062-8192-e42173cf57fd'::UUID) THEN
            INSERT INTO tenants (id, name, subdomain, plan) 
            VALUES ('10076fd5-e70f-4062-8192-e42173cf57fd'::UUID, 'Default Tenant', 'default', 'basic');
        END IF;
        
        -- Update any user_profiles that don't have a tenant_id
        UPDATE user_profiles 
        SET tenant_id = '10076fd5-e70f-4062-8192-e42173cf57fd'::UUID 
        WHERE tenant_id IS NULL;
        
        -- Make tenant_id NOT NULL
        ALTER TABLE user_profiles ALTER COLUMN tenant_id SET NOT NULL;
        
        -- Add the foreign key constraint
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint for tenant_id';
    END IF;
END $$;

-- ========================================
-- STEP 4: CREATE SIGNALWIRE TABLES
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

-- ========================================
-- STEP 5: CREATE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_tenant_id ON signalwire_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sip_configurations_tenant_id ON sip_configurations(tenant_id);

-- ========================================
-- STEP 6: ENABLE RLS AND CREATE POLICIES
-- ========================================

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_configurations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view tenant phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Admins can manage tenant phone numbers" ON signalwire_phone_numbers;
DROP POLICY IF EXISTS "Users can view tenant sip configs" ON sip_configurations;
DROP POLICY IF EXISTS "Admins can manage tenant sip configs" ON sip_configurations;

-- Create policies
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

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view tenant phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage tenant phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Users can view tenant sip configs" ON sip_configurations
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage tenant sip configs" ON sip_configurations
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- ========================================
-- FINAL STATUS CHECK
-- ========================================

SELECT 'DEPLOYMENT COMPLETED SUCCESSFULLY' as status;

-- Show the structure of our main tables
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count,
    string_agg(c.column_name, ', ' ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND t.table_name IN ('tenants', 'user_profiles', 'signalwire_phone_numbers', 'sip_configurations')
GROUP BY t.table_name
ORDER BY t.table_name;