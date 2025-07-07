-- Create email_messages table for storing email history
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email details
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    
    -- Email content
    to_email VARCHAR(255) NOT NULL,
    cc_emails TEXT[], -- Array of CC emails
    bcc_emails TEXT[], -- Array of BCC emails
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    reply_to VARCHAR(255),
    subject TEXT NOT NULL,
    html_body TEXT,
    text_body TEXT,
    
    -- Email metadata
    direction VARCHAR(20) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('draft', 'pending', 'sent', 'delivered', 'bounced', 'failed')),
    
    -- Tracking information
    resend_email_id VARCHAR(255), -- ID from Resend API
    message_id VARCHAR(255), -- Message ID for threading
    in_reply_to VARCHAR(255), -- For email threading
    thread_id VARCHAR(255), -- For grouping related emails
    
    -- Event tracking
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- User tracking
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    
    -- Template information
    template_id UUID, -- Reference to email template used
    template_variables JSONB DEFAULT '{}'::JSONB,
    
    -- Attachments (store file URLs or references)
    attachments JSONB DEFAULT '[]'::JSONB,
    
    -- Tags and metadata
    tags JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_messages_tenant_id ON email_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_id ON email_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account_id ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_lead_id ON email_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_job_id ON email_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_to_email ON email_messages(to_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_from_email ON email_messages(from_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_resend_email_id ON email_messages(resend_email_id);

-- Full text search index on subject and body
CREATE INDEX IF NOT EXISTS idx_email_messages_search 
ON email_messages 
USING gin(to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(text_body, '')));

-- Enable Row Level Security
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
CREATE POLICY "Users can view and manage their tenant emails" ON email_messages
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON email_messages TO authenticated;

-- Function to automatically link emails to contacts/accounts based on email address
CREATE OR REPLACE FUNCTION link_email_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If contact_id is not set, try to find contact by email
    IF NEW.contact_id IS NULL AND NEW.to_email IS NOT NULL THEN
        -- Try to find contact by email
        SELECT id INTO NEW.contact_id
        FROM contacts
        WHERE tenant_id = NEW.tenant_id
        AND (email = NEW.to_email OR secondary_email = NEW.to_email)
        LIMIT 1;
        
        -- If contact found and account_id not set, get account from contact
        IF NEW.contact_id IS NOT NULL AND NEW.account_id IS NULL THEN
            SELECT account_id INTO NEW.account_id
            FROM contacts
            WHERE id = NEW.contact_id;
        END IF;
    END IF;
    
    -- If still no contact but have account_id, try to find primary contact
    IF NEW.contact_id IS NULL AND NEW.account_id IS NOT NULL THEN
        SELECT id INTO NEW.contact_id
        FROM contacts
        WHERE tenant_id = NEW.tenant_id
        AND account_id = NEW.account_id
        AND is_primary = true
        LIMIT 1;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically link emails
CREATE TRIGGER link_email_to_contact_trigger
    BEFORE INSERT ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION link_email_to_contact();

-- Function to get email thread
CREATE OR REPLACE FUNCTION get_email_thread(p_thread_id VARCHAR(255), p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    subject TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255),
    direction VARCHAR(20),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    html_body TEXT,
    text_body TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        em.id,
        em.subject,
        em.from_email,
        em.from_name,
        em.to_email,
        em.direction,
        em.status,
        em.created_at,
        em.html_body,
        em.text_body
    FROM email_messages em
    WHERE em.thread_id = p_thread_id
    AND em.tenant_id = p_tenant_id
    ORDER BY em.created_at ASC;
END;
$$;

-- Function to get recent emails for a contact
CREATE OR REPLACE FUNCTION get_contact_emails(
    p_contact_id UUID,
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    subject TEXT,
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_email VARCHAR(255),
    direction VARCHAR(20),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE,
    thread_id VARCHAR(255),
    has_attachments BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        em.id,
        em.subject,
        em.from_email,
        em.from_name,
        em.to_email,
        em.direction,
        em.status,
        em.created_at,
        em.thread_id,
        (jsonb_array_length(em.attachments) > 0) as has_attachments
    FROM email_messages em
    WHERE em.contact_id = p_contact_id
    AND em.tenant_id = p_tenant_id
    ORDER BY em.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Add comments
COMMENT ON TABLE email_messages IS 'Email history and tracking for all tenant emails';
COMMENT ON COLUMN email_messages.direction IS 'Whether email was sent (outbound) or received (inbound)';
COMMENT ON COLUMN email_messages.thread_id IS 'Groups related emails in a conversation thread';
COMMENT ON COLUMN email_messages.resend_email_id IS 'External ID from Resend API for tracking';