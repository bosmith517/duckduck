-- COMPANY CONFIGURATION SCHEMA
-- Manages service company settings and document templates

-- Enhanced tenant configuration table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS business_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS business_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(50),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'US',
ADD COLUMN IF NOT EXISTS license_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS insurance_info TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "08:00", "close": "17:00", "closed": false},
  "tuesday": {"open": "08:00", "close": "17:00", "closed": false},
  "wednesday": {"open": "08:00", "close": "17:00", "closed": false},
  "thursday": {"open": "08:00", "close": "17:00", "closed": false},
  "friday": {"open": "08:00", "close": "17:00", "closed": false},
  "saturday": {"open": "09:00", "close": "15:00", "closed": false},
  "sunday": {"open": "10:00", "close": "14:00", "closed": true}
}'::jsonb,
ADD COLUMN IF NOT EXISTS service_areas TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS customer_portal_settings JSONB DEFAULT '{
  "show_pricing": true,
  "allow_online_booking": true,
  "show_technician_photos": true,
  "enable_tracking": true,
  "show_service_history": true
}'::jsonb;

-- Document templates table
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    template_name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('invoice', 'estimate', 'service_agreement', 'work_order', 'contract', 'receipt')),
    file_url TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50), -- 'pdf', 'docx', etc.
    auto_fill_fields TEXT[] DEFAULT ARRAY[]::TEXT[], -- Fields that will be auto-filled
    template_variables JSONB DEFAULT '{}', -- Variable mappings for auto-fill
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- Default template for this type
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES user_profiles(id)
);

-- Technician profiles table
CREATE TABLE IF NOT EXISTS technician_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    display_name VARCHAR(255) NOT NULL,
    title VARCHAR(100), -- 'Senior HVAC Technician', 'Lead Installer', etc.
    bio TEXT,
    photo_url TEXT,
    years_experience INTEGER DEFAULT 0,
    certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
    specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
    languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
    phone_number VARCHAR(20),
    email VARCHAR(255),
    show_in_portal BOOLEAN DEFAULT TRUE,
    show_contact_info BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    completed_jobs INTEGER DEFAULT 0,
    response_time_minutes INTEGER DEFAULT 15, -- Average response time
    is_active BOOLEAN DEFAULT TRUE,
    emergency_available BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service company branding (for suppliers with more customization)
CREATE TABLE IF NOT EXISTS company_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    brand_level VARCHAR(20) DEFAULT 'standard' CHECK (brand_level IN ('standard', 'supplier', 'enterprise')),
    
    -- Visual Branding
    primary_color VARCHAR(7) DEFAULT '#0066CC', -- Hex color
    secondary_color VARCHAR(7) DEFAULT '#6C757D',
    accent_color VARCHAR(7) DEFAULT '#28A745',
    logo_url TEXT,
    favicon_url TEXT,
    background_image_url TEXT,
    
    -- Typography
    font_family VARCHAR(100) DEFAULT 'Inter',
    heading_font VARCHAR(100),
    
    -- Portal Customization
    portal_title VARCHAR(255),
    portal_description TEXT,
    welcome_message TEXT,
    footer_text TEXT,
    custom_css TEXT, -- For advanced customization
    
    -- Contact Information Override
    custom_support_phone VARCHAR(20),
    custom_support_email VARCHAR(255),
    custom_website VARCHAR(255),
    
    -- Feature Flags (more control for suppliers)
    enable_advanced_features BOOLEAN DEFAULT FALSE,
    allow_white_labeling BOOLEAN DEFAULT FALSE,
    custom_domain VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-fill field mappings
CREATE TABLE IF NOT EXISTS auto_fill_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    field_name VARCHAR(100) NOT NULL, -- e.g., 'company_name', 'business_phone'
    field_label VARCHAR(255) NOT NULL, -- Human readable label
    data_source VARCHAR(100) NOT NULL, -- 'tenant', 'user_profile', 'job', 'contact'
    source_column VARCHAR(100) NOT NULL, -- Column name in source table
    field_type VARCHAR(50) DEFAULT 'text', -- 'text', 'number', 'date', 'boolean'
    is_required BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant ON document_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_type ON document_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_document_templates_active ON document_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_technician_profiles_tenant ON technician_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_user ON technician_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_active ON technician_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_technician_profiles_portal ON technician_profiles(show_in_portal);

CREATE INDEX IF NOT EXISTS idx_company_branding_tenant ON company_branding(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auto_fill_mappings_tenant ON auto_fill_mappings(tenant_id);

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_fill_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_document_templates ON document_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_technician_profiles ON technician_profiles
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_company_branding ON company_branding
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_auto_fill_mappings ON auto_fill_mappings
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Insert default auto-fill field mappings
INSERT INTO auto_fill_mappings (tenant_id, field_name, field_label, data_source, source_column, field_type, is_required) VALUES
('10076fd5-e70f-4062-8192-e42173cf57fd', 'company_name', 'Company Name', 'tenant', 'company_name', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'business_phone', 'Business Phone', 'tenant', 'business_phone', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'business_email', 'Business Email', 'tenant', 'business_email', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'address_line1', 'Street Address', 'tenant', 'address_line1', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'city', 'City', 'tenant', 'city', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'state', 'State', 'tenant', 'state', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'zip_code', 'ZIP Code', 'tenant', 'zip_code', 'text', true),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'license_number', 'License Number', 'tenant', 'license_number', 'text', false),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'website', 'Website', 'tenant', 'website', 'text', false),
('10076fd5-e70f-4062-8192-e42173cf57fd', 'emergency_phone', 'Emergency Phone', 'tenant', 'emergency_phone', 'text', false);

-- Insert default company branding for standard service companies
INSERT INTO company_branding (tenant_id, brand_level) VALUES
('10076fd5-e70f-4062-8192-e42173cf57fd', 'standard')
ON CONFLICT DO NOTHING;

-- Function to auto-fill document templates
CREATE OR REPLACE FUNCTION generate_auto_filled_document(
    template_id UUID,
    job_id UUID DEFAULT NULL,
    contact_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    template_record document_templates%ROWTYPE;
    tenant_record tenants%ROWTYPE;
    auto_fill_data JSON := '{}';
    field_mapping auto_fill_mappings%ROWTYPE;
BEGIN
    -- Get template
    SELECT * INTO template_record FROM document_templates WHERE id = template_id;
    
    IF NOT FOUND THEN
        RETURN JSON_BUILD_OBJECT('error', 'Template not found');
    END IF;
    
    -- Get tenant data
    SELECT * INTO tenant_record FROM tenants WHERE id = template_record.tenant_id;
    
    -- Build auto-fill data
    FOR field_mapping IN 
        SELECT * FROM auto_fill_mappings 
        WHERE tenant_id = template_record.tenant_id 
        AND field_name = ANY(template_record.auto_fill_fields)
    LOOP
        IF field_mapping.data_source = 'tenant' THEN
            EXECUTE format('SELECT to_json(%I) FROM tenants WHERE id = $1', field_mapping.source_column)
            USING template_record.tenant_id INTO auto_fill_data;
        END IF;
        -- Add more data sources as needed (job, contact, etc.)
    END LOOP;
    
    RETURN JSON_BUILD_OBJECT(
        'template_id', template_id,
        'template_name', template_record.template_name,
        'file_url', template_record.file_url,
        'auto_fill_data', auto_fill_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update tenants table with sample data
UPDATE tenants 
SET 
    business_phone = '(555) 123-4567',
    business_email = 'info@' || LOWER(REPLACE(company_name, ' ', '')) || '.com',
    city = 'Austin',
    state = 'TX',
    zip_code = '78701',
    license_number = 'HVAC-' || EXTRACT(YEAR FROM NOW()) || '-TX'
WHERE id = '10076fd5-e70f-4062-8192-e42173cf57fd';

-- Verify schema
SELECT 'Company configuration schema created successfully' as result;

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('document_templates', 'technician_profiles', 'company_branding', 'auto_fill_mappings')
ORDER BY table_name, ordinal_position;