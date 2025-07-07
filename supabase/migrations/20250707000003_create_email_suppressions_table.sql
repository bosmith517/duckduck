-- Email suppressions table already exists from previous migration, just add missing elements
-- Check if we need to add any missing columns or constraints
DO $$ 
BEGIN
    -- Add reason_detail column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'email_suppressions' 
                   AND column_name = 'reason_detail') THEN
        ALTER TABLE email_suppressions ADD COLUMN reason_detail TEXT;
    END IF;
    
    -- Update reason check constraint to include more values if needed
    -- This is done by dropping and recreating the constraint
    ALTER TABLE email_suppressions DROP CONSTRAINT IF EXISTS email_suppressions_reason_check;
    ALTER TABLE email_suppressions ADD CONSTRAINT email_suppressions_reason_check 
        CHECK (reason IN ('unsubscribe', 'bounce', 'complaint', 'manual', 'invalid', 'bounced', 'complained', 'unsubscribed'));
END $$;

-- Indexes for performance (using correct column name)
CREATE INDEX IF NOT EXISTS idx_email_suppressions_tenant_id ON email_suppressions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_email_address ON email_suppressions(email_address);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason ON email_suppressions(reason);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_expires_at ON email_suppressions(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
CREATE POLICY "Users can view and manage their tenant suppressions" ON email_suppressions
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON email_suppressions TO authenticated;

-- Function to check if an email is suppressed
CREATE OR REPLACE FUNCTION is_email_suppressed(
    p_tenant_id UUID,
    p_email VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM email_suppressions 
        WHERE tenant_id = p_tenant_id 
        AND email_address = p_email
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$;

-- Function to add email to suppression list
CREATE OR REPLACE FUNCTION add_email_suppression(
    p_tenant_id UUID,
    p_email VARCHAR(255),
    p_reason VARCHAR(50),
    p_reason_detail TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    suppression_id UUID;
BEGIN
    INSERT INTO email_suppressions (
        tenant_id,
        email_address,
        reason,
        reason_detail,
        expires_at
    ) VALUES (
        p_tenant_id,
        p_email,
        p_reason,
        p_reason_detail,
        p_expires_at
    )
    ON CONFLICT (tenant_id, email_address) 
    DO UPDATE SET
        reason = EXCLUDED.reason,
        reason_detail = EXCLUDED.reason_detail,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW()
    RETURNING id INTO suppression_id;
    
    RETURN suppression_id;
END;
$$;

-- Function to remove email from suppression list
CREATE OR REPLACE FUNCTION remove_email_suppression(
    p_tenant_id UUID,
    p_email VARCHAR(255)
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM email_suppressions
    WHERE tenant_id = p_tenant_id
    AND email_address = p_email;
    
    RETURN FOUND;
END;
$$;

-- Function to clean up expired suppressions (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_suppressions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_suppressions
    WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Note: The queue_email_with_suppression_check function will be created in a later migration
-- when the email_queue table and related functions are available

-- Add comments
COMMENT ON TABLE email_suppressions IS 'Manages email addresses that should not receive emails due to bounces, complaints, or unsubscribes';
COMMENT ON COLUMN email_suppressions.reason IS 'Why the email was suppressed: bounced, complained (spam), unsubscribed, or manually added';
COMMENT ON COLUMN email_suppressions.expires_at IS 'Optional expiration date for temporary suppressions (e.g., soft bounces)';