-- Add missing columns to calls table for voicemail functionality
ALTER TABLE calls ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_is_read ON calls(is_read);
CREATE INDEX IF NOT EXISTS idx_calls_provider_id ON calls(provider_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);

-- Update the comment to reflect the new usage
COMMENT ON TABLE calls IS 'Real-time call tracking for SignalWire voice calls and voicemail storage';
COMMENT ON COLUMN calls.is_read IS 'Whether the voicemail has been read/played';
COMMENT ON COLUMN calls.provider_id IS 'Provider-specific identifier for the call';
COMMENT ON COLUMN calls.contact_id IS 'Reference to the contact associated with this call';