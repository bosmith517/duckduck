-- Update SIP configuration with correct SignalWire credentials
-- Based on the actual SIP user: user-cc5fcb27@taurustech-015b3ce9166a.sip.signalwire.com

-- First, check existing configurations
SELECT * FROM sip_configurations WHERE is_active = true;

-- Update or insert the correct SIP configuration
INSERT INTO sip_configurations (
  tenant_id,
  sip_username,
  sip_password_encrypted,
  sip_domain,
  sip_proxy,
  primary_phone_number,
  is_active,
  signalwire_project_id,
  display_name,
  created_at,
  updated_at
) 
SELECT 
  up.tenant_id,
  'user-cc5fcb27',  -- Correct SignalWire SIP username
  '%*5mfMUCEloE8kjl',  -- Correct SignalWire SIP password
  'taurustech-015b3ce9166a.sip.signalwire.com',
  'taurustech-015b3ce9166a.sip.signalwire.com',
  '+15551234567',  -- Default phone number (update with your actual SignalWire number)
  true,
  '000076e6-6359-41a2-b551-015b3ce9166a',
  'TradeWorks User',
  NOW(),
  NOW()
FROM user_profiles up
WHERE up.id = '4bff5ef2-0ec1-48c6-bdbd-d1909fc1e6e3'
ON CONFLICT (tenant_id) 
DO UPDATE SET 
  sip_username = 'user-cc5fcb27',
  sip_password_encrypted = '%*5mfMUCEloE8kjl',
  sip_domain = 'taurustech-015b3ce9166a.sip.signalwire.com',
  sip_proxy = 'taurustech-015b3ce9166a.sip.signalwire.com',
  primary_phone_number = '+15551234567',  -- Update with your actual SignalWire number
  is_active = true,
  updated_at = NOW();

-- Verify the update
SELECT id, tenant_id, sip_username, sip_domain, is_active 
FROM sip_configurations 
WHERE is_active = true;