-- SignalWire Phone Numbers table based on official SignalWire API schema
-- https://developer.signalwire.com/rest/signalwire-rest/endpoints/space/purchase-phone-number/

CREATE TABLE IF NOT EXISTS signalwire_phone_numbers (
    -- Primary key and tenant relationship
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- SignalWire Core Fields (from API response)
    signalwire_id UUID NOT NULL UNIQUE, -- The unique identifier from SignalWire
    number VARCHAR(20) NOT NULL UNIQUE, -- Phone number in E164 format (+15558675309)
    name VARCHAR(255), -- Name given to the phone number
    
    -- Call Handler Configuration
    call_handler VARCHAR(50), -- relay_script, relay_context, relay_topic, etc.
    call_receive_mode VARCHAR(10) DEFAULT 'voice', -- voice or fax
    call_request_url TEXT,
    call_request_method VARCHAR(10) DEFAULT 'POST',
    call_fallback_url TEXT,
    call_fallback_method VARCHAR(10) DEFAULT 'POST',
    call_status_callback_url TEXT,
    call_status_callback_method VARCHAR(10) DEFAULT 'POST',
    
    -- LaML Application Settings
    call_laml_application_id VARCHAR(255),
    call_dialogflow_agent_id VARCHAR(255),
    
    -- Relay Settings
    call_relay_topic VARCHAR(255),
    call_relay_topic_status_callback_url TEXT,
    call_relay_context VARCHAR(255),
    call_relay_context_status_callback_url TEXT,
    call_relay_application VARCHAR(255),
    call_relay_connector_id VARCHAR(255),
    call_sip_endpoint_id VARCHAR(255),
    call_verto_resource VARCHAR(255),
    call_video_room_id UUID,
    
    -- Message Handler Configuration
    message_handler VARCHAR(50), -- relay_context, relay_topic, relay_application, etc.
    message_request_url TEXT,
    message_request_method VARCHAR(10) DEFAULT 'POST',
    message_fallback_url TEXT,
    message_fallback_method VARCHAR(10) DEFAULT 'POST',
    message_laml_application_id VARCHAR(255),
    message_relay_topic VARCHAR(255),
    message_relay_context VARCHAR(255),
    message_relay_application VARCHAR(255),
    
    -- Capabilities and Type
    capabilities JSONB, -- ["voice","sms","mms","fax"]
    number_type VARCHAR(20), -- toll-free or longcode
    e911_address_id VARCHAR(255),
    
    -- Timestamps (from SignalWire)
    signalwire_created_at TIMESTAMP WITH TIME ZONE,
    signalwire_updated_at TIMESTAMP WITH TIME ZONE,
    next_billed_at TIMESTAMP WITH TIME ZONE,
    
    -- Our internal management fields
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    internal_notes TEXT,
    
    -- Our timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_call_handler CHECK (
        call_handler IN (
            'relay_script', 'relay_context', 'relay_topic', 'relay_application', 
            'laml_webhooks', 'laml_application', 'dialogflow', 'relay_connector', 
            'relay_sip_endpoint', 'relay_verto_endpoint', 'video_room'
        )
    ),
    CONSTRAINT valid_call_receive_mode CHECK (call_receive_mode IN ('voice', 'fax')),
    CONSTRAINT valid_message_handler CHECK (
        message_handler IN (
            'relay_context', 'relay_topic', 'relay_application', 
            'laml_webhooks', 'laml_application'
        )
    ),
    CONSTRAINT valid_number_type CHECK (number_type IN ('toll-free', 'longcode')),
    CONSTRAINT valid_http_method_call_request CHECK (call_request_method IN ('POST', 'GET')),
    CONSTRAINT valid_http_method_call_fallback CHECK (call_fallback_method IN ('POST', 'GET')),
    CONSTRAINT valid_http_method_call_status CHECK (call_status_callback_method IN ('POST', 'GET')),
    CONSTRAINT valid_http_method_message_request CHECK (message_request_method IN ('POST', 'GET')),
    CONSTRAINT valid_http_method_message_fallback CHECK (message_fallback_method IN ('POST', 'GET')),
    CONSTRAINT unique_primary_per_tenant EXCLUDE (tenant_id WITH =) WHERE (is_primary = true)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_tenant_id ON signalwire_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_signalwire_id ON signalwire_phone_numbers(signalwire_id);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_number ON signalwire_phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_active ON signalwire_phone_numbers(is_active);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_primary ON signalwire_phone_numbers(is_primary);
CREATE INDEX IF NOT EXISTS idx_signalwire_phone_numbers_capabilities ON signalwire_phone_numbers USING GIN(capabilities);

-- Row Level Security (RLS)
ALTER TABLE signalwire_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's phone numbers" ON signalwire_phone_numbers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage phone numbers" ON signalwire_phone_numbers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND tenant_id = signalwire_phone_numbers.tenant_id
            AND role IN ('admin', 'owner')
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_signalwire_phone_numbers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at field
CREATE TRIGGER trigger_update_signalwire_phone_numbers_updated_at
    BEFORE UPDATE ON signalwire_phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION update_signalwire_phone_numbers_updated_at();

-- Function to get phone numbers with capabilities
CREATE OR REPLACE FUNCTION get_tenant_phone_numbers_with_capabilities(tenant_uuid UUID)
RETURNS TABLE (
    id UUID,
    number VARCHAR,
    name VARCHAR,
    capabilities JSONB,
    number_type VARCHAR,
    is_primary BOOLEAN,
    is_active BOOLEAN,
    call_handler VARCHAR,
    message_handler VARCHAR
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        spn.id,
        spn.number,
        spn.name,
        spn.capabilities,
        spn.number_type,
        spn.is_primary,
        spn.is_active,
        spn.call_handler,
        spn.message_handler
    FROM signalwire_phone_numbers spn
    WHERE spn.tenant_id = tenant_uuid
    AND spn.is_active = true
    ORDER BY spn.is_primary DESC, spn.created_at ASC;
END;
$$;

-- Function to set primary phone number (ensures only one primary per tenant)
CREATE OR REPLACE FUNCTION set_primary_phone_number(
    phone_number_uuid UUID,
    tenant_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- First, unset all primary flags for this tenant
    UPDATE signalwire_phone_numbers 
    SET is_primary = false 
    WHERE tenant_id = tenant_uuid;
    
    -- Then set the selected number as primary
    UPDATE signalwire_phone_numbers 
    SET is_primary = true 
    WHERE id = phone_number_uuid 
    AND tenant_id = tenant_uuid;
    
    -- Return true if a row was updated
    RETURN FOUND;
END;
$$;

-- Function to check if a number has specific capability
CREATE OR REPLACE FUNCTION phone_number_has_capability(
    phone_number_uuid UUID,
    capability_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_capability BOOLEAN := false;
BEGIN
    SELECT (capabilities ? capability_name) INTO has_capability
    FROM signalwire_phone_numbers
    WHERE id = phone_number_uuid;
    
    RETURN COALESCE(has_capability, false);
END;
$$;

-- View for easy phone number management
CREATE OR REPLACE VIEW phone_numbers_summary AS
SELECT 
    spn.id,
    spn.tenant_id,
    spn.number,
    spn.name,
    spn.number_type,
    spn.is_primary,
    spn.is_active,
    spn.capabilities,
    CASE 
        WHEN spn.capabilities ? 'voice' THEN true 
        ELSE false 
    END as voice_enabled,
    CASE 
        WHEN spn.capabilities ? 'sms' THEN true 
        ELSE false 
    END as sms_enabled,
    CASE 
        WHEN spn.capabilities ? 'mms' THEN true 
        ELSE false 
    END as mms_enabled,
    CASE 
        WHEN spn.capabilities ? 'fax' THEN true 
        ELSE false 
    END as fax_enabled,
    spn.call_handler,
    spn.message_handler,
    spn.created_at,
    spn.next_billed_at
FROM signalwire_phone_numbers spn
WHERE spn.is_active = true;

-- Grant permissions on the view
GRANT SELECT ON phone_numbers_summary TO authenticated;

-- Comments for documentation
COMMENT ON TABLE signalwire_phone_numbers IS 'Phone numbers purchased from SignalWire with full API schema support';
COMMENT ON COLUMN signalwire_phone_numbers.signalwire_id IS 'The unique identifier from SignalWire API response';
COMMENT ON COLUMN signalwire_phone_numbers.number IS 'Phone number in E164 format (+15558675309)';
COMMENT ON COLUMN signalwire_phone_numbers.capabilities IS 'JSON array of capabilities: ["voice","sms","mms","fax"]';
COMMENT ON COLUMN signalwire_phone_numbers.call_handler IS 'SignalWire call handler type (relay_context, laml_webhooks, etc.)';
COMMENT ON COLUMN signalwire_phone_numbers.message_handler IS 'SignalWire message handler type';
