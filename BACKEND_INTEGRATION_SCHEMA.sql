-- BACKEND INTEGRATION SCHEMA
-- Complete database schema for Digital Twin, Smart Devices, and AI Recommendations

-- Equipment tracking table for Digital Twin
CREATE TABLE IF NOT EXISTS customer_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('hvac', 'electrical', 'plumbing', 'appliance', 'security', 'smart_device')),
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    install_date DATE,
    warranty_expiration DATE,
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'good' CHECK (status IN ('excellent', 'good', 'needs_attention', 'urgent', 'offline')),
    efficiency_rating INTEGER DEFAULT 85 CHECK (efficiency_rating >= 0 AND efficiency_rating <= 100),
    last_service_date DATE,
    next_service_due DATE,
    equipment_image_url TEXT,
    manual_url TEXT,
    notes TEXT,
    is_smart_enabled BOOLEAN DEFAULT FALSE,
    smart_device_id VARCHAR(255), -- For IoT integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart device integration table
CREATE TABLE IF NOT EXISTS smart_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    equipment_id UUID REFERENCES customer_equipment(id),
    device_type VARCHAR(100) NOT NULL, -- 'nest_thermostat', 'ring_doorbell', 'august_lock', etc.
    device_brand VARCHAR(50) NOT NULL,
    device_model VARCHAR(100),
    device_id VARCHAR(255) NOT NULL, -- External device identifier
    mac_address VARCHAR(17),
    ip_address INET,
    api_endpoint TEXT,
    access_token_encrypted TEXT, -- Encrypted OAuth tokens
    refresh_token_encrypted TEXT,
    is_online BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    firmware_version VARCHAR(50),
    capabilities JSONB DEFAULT '{}', -- Device capabilities (heating, cooling, monitoring, etc.)
    current_settings JSONB DEFAULT '{}', -- Current device settings
    integration_status VARCHAR(50) DEFAULT 'connected' CHECK (integration_status IN ('connected', 'disconnected', 'error', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device telemetry data
CREATE TABLE IF NOT EXISTS device_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES smart_devices(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metric_name VARCHAR(100) NOT NULL, -- 'temperature', 'humidity', 'energy_usage', etc.
    metric_value NUMERIC,
    metric_unit VARCHAR(20), -- 'celsius', 'fahrenheit', 'kwh', 'percent', etc.
    quality_score INTEGER DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI recommendations table
CREATE TABLE IF NOT EXISTS maintenance_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    equipment_id UUID REFERENCES customer_equipment(id),
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('preventive', 'repair', 'replacement', 'upgrade', 'seasonal')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_cost NUMERIC(10,2),
    estimated_labor_hours NUMERIC(4,1),
    timeframe VARCHAR(100), -- 'next 2 weeks', '3-6 months', etc.
    benefits TEXT[], -- Array of benefit strings
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_confidence_score INTEGER CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
    ai_model_version VARCHAR(50),
    data_sources TEXT[], -- What data was used for recommendation
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'scheduled', 'completed')),
    dismissed_at TIMESTAMP WITH TIME ZONE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service plans and quotes
CREATE TABLE IF NOT EXISTS service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    plan_name VARCHAR(100) NOT NULL,
    plan_tier VARCHAR(20) NOT NULL CHECK (plan_tier IN ('basic', 'premium', 'ultimate')),
    monthly_price NUMERIC(8,2) NOT NULL,
    annual_price NUMERIC(10,2) NOT NULL,
    description TEXT,
    features JSONB DEFAULT '[]',
    included_services JSONB DEFAULT '[]',
    labor_discount_percent INTEGER DEFAULT 0,
    parts_discount_percent INTEGER DEFAULT 0,
    emergency_discount_percent INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer service plan subscriptions
CREATE TABLE IF NOT EXISTS customer_service_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    service_plan_id UUID NOT NULL REFERENCES service_plans(id),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'suspended', 'expired')),
    start_date DATE NOT NULL,
    end_date DATE,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    monthly_rate NUMERIC(8,2) NOT NULL,
    services_used_count INTEGER DEFAULT 0,
    total_savings NUMERIC(10,2) DEFAULT 0,
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service quotes
CREATE TABLE IF NOT EXISTS service_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    equipment_id UUID REFERENCES customer_equipment(id),
    quote_type VARCHAR(50) NOT NULL CHECK (quote_type IN ('repair', 'replacement', 'upgrade', 'maintenance')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    base_price NUMERIC(10,2) NOT NULL,
    labor_hours NUMERIC(4,1),
    material_cost NUMERIC(10,2),
    tax_amount NUMERIC(8,2),
    total_price NUMERIC(10,2) NOT NULL,
    member_price NUMERIC(10,2), -- Price with membership discount
    member_savings NUMERIC(8,2),
    warranty_terms TEXT,
    timeline VARCHAR(100),
    urgency VARCHAR(20) DEFAULT 'standard' CHECK (urgency IN ('standard', 'priority', 'emergency')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'expired')),
    valid_until DATE,
    created_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Equipment service history
CREATE TABLE IF NOT EXISTS equipment_service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES customer_equipment(id),
    job_id UUID REFERENCES jobs(id),
    service_type VARCHAR(100) NOT NULL,
    service_date DATE NOT NULL,
    technician_id UUID REFERENCES user_profiles(id),
    technician_name VARCHAR(255),
    service_notes TEXT,
    parts_replaced TEXT[],
    labor_hours NUMERIC(4,1),
    service_cost NUMERIC(8,2),
    warranty_info TEXT,
    before_photos TEXT[],
    after_photos TEXT[],
    efficiency_before INTEGER,
    efficiency_after INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_equipment_contact ON customer_equipment(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_equipment_type ON customer_equipment(equipment_type);
CREATE INDEX IF NOT EXISTS idx_customer_equipment_status ON customer_equipment(status);
CREATE INDEX IF NOT EXISTS idx_customer_equipment_next_service ON customer_equipment(next_service_due);

CREATE INDEX IF NOT EXISTS idx_smart_devices_contact ON smart_devices(contact_id);
CREATE INDEX IF NOT EXISTS idx_smart_devices_equipment ON smart_devices(equipment_id);
CREATE INDEX IF NOT EXISTS idx_smart_devices_type ON smart_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_smart_devices_online ON smart_devices(is_online);

CREATE INDEX IF NOT EXISTS idx_device_telemetry_device_time ON device_telemetry(device_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_device_telemetry_metric ON device_telemetry(metric_name);

CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_contact ON maintenance_recommendations(contact_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_priority ON maintenance_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_status ON maintenance_recommendations(status);

CREATE INDEX IF NOT EXISTS idx_service_quotes_contact ON service_quotes(contact_id);
CREATE INDEX IF NOT EXISTS idx_service_quotes_status ON service_quotes(status);

-- Enable RLS on all tables
ALTER TABLE customer_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_service_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY tenant_isolation_customer_equipment ON customer_equipment
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_smart_devices ON smart_devices
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_maintenance_recommendations ON maintenance_recommendations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_service_plans ON service_plans
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_customer_service_plans ON customer_service_plans
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_service_quotes ON service_quotes
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Insert default service plans
INSERT INTO service_plans (tenant_id, plan_name, plan_tier, monthly_price, annual_price, description, features, labor_discount_percent, parts_discount_percent, emergency_discount_percent) VALUES
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'Essential Care',
    'basic',
    29.00,
    299.00,
    'Basic maintenance and priority service for your essential home systems.',
    '["2 annual HVAC tune-ups", "10% discount on repairs", "Priority scheduling", "Free filter replacements", "Basic equipment monitoring"]',
    10,
    5,
    0
),
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'Complete Comfort',
    'premium',
    49.00,
    499.00,
    'Comprehensive home system care with enhanced benefits and faster response.',
    '["4 annual HVAC tune-ups", "15% discount on repairs", "Priority scheduling", "Free filter replacements", "Advanced equipment monitoring", "24/7 emergency hotline"]',
    15,
    10,
    20
),
(
    '10076fd5-e70f-4062-8192-e42173cf57fd',
    'Total Home Protection',
    'ultimate',
    79.00,
    799.00,
    'Ultimate peace of mind with comprehensive coverage and premium benefits.',
    '["Unlimited service visits", "25% discount on repairs", "Same-day emergency service", "Free filter replacements", "IoT equipment monitoring", "24/7 emergency hotline"]',
    25,
    20,
    50
);

-- Verify tables created
SELECT 'Schema created successfully' as result;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customer_equipment', 'smart_devices', 'device_telemetry', 'maintenance_recommendations', 'service_plans', 'customer_service_plans', 'service_quotes', 'equipment_service_history')
ORDER BY table_name;