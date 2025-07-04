-- Fix client portal tables to match existing schema and add missing columns

-- First, add missing columns to client_portal_tokens if they don't exist
DO $$ 
BEGIN
    -- Add job_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_portal_tokens' AND column_name = 'job_id') THEN
        ALTER TABLE public.client_portal_tokens 
        ADD COLUMN job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE;
    END IF;

    -- Add customer_id column if it doesn't exist  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_portal_tokens' AND column_name = 'customer_id') THEN
        ALTER TABLE public.client_portal_tokens 
        ADD COLUMN customer_id uuid;
    END IF;

    -- Add access_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'client_portal_tokens' AND column_name = 'access_count') THEN
        ALTER TABLE public.client_portal_tokens 
        ADD COLUMN access_count integer DEFAULT 0;
    END IF;
END $$;

-- Update the existing portal_activity_log table to match ClientPortalService expectations
-- The existing table uses contact_id, but we need to reference client_portal_tokens
DO $$
BEGIN
    -- Check if we need to add portal_token_id column to existing portal_activity_log
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'portal_activity_log' AND column_name = 'portal_token_id') THEN
        
        -- Add portal_token_id column
        ALTER TABLE public.portal_activity_log 
        ADD COLUMN portal_token_id uuid REFERENCES public.client_portal_tokens(id) ON DELETE CASCADE;
        
        -- Update existing records to link to portal tokens based on contact_id
        UPDATE public.portal_activity_log 
        SET portal_token_id = (
            SELECT cpt.id 
            FROM public.client_portal_tokens cpt 
            WHERE cpt.contact_id = portal_activity_log.contact_id 
            AND cpt.tenant_id = portal_activity_log.tenant_id
            LIMIT 1
        )
        WHERE portal_token_id IS NULL;
        
    END IF;
    
    -- Check if activity_type values match what ClientPortalService expects
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'portal_activity_log' AND column_name = 'activity_type') THEN
        
        -- Update constraint to match ClientPortalService expectations
        ALTER TABLE public.portal_activity_log 
        DROP CONSTRAINT IF EXISTS portal_activity_log_activity_type_check;
        
        ALTER TABLE public.portal_activity_log 
        ADD CONSTRAINT portal_activity_log_activity_type_check 
        CHECK (activity_type::text = ANY (ARRAY[
            'login'::text, 
            'view_job'::text, 
            'view_estimate'::text, 
            'view_invoice'::text, 
            'payment_attempt'::text, 
            'document_download'::text, 
            'message_sent'::text
        ]));
    END IF;
    
    -- Add missing columns to portal_activity_log if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'portal_activity_log' AND column_name = 'page_visited') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN page_visited text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'portal_activity_log' AND column_name = 'duration_seconds') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN duration_seconds integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'portal_activity_log' AND column_name = 'metadata') THEN
        ALTER TABLE public.portal_activity_log ADD COLUMN metadata jsonb;
    END IF;
    
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_job_id ON public.client_portal_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_customer_id ON public.client_portal_tokens(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_log_portal_token_id ON public.portal_activity_log(portal_token_id);

-- Update RLS policies to work with both old and new structure
DROP POLICY IF EXISTS "Users can manage activity logs for their tenant" ON public.portal_activity_log;
DROP POLICY IF EXISTS "authenticated_users_can_manage_activity" ON public.portal_activity_log;
DROP POLICY IF EXISTS "anonymous_can_log_activity" ON public.portal_activity_log;
DROP POLICY IF EXISTS "service_role_activity_access" ON public.portal_activity_log;

CREATE POLICY "Users can manage activity logs for their tenant" ON public.portal_activity_log
    FOR ALL USING (
        -- Allow access if user belongs to the same tenant
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
        OR
        -- Allow access via portal_token_id relationship
        portal_token_id IN (
            SELECT id FROM public.client_portal_tokens 
            WHERE tenant_id = (
                SELECT tenant_id FROM public.user_profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Grant permissions
GRANT ALL ON public.client_portal_tokens TO authenticated;
GRANT ALL ON public.client_portal_tokens TO anon;
GRANT ALL ON public.portal_activity_log TO authenticated; 
GRANT ALL ON public.portal_activity_log TO anon;

-- Add helpful comments
COMMENT ON COLUMN public.client_portal_tokens.job_id IS 'References the job this portal token is for';
COMMENT ON COLUMN public.client_portal_tokens.customer_id IS 'References either accounts.id for business clients or contacts.id for individual customers';
COMMENT ON COLUMN public.client_portal_tokens.access_count IS 'Number of times the portal has been accessed';
COMMENT ON COLUMN public.portal_activity_log.portal_token_id IS 'References the portal token used for this activity';