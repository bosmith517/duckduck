-- Fix v_tenant_phone_overview to prioritize business_info.business_phone from tenants table
-- This ensures the Company Configuration page phone number is used in customer portal

DROP VIEW IF EXISTS v_tenant_phone_overview;

CREATE OR REPLACE VIEW v_tenant_phone_overview AS
SELECT 
    t.id AS tenant_id,
    t.company_name,
    t.onboarding_completed,
    -- Business phone from Company Configuration takes priority
    COALESCE(
        (t.business_info ->> 'business_phone'::text),  -- First priority: Company Config phone
        a.phone,                                        -- Second priority: Account phone
        (t.business_info ->> 'selected_phone'::text)   -- Third priority: Onboarding phone
    ) AS business_contact_phone,
    -- Keep original fields for compatibility
    (t.business_info ->> 'selected_phone'::text) AS selected_phone_during_onboarding,
    a.phone AS account_phone,  -- Renamed to be clearer
    a.email AS business_email,
    a.address_line1 AS business_address,
    -- SignalWire fields (kept for compatibility but not used in portal)
    spn.id AS signalwire_phone_id,
    spn.number AS signalwire_number,
    spn.number_type AS signalwire_number_type,
    spn.is_active AS signalwire_active,
    spn.sms_enabled,
    spn.voice_enabled,
    spn.fax_enabled,
    spn.purchased_at AS signalwire_provisioned_at
FROM tenants t
LEFT JOIN accounts a ON (a.tenant_id = t.id AND a.type::text = 'company'::text)
LEFT JOIN signalwire_phone_numbers spn ON (spn.tenant_id = t.id AND spn.is_active = true)
ORDER BY t.created_at DESC;

-- Grant appropriate permissions
GRANT SELECT ON v_tenant_phone_overview TO authenticated;
GRANT SELECT ON v_tenant_phone_overview TO anon;