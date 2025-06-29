-- Check if SIP configuration exists for the tenant
SELECT * FROM sip_configurations WHERE tenant_id = (
  SELECT tenant_id FROM user_profiles WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
);

-- If not exists, insert a new SIP configuration
INSERT INTO sip_configurations (
  tenant_id,
  sip_username,
  sip_password,
  is_active,
  signalwire_project_id
) 
SELECT 
  tenant_id,
  'tradeworks-' || COALESCE(
    (SELECT name FROM tenants WHERE id = tenant_id),
    'default'
  ),
  'secure_password_here', -- You'll need to set this
  true,
  '000076e6-6359-41a2-b551-015b3ce9166a'
FROM user_profiles 
WHERE id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
ON CONFLICT (tenant_id) DO UPDATE
SET is_active = true;