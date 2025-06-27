-- Create calls table for real-time call tracking
CREATE TABLE IF NOT EXISTS calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_sid TEXT NOT NULL UNIQUE,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ringing',
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES auth.users(id),
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_id ON calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);

-- Enable Row Level Security
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view calls for their tenant" ON calls
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert calls for their tenant" ON calls
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update calls for their tenant" ON calls
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Update answered_at when status changes to active
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
        NEW.answered_at = NOW();
    END IF;
    
    -- Update ended_at when call ends
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
        NEW.ended_at = NOW();
        -- Calculate duration if answered_at exists
        IF NEW.answered_at IS NOT NULL THEN
            NEW.duration = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.answered_at))::INTEGER;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW
    EXECUTE FUNCTION update_calls_updated_at();

-- Create view for call statistics
CREATE OR REPLACE VIEW call_statistics AS
SELECT 
    tenant_id,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
    COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_calls,
    AVG(duration) FILTER (WHERE duration > 0) as avg_duration,
    SUM(duration) as total_duration,
    DATE_TRUNC('day', created_at) as call_date
FROM calls
GROUP BY tenant_id, DATE_TRUNC('day', created_at)
ORDER BY call_date DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON calls TO authenticated;
GRANT SELECT ON call_statistics TO authenticated;

-- Enable realtime for the calls table
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

COMMENT ON TABLE calls IS 'Real-time call tracking for SignalWire voice calls';
COMMENT ON COLUMN calls.call_sid IS 'SignalWire call ID';
COMMENT ON COLUMN calls.status IS 'Call status: ringing, active, completed, failed, cancelled';
COMMENT ON COLUMN calls.direction IS 'Call direction: inbound or outbound';
COMMENT ON COLUMN calls.duration IS 'Call duration in seconds';
