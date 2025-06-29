-- Fix calls table to allow null call_sid initially
-- This allows us to create call records before getting the SignalWire call_sid

-- Make call_sid nullable (but still unique when not null)
ALTER TABLE calls ALTER COLUMN call_sid DROP NOT NULL;

-- Add a partial unique index to ensure call_sid is unique when not null
DROP INDEX IF EXISTS idx_calls_call_sid;
CREATE UNIQUE INDEX idx_calls_call_sid_unique ON calls(call_sid) WHERE call_sid IS NOT NULL;

-- Add contact_id column if it doesn't exist (for linking calls to contacts)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'contact_id') THEN
        ALTER TABLE calls ADD COLUMN contact_id UUID REFERENCES contacts(id);
        CREATE INDEX IF NOT EXISTS idx_calls_contact_id ON calls(contact_id);
    END IF;
END $$;

COMMENT ON COLUMN calls.call_sid IS 'SignalWire call ID (nullable until call is initiated)';
COMMENT ON COLUMN calls.contact_id IS 'Optional reference to contact for this call';