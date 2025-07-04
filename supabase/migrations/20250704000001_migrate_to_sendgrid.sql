-- Migrate email system from Resend to SendGrid
-- SendGrid has different features and API structure

-- Update tenant_email_domains for SendGrid
ALTER TABLE tenant_email_domains 
ADD COLUMN IF NOT EXISTS sendgrid_domain_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS sendgrid_api_key_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS inbound_parse_url TEXT,
ADD COLUMN IF NOT EXISTS link_branding_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS authenticated_domain_id VARCHAR(255);

-- Update provider to sendgrid
UPDATE tenant_email_domains 
SET provider = 'sendgrid' 
WHERE provider = 'resend' OR provider IS NULL;

-- Create SendGrid-specific tables

-- SendGrid API keys per tenant (encrypted)
CREATE TABLE IF NOT EXISTS tenant_sendgrid_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  sendgrid_key_id VARCHAR(255) NOT NULL UNIQUE,
  key_hash VARCHAR(255) NOT NULL, -- Encrypted API key
  permissions JSONB DEFAULT '[]'::JSONB, -- ['mail.send', 'mail.batch.create', etc.]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, key_name)
);

-- SendGrid subusers for tenant isolation
CREATE TABLE IF NOT EXISTS tenant_sendgrid_subusers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subuser_name VARCHAR(255) NOT NULL UNIQUE,
  sendgrid_subuser_id VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255), -- If we manage passwords
  is_active BOOLEAN DEFAULT true,
  credit_allocation INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inbound email parsing settings
CREATE TABLE IF NOT EXISTS inbound_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES tenant_email_domains(id) ON DELETE CASCADE,
  hostname VARCHAR(255) NOT NULL, -- mail.yourdomain.com
  parse_url TEXT NOT NULL, -- Your webhook URL
  spam_check BOOLEAN DEFAULT true,
  send_raw BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, hostname)
);

-- SendGrid template management (different from our custom templates)
CREATE TABLE IF NOT EXISTS sendgrid_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_name VARCHAR(255) NOT NULL,
  sendgrid_template_id VARCHAR(255) NOT NULL,
  version_id VARCHAR(255), -- SendGrid template version
  template_type VARCHAR(50) DEFAULT 'transactional',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, sendgrid_template_id)
);

-- Update email_queue for SendGrid compatibility
ALTER TABLE email_queue 
ADD COLUMN IF NOT EXISTS sendgrid_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS sendgrid_template_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS personalizations JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS custom_args JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS send_at INTEGER; -- Unix timestamp for scheduled sends

-- Update email_events for SendGrid webhook data
ALTER TABLE email_events 
ADD COLUMN IF NOT EXISTS sendgrid_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(255),
ADD COLUMN IF NOT EXISTS sg_event_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS sg_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS useragent TEXT,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS url TEXT, -- For click events
ADD COLUMN IF NOT EXISTS reason TEXT, -- For bounce/drop events
ADD COLUMN IF NOT EXISTS status TEXT, -- For delivery status
ADD COLUMN IF NOT EXISTS attempt INTEGER; -- Delivery attempt number

-- Create indexes for SendGrid specific fields
CREATE INDEX IF NOT EXISTS idx_tenant_sendgrid_keys_tenant_id ON tenant_sendgrid_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_sendgrid_subusers_tenant_id ON tenant_sendgrid_subusers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_email_settings_tenant_domain ON inbound_email_settings(tenant_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_sendgrid_templates_tenant ON sendgrid_templates(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_email_queue_sendgrid_id ON email_queue(sendgrid_message_id) WHERE sendgrid_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_events_sendgrid_event ON email_events(sendgrid_event_id) WHERE sendgrid_event_id IS NOT NULL;

-- Enable RLS on new tables
ALTER TABLE tenant_sendgrid_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_sendgrid_subusers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their tenant SendGrid keys" ON tenant_sendgrid_keys
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their tenant subusers" ON tenant_sendgrid_subusers
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their inbound settings" ON inbound_email_settings
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their SendGrid templates" ON sendgrid_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON tenant_sendgrid_keys TO authenticated;
GRANT SELECT ON tenant_sendgrid_subusers TO authenticated;
GRANT ALL ON inbound_email_settings TO authenticated;
GRANT ALL ON sendgrid_templates TO authenticated;

-- Update functions for SendGrid compatibility

-- Update email sending limits based on SendGrid plans
CREATE OR REPLACE FUNCTION get_sendgrid_plan_limits(plan_name TEXT)
RETURNS TABLE (
  daily_limit INTEGER,
  monthly_limit INTEGER
)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE plan_name
      WHEN 'free' THEN 100
      WHEN 'essentials' THEN 40000  -- $19.95/month
      WHEN 'pro' THEN 120000        -- $89.95/month
      WHEN 'premier' THEN 1200000   -- $399/month
      ELSE 100
    END as daily_limit,
    CASE plan_name
      WHEN 'free' THEN 100
      WHEN 'essentials' THEN 1200000
      WHEN 'pro' THEN 3600000
      WHEN 'premier' THEN 36000000
      ELSE 100
    END as monthly_limit;
END;
$$;

-- Update domain verification for SendGrid
CREATE OR REPLACE FUNCTION get_sendgrid_domain_verification(p_tenant_id UUID, p_domain_name TEXT)
RETURNS TABLE (
  domain_id UUID,
  domain_name VARCHAR(255),
  sendgrid_domain_id VARCHAR(255),
  verification_status TEXT,
  dns_records JSONB
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  SET search_path = public, pg_catalog;
  
  RETURN QUERY
  SELECT 
    ted.id,
    ted.domain_name,
    ted.sendgrid_domain_id,
    ted.status::TEXT,
    ted.dns_records
  FROM tenant_email_domains ted
  WHERE ted.tenant_id = p_tenant_id
  AND ted.domain_name = p_domain_name
  AND ted.provider = 'sendgrid';
END;
$$;

-- Comments
COMMENT ON TABLE tenant_sendgrid_keys IS 'SendGrid API keys per tenant with proper encryption';
COMMENT ON TABLE tenant_sendgrid_subusers IS 'SendGrid subusers for tenant isolation and billing';
COMMENT ON TABLE inbound_email_settings IS 'Inbound email parsing configuration per domain';
COMMENT ON TABLE sendgrid_templates IS 'SendGrid dynamic templates synchronized with local templates';

-- Migration verification
DO $$
BEGIN
  RAISE NOTICE 'SendGrid migration completed successfully';
  RAISE NOTICE 'Updated % domains to use SendGrid provider', (
    SELECT COUNT(*) FROM tenant_email_domains WHERE provider = 'sendgrid'
  );
END;
$$;