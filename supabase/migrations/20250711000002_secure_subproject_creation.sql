-- Secure SignalWire subproject creation flow
-- This replaces the automatic subproject creation during onboarding with a manual, secure process

-- First, remove any automatic triggers that create subprojects during onboarding
DROP TRIGGER IF EXISTS trigger_create_signalwire_subproject ON public.tenants;
DROP FUNCTION IF EXISTS public.auto_create_signalwire_subproject CASCADE;

-- Create a dedicated table for SignalWire subprojects with proper security
CREATE TABLE IF NOT EXISTS public.signalwire_subprojects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subproject_id varchar(255) UNIQUE NOT NULL,
    subproject_token text NOT NULL, -- Encrypted/sensitive
    space_url varchar(255) NOT NULL,
    status varchar(50) DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_at timestamptz DEFAULT now(),
    notes text,
    CONSTRAINT unique_tenant_subproject UNIQUE (tenant_id)
);

-- Enable RLS on the new table
ALTER TABLE public.signalwire_subprojects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for signalwire_subprojects
CREATE POLICY "Users can view their tenant's subproject"
ON public.signalwire_subprojects
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM user_profiles 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Only admins can manage subprojects"
ON public.signalwire_subprojects
FOR ALL
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles 
        WHERE id = auth.uid() 
        AND tenant_id = signalwire_subprojects.tenant_id
        AND role IN ('admin', 'owner')
    )
);

-- Grant appropriate permissions
GRANT SELECT ON public.signalwire_subprojects TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.signalwire_subprojects TO authenticated;

-- Create a secure function to create SignalWire subproject
CREATE OR REPLACE FUNCTION public.create_signalwire_subproject(
    p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_user_tenant_id uuid;
    v_tenant_id uuid;
    v_existing_subproject jsonb;
BEGIN
    -- Get current user info
    SELECT id INTO v_user_id FROM auth.users() WHERE id = auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get user's role and tenant
    SELECT role, tenant_id INTO v_user_role, v_user_tenant_id
    FROM user_profiles
    WHERE id = v_user_id;
    
    -- Determine which tenant to create subproject for
    IF p_tenant_id IS NOT NULL THEN
        -- If tenant_id provided, verify user has permission
        IF v_user_role = 'super_admin' THEN
            v_tenant_id := p_tenant_id;
        ELSIF v_user_tenant_id = p_tenant_id AND v_user_role IN ('admin', 'owner') THEN
            v_tenant_id := p_tenant_id;
        ELSE
            RAISE EXCEPTION 'Insufficient permissions to create subproject for this tenant';
        END IF;
    ELSE
        -- Use user's own tenant
        IF v_user_role NOT IN ('admin', 'owner') THEN
            RAISE EXCEPTION 'Only admins and owners can create subprojects';
        END IF;
        v_tenant_id := v_user_tenant_id;
    END IF;
    
    -- Check if subproject already exists
    SELECT jsonb_build_object(
        'id', id,
        'subproject_id', subproject_id,
        'status', status,
        'created_at', created_at
    ) INTO v_existing_subproject
    FROM signalwire_subprojects
    WHERE tenant_id = v_tenant_id;
    
    IF v_existing_subproject IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Subproject already exists for this tenant',
            'existing_subproject', v_existing_subproject
        );
    END IF;
    
    -- Call Edge Function to create the actual SignalWire subproject
    -- This keeps the API credentials secure in Edge Functions
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Please use the create-signalwire-subproject Edge Function to complete setup',
        'tenant_id', v_tenant_id,
        'instructions', 'Call supabase.functions.invoke("create-signalwire-subproject") to create the subproject'
    );
END;
$$;

-- Create a secure function to get SignalWire credentials
CREATE OR REPLACE FUNCTION public.get_signalwire_credentials(
    p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_user_tenant_id uuid;
    v_tenant_id uuid;
    v_credentials jsonb;
BEGIN
    -- Get current user info
    SELECT id INTO v_user_id FROM auth.users() WHERE id = auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get user's role and tenant
    SELECT role, tenant_id INTO v_user_role, v_user_tenant_id
    FROM user_profiles
    WHERE id = v_user_id;
    
    -- Determine which tenant to get credentials for
    IF p_tenant_id IS NOT NULL THEN
        IF v_user_role = 'super_admin' THEN
            v_tenant_id := p_tenant_id;
        ELSIF v_user_tenant_id = p_tenant_id THEN
            v_tenant_id := p_tenant_id;
        ELSE
            RAISE EXCEPTION 'Cannot access credentials for other tenants';
        END IF;
    ELSE
        v_tenant_id := v_user_tenant_id;
    END IF;
    
    -- Get credentials based on user role
    IF v_user_role IN ('admin', 'owner', 'super_admin') THEN
        -- Full credentials for admins
        SELECT jsonb_build_object(
            'tenant_id', sp.tenant_id,
            'subproject_id', sp.subproject_id,
            'subproject_token', sp.subproject_token,
            'space_url', sp.space_url,
            'status', sp.status,
            'created_at', sp.created_at
        ) INTO v_credentials
        FROM signalwire_subprojects sp
        WHERE sp.tenant_id = v_tenant_id;
    ELSE
        -- Limited info for regular users
        SELECT jsonb_build_object(
            'tenant_id', sp.tenant_id,
            'has_subproject', true,
            'status', sp.status
        ) INTO v_credentials
        FROM signalwire_subprojects sp
        WHERE sp.tenant_id = v_tenant_id;
    END IF;
    
    IF v_credentials IS NULL THEN
        RETURN jsonb_build_object(
            'tenant_id', v_tenant_id,
            'has_subproject', false,
            'message', 'No SignalWire subproject configured'
        );
    END IF;
    
    RETURN v_credentials;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_signalwire_subproject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_signalwire_credentials(uuid) TO authenticated;

-- Migrate existing data from tenants table to new subprojects table
INSERT INTO signalwire_subprojects (
    tenant_id,
    subproject_id,
    subproject_token,
    space_url,
    status,
    created_at,
    notes
)
SELECT 
    id,
    signalwire_subproject_id,
    signalwire_subproject_token,
    COALESCE(signalwire_subproject_space, 'taurustech.signalwire.com'),
    CASE 
        WHEN subproject_status = 'created' THEN 'active'
        ELSE COALESCE(subproject_status, 'pending')
    END,
    COALESCE(subproject_created_at, created_at),
    'Migrated from tenants table'
FROM tenants
WHERE signalwire_subproject_id IS NOT NULL 
  AND signalwire_subproject_token IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_signalwire_subprojects_tenant_id ON public.signalwire_subprojects(tenant_id);
CREATE INDEX idx_signalwire_subprojects_status ON public.signalwire_subprojects(status);

-- Skip the admin_notification_type enum update since it doesn't exist

-- Create a function to check if tenant needs subproject
CREATE OR REPLACE FUNCTION public.tenant_needs_signalwire_setup(
    p_tenant_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_tenant_id uuid;
    v_has_subproject boolean;
BEGIN
    -- Use provided tenant_id or get from current user
    IF p_tenant_id IS NOT NULL THEN
        v_tenant_id := p_tenant_id;
    ELSE
        SELECT tenant_id INTO v_tenant_id
        FROM user_profiles
        WHERE id = auth.uid();
    END IF;
    
    -- Check if subproject exists
    SELECT EXISTS(
        SELECT 1 
        FROM signalwire_subprojects 
        WHERE tenant_id = v_tenant_id 
        AND status = 'active'
    ) INTO v_has_subproject;
    
    RETURN NOT v_has_subproject;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_needs_signalwire_setup(uuid) TO authenticated;

-- Add helpful comments
COMMENT ON TABLE public.signalwire_subprojects IS 'Secure storage for SignalWire subproject credentials with proper RLS';
COMMENT ON FUNCTION public.create_signalwire_subproject IS 'Initiates SignalWire subproject creation for authorized users only';
COMMENT ON FUNCTION public.get_signalwire_credentials IS 'Securely retrieves SignalWire credentials based on user role';
COMMENT ON FUNCTION public.tenant_needs_signalwire_setup IS 'Checks if a tenant needs SignalWire configuration';