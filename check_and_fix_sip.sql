-- First, check your user's tenant_id
SELECT 
  up.id as user_id, 
  up.tenant_id, 
  t.name as tenant_name,
  t.is_active as tenant_active
FROM user_profiles up
JOIN tenants t ON t.id = up.tenant_id
WHERE up.id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3';

-- Check if SIP configuration exists
SELECT * FROM sip_configurations;

-- Create or update SIP configuration for your tenant
INSERT INTO sip_configurations (
  tenant_id,
  sip_username,
  sip_password,
  is_active,
  signalwire_project_id,
  created_at,
  updated_at
) 
SELECT 
  tenant_id,
  'tradeworks-user-' || SUBSTRING(id::text, 1, 8),
  'temp_password_12345', -- Temporary password
  true,
  '000076e6-6359-41a2-b551-015b3ce9166a',
  NOW(),
  NOW()
FROM user_profiles 
WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
ON CONFLICT (tenant_id) 
DO UPDATE SET 
  is_active = true,
  updated_at = NOW();

-- Verify it was created
SELECT * FROM sip_configurations WHERE is_active = true;