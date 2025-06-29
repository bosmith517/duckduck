-- Quick fix to get calling working

-- 1. Check if you have a SIP configuration
SELECT * FROM sip_configurations 
WHERE tenant_id = (
  SELECT tenant_id FROM user_profiles WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
);

-- 2. If not, create one with minimal required fields
INSERT INTO sip_configurations (
  tenant_id,
  sip_username,
  sip_password_encrypted,
  sip_domain,
  sip_proxy,
  signalwire_project_id,
  is_active,
  display_name
) 
SELECT 
  tenant_id,
  'user_' || SUBSTRING(id::text, 1, 8),
  'temp_encrypted_password', -- In production, this should be properly encrypted
  'taurustech.signalwire.com',
  'taurustech.signalwire.com',
  '000076e6-6359-41a2-b551-015b3ce9166a',
  true,
  first_name || ' ' || last_name
FROM user_profiles 
WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
ON CONFLICT (tenant_id) 
DO UPDATE SET 
  is_active = true,
  updated_at = NOW();

-- 3. Verify it worked
SELECT id, tenant_id, sip_username, is_active 
FROM sip_configurations 
WHERE is_active = true;