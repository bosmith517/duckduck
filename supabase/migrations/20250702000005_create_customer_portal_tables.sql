-- Create customer portal tables for token-based access and activity tracking

-- Create client_portal_tokens table if not exists
CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    customer_id uuid, -- Can reference either accounts.id or contacts.id
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    token text UNIQUE NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now(),
    last_accessed timestamptz,
    access_count integer DEFAULT 0,
    is_active boolean DEFAULT true
);

-- Add columns if table already exists
DO $$ 
BEGIN
    -- Add job_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'client_portal_tokens' 
                   AND column_name = 'job_id') THEN
        ALTER TABLE public.client_portal_tokens ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE;
    END IF;
    
    -- Add customer_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'client_portal_tokens' 
                   AND column_name = 'customer_id') THEN
        ALTER TABLE public.client_portal_tokens ADD COLUMN customer_id uuid;
    END IF;
END $$;

-- Create portal_activity_log table
CREATE TABLE IF NOT EXISTS public.portal_activity_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    portal_token_id uuid REFERENCES public.client_portal_tokens(id) ON DELETE CASCADE,
    activity_type text NOT NULL CHECK (activity_type IN ('login', 'view_job', 'view_estimate', 'view_invoice', 'payment_attempt', 'document_download', 'message_sent')),
    page_visited text,
    duration_seconds integer,
    ip_address text,
    user_agent text,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance (only if columns exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'client_portal_tokens' 
               AND column_name = 'job_id') THEN
        CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_job_id ON public.client_portal_tokens(job_id);
    END IF;
END $$;
-- Create other indexes only if columns exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'client_portal_tokens' 
               AND column_name = 'customer_id') THEN
        CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_customer_id ON public.client_portal_tokens(customer_id);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_tenant_id ON public.client_portal_tokens(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_token ON public.client_portal_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_is_active ON public.client_portal_tokens(is_active);
    
    -- Check if portal_token_id column exists in portal_activity_log
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'portal_activity_log' 
               AND column_name = 'portal_token_id') THEN
        CREATE INDEX IF NOT EXISTS idx_portal_activity_log_portal_token_id ON public.portal_activity_log(portal_token_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'portal_activity_log' 
               AND column_name = 'activity_type') THEN
        CREATE INDEX IF NOT EXISTS idx_portal_activity_log_activity_type ON public.portal_activity_log(activity_type);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_portal_activity_log_created_at ON public.portal_activity_log(created_at);
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for client_portal_tokens
DROP POLICY IF EXISTS "Users can manage portal tokens for their tenant" ON public.client_portal_tokens;
CREATE POLICY "Users can manage portal tokens for their tenant" ON public.client_portal_tokens
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

-- Create RLS policies for portal_activity_log  
DROP POLICY IF EXISTS "Users can manage activity logs for their tenant" ON public.portal_activity_log;

-- Only create policy if portal_token_id column exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'portal_activity_log' 
               AND column_name = 'portal_token_id') THEN
        CREATE POLICY "Users can manage activity logs for their tenant" ON public.portal_activity_log
            FOR ALL USING (
                portal_token_id IN (
                    SELECT id FROM public.client_portal_tokens 
                    WHERE tenant_id IN (
                        SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON public.client_portal_tokens TO authenticated;
GRANT ALL ON public.portal_activity_log TO authenticated;
GRANT ALL ON public.client_portal_tokens TO anon;
GRANT ALL ON public.portal_activity_log TO anon;

-- Add comments for documentation
COMMENT ON TABLE public.client_portal_tokens IS 'Stores secure tokens for customer portal access';
COMMENT ON TABLE public.portal_activity_log IS 'Tracks customer portal activity and engagement';
COMMENT ON COLUMN public.client_portal_tokens.customer_id IS 'References either accounts.id for business clients or contacts.id for individual customers';
COMMENT ON COLUMN public.client_portal_tokens.token IS 'Secure token for customer portal access - sent via SMS/email';
COMMENT ON COLUMN public.portal_activity_log.activity_type IS 'Type of portal activity: login, view_job, view_estimate, etc.';