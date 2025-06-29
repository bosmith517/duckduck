-- Add missing columns to sip_configurations table
ALTER TABLE sip_configurations 
ADD COLUMN IF NOT EXISTS sip_endpoint_id TEXT,
ADD COLUMN IF NOT EXISTS sip_profile_id TEXT;

-- Check current user's tenant
SELECT 
  up.id as user_id, 
  up.tenant_id, 
  t.name as tenant_name,
  t.is_active as tenant_active
FROM user_profiles up
JOIN tenants t ON t.id = up.tenant_id
WHERE up.id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3';

-- Check existing SIP configurations
SELECT id, tenant_id, sip_username, is_active, signalwire_project_id 
FROM sip_configurations;

-- Create a basic SIP configuration using the correct column names
INSERT INTO sip_configurations (
  tenant_id,
  sip_username,
  sip_password_encrypted, -- Correct column name
  sip_domain,
  sip_proxy,
  is_active,
  signalwire_project_id,
  display_name,
  created_at,
  updated_at
) 
SELECT 
  tenant_id,
  'webrtc_user_' || SUBSTRING(id::text, 1, 8),
  'encrypted_' || gen_random_uuid()::text, -- This should be properly encrypted in production
  'taurustech.signalwire.com',
  'taurustech.signalwire.com',
  true,
  '000076e6-6359-41a2-b551-015b3ce9166a',
  'User ' || SUBSTRING(id::text, 1, 8),
  NOW(),
  NOW()
FROM user_profiles 
WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
ON CONFLICT (tenant_id) 
DO UPDATE SET 
  is_active = true,
  sip_domain = 'taurustech.signalwire.com',
  sip_proxy = 'taurustech.signalwire.com',
  updated_at = NOW();

-- Verify the configuration was created
SELECT * FROM sip_configurations WHERE is_active = true;