-- Add new columns to sip_configurations if they don't exist
ALTER TABLE sip_configurations 
ADD COLUMN IF NOT EXISTS sip_endpoint_id TEXT,
ADD COLUMN IF NOT EXISTS sip_profile_id TEXT;

-- Update the check_and_fix_sip query with the new approach
-- First, check your user's tenant_id
SELECT 
  up.id as user_id, 
  up.tenant_id, 
  t.name as tenant_name,
  t.is_active as tenant_active
FROM user_profiles up
JOIN tenants t ON t.id = up.tenant_id
WHERE up.id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3';

-- Check existing SIP configurations
SELECT * FROM sip_configurations;

-- Create a basic SIP configuration if none exists
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
  'webrtc_user_' || SUBSTRING(id::text, 1, 8),
  'temp_' || gen_random_uuid()::text,
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