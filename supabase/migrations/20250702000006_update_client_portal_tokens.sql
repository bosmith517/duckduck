-- Update client_portal_tokens table to match the ClientPortalService expectations

-- Add missing columns to client_portal_tokens
ALTER TABLE public.client_portal_tokens 
ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS customer_id uuid, -- Can reference either accounts.id or contacts.id  
ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_job_id ON public.client_portal_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_customer_id ON public.client_portal_tokens(customer_id);

-- Create portal_activity_log table if it doesn't exist
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

-- Add missing columns to portal_activity_log if table exists but is missing columns
DO $$ 
BEGIN
    -- Add portal_token_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'portal_token_id') THEN
        ALTER TABLE public.portal_activity_log 
        ADD COLUMN portal_token_id uuid REFERENCES public.client_portal_tokens(id) ON DELETE CASCADE;
    END IF;
    
    -- Add other missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'page_visited') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN page_visited text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'duration_seconds') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN duration_seconds integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'ip_address') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN ip_address text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'user_agent') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN user_agent text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'portal_activity_log' 
                   AND column_name = 'metadata') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN metadata jsonb;
    END IF;
END $$;

-- Create indexes for portal_activity_log (only if columns exist)
DO $$ 
BEGIN
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

-- Enable RLS on portal_activity_log if not already enabled
ALTER TABLE public.portal_activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for portal_activity_log
DROP POLICY IF EXISTS "Users can manage activity logs for their tenant" ON public.portal_activity_log;
DROP POLICY IF EXISTS "authenticated_users_can_manage_activity" ON public.portal_activity_log;
DROP POLICY IF EXISTS "anonymous_can_log_activity" ON public.portal_activity_log;
DROP POLICY IF EXISTS "service_role_activity_access" ON public.portal_activity_log;

CREATE POLICY "Users can manage activity logs for their tenant" ON public.portal_activity_log
    FOR ALL USING (
        portal_token_id IN (
            SELECT id FROM public.client_portal_tokens 
            WHERE tenant_id = (
                SELECT tenant_id FROM public.user_profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Grant permissions
GRANT ALL ON public.portal_activity_log TO authenticated;
GRANT ALL ON public.portal_activity_log TO anon;

-- Add comments for documentation
COMMENT ON COLUMN public.client_portal_tokens.job_id IS 'References the job this portal token is for';
COMMENT ON COLUMN public.client_portal_tokens.customer_id IS 'References either accounts.id for business clients or contacts.id for individual customers';
COMMENT ON COLUMN public.client_portal_tokens.access_count IS 'Number of times the portal has been accessed';
COMMENT ON TABLE public.portal_activity_log IS 'Tracks customer portal activity and engagement';