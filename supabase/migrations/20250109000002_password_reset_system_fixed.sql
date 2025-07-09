-- Create comprehensive password reset tracking table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint TEXT,
    request_source TEXT DEFAULT 'user',
    initiated_by UUID REFERENCES auth.users(id),
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    email_id TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON public.password_reset_requests(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token_hash ON public.password_reset_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at ON public.password_reset_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_tenant_id ON public.password_reset_requests(tenant_id);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.password_reset_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_rate_limits_identifier ON public.password_reset_rate_limits(identifier, identifier_type);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own password reset requests" ON public.password_reset_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view tenant password reset requests" ON public.password_reset_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
            AND tenant_id = password_reset_requests.tenant_id
        )
    );

CREATE POLICY "Service role full access to password resets" ON public.password_reset_requests
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to rate limits" ON public.password_reset_rate_limits
    FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_resets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.password_reset_requests
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
    
    DELETE FROM public.password_reset_rate_limits
    WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- Update trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_password_reset_requests_updated_at') THEN
        CREATE TRIGGER update_password_reset_requests_updated_at
            BEFORE UPDATE ON public.password_reset_requests
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_password_reset_rate_limits_updated_at') THEN
        CREATE TRIGGER update_password_reset_rate_limits_updated_at
            BEFORE UPDATE ON public.password_reset_rate_limits
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;