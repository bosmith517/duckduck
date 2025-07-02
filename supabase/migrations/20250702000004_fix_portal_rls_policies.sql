-- Fix RLS policies for client_portal_tokens to allow proper access

-- Drop existing policies for client_portal_tokens
DROP POLICY IF EXISTS "Users can manage portal tokens for their tenant" ON public.client_portal_tokens;
DROP POLICY IF EXISTS "client_portal_tokens_policy" ON public.client_portal_tokens;

-- Create new comprehensive RLS policies for client_portal_tokens
CREATE POLICY "authenticated_users_can_manage_tokens" ON public.client_portal_tokens
    FOR ALL 
    TO authenticated 
    USING (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Allow anonymous users to read tokens (for customer portal access)
CREATE POLICY "anonymous_can_read_active_tokens" ON public.client_portal_tokens
    FOR SELECT
    TO anon
    USING (is_active = true);

-- Allow service role to manage all tokens (for Supabase Edge Functions)
CREATE POLICY "service_role_full_access" ON public.client_portal_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Update RLS policies for portal_activity_log
DROP POLICY IF EXISTS "Users can manage activity logs for their tenant" ON public.portal_activity_log;

CREATE POLICY "authenticated_users_can_manage_activity" ON public.portal_activity_log
    FOR ALL
    TO authenticated
    USING (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id = (
            SELECT tenant_id FROM public.user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Allow anonymous users to insert activity logs (for customer portal tracking)
CREATE POLICY "anonymous_can_log_activity" ON public.portal_activity_log
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow service role full access to activity logs
CREATE POLICY "service_role_activity_access" ON public.portal_activity_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure RLS is enabled on both tables
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity_log ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON public.client_portal_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.client_portal_tokens TO anon;
GRANT ALL ON public.portal_activity_log TO authenticated;
GRANT SELECT, INSERT ON public.portal_activity_log TO anon;

-- Grant sequence permissions if they exist
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;