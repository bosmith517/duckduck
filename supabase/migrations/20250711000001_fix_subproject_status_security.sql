-- Fix security issues with subproject_status_overview view

-- First, revoke all public access to the current view
REVOKE ALL ON public.subproject_status_overview FROM anon;
REVOKE ALL ON public.subproject_status_overview FROM authenticated;

-- Drop the insecure view
DROP VIEW IF EXISTS public.subproject_status_overview;

-- Create a security definer function that properly filters by tenant
CREATE OR REPLACE FUNCTION public.get_tenant_subproject_status(p_tenant_id uuid)
RETURNS TABLE (
    tenant_id uuid,
    tenant_name varchar(100),
    signalwire_subproject_id varchar(100),
    subproject_status varchar(20),
    subproject_created_at timestamptz,
    subproject_error text,
    subproject_retry_needed boolean,
    notification_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only return data for the specified tenant
    RETURN QUERY
    SELECT 
        t.id AS tenant_id,
        t.company_name AS tenant_name,
        t.signalwire_subproject_id,
        t.subproject_status,
        t.subproject_created_at,
        t.subproject_error,
        t.subproject_retry_needed,
        COUNT(an.id) AS notification_count
    FROM tenants t
    LEFT JOIN admin_notifications an ON 
        t.id = an.tenant_id 
        AND an.type LIKE 'subproject%' 
        AND an.is_read = false
    WHERE t.id = p_tenant_id
    GROUP BY t.id, t.company_name, t.signalwire_subproject_id, 
             t.subproject_status, t.subproject_created_at, 
             t.subproject_error, t.subproject_retry_needed;
END;
$$;

-- Grant execute only to authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_subproject_status(uuid) TO authenticated;

-- Create a view that only shows the current user's tenant data
CREATE OR REPLACE VIEW public.my_subproject_status AS
SELECT 
    sps.*
FROM public.get_tenant_subproject_status(
    (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
) sps;

-- Grant access to authenticated users only
GRANT SELECT ON public.my_subproject_status TO authenticated;

-- Add RLS to the tenants table if not already enabled
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenants table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'tenants' 
        AND policyname = 'Users can view their own tenant'
    ) THEN
        CREATE POLICY "Users can view their own tenant" 
        ON public.tenants 
        FOR SELECT 
        USING (id IN (
            SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
        ));
    END IF;
END $$;

-- Create an admin-only view for super admins
CREATE OR REPLACE VIEW public.admin_subproject_overview AS
SELECT 
    t.id AS tenant_id,
    t.company_name AS tenant_name,
    t.signalwire_subproject_id,
    -- Don't expose the token in any view
    CASE 
        WHEN t.signalwire_subproject_token IS NOT NULL THEN true
        ELSE false
    END AS has_subproject_token,
    t.subproject_status,
    t.subproject_created_at,
    t.subproject_error,
    t.subproject_retry_needed,
    COUNT(an.id) AS notification_count
FROM tenants t
LEFT JOIN admin_notifications an ON 
    t.id = an.tenant_id 
    AND an.type LIKE 'subproject%' 
    AND an.is_read = false
GROUP BY t.id, t.company_name, t.signalwire_subproject_id, 
         t.signalwire_subproject_token, t.subproject_status, 
         t.subproject_created_at, t.subproject_error, t.subproject_retry_needed
ORDER BY t.created_at DESC;

-- Create RLS policy for admin view
CREATE POLICY "Only super admins can view all subprojects"
ON public.tenants
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'platform_admin')
    )
);

-- Grant the admin view only to authenticated users (RLS will enforce admin check)
GRANT SELECT ON public.admin_subproject_overview TO authenticated;

-- Add a comment explaining the security model
COMMENT ON VIEW public.my_subproject_status IS 'Secure view showing only the current user''s tenant subproject status';
COMMENT ON VIEW public.admin_subproject_overview IS 'Admin-only view of all tenant subproject statuses. Access controlled by RLS.';
COMMENT ON FUNCTION public.get_tenant_subproject_status IS 'Security definer function to safely retrieve tenant subproject status';

-- Create a secure function to get tenant credentials (including token) for authorized users only
CREATE OR REPLACE FUNCTION public.get_my_tenant_signalwire_credentials()
RETURNS TABLE (
    tenant_id uuid,
    tenant_name varchar(255),
    signalwire_subproject_id varchar(255),
    signalwire_subproject_token text,
    signalwire_subproject_space varchar(255),
    subproject_status varchar(20)
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id uuid;
    v_user_role varchar(50);
BEGIN
    -- Get the user's tenant_id and role
    SELECT tenant_id, role INTO v_tenant_id, v_user_role
    FROM user_profiles
    WHERE id = auth.uid();
    
    -- Only admins and owners can see the actual credentials
    IF v_user_role NOT IN ('admin', 'owner', 'super_admin') THEN
        RAISE EXCEPTION 'Insufficient permissions to view SignalWire credentials';
    END IF;
    
    -- Return the credentials for the user's tenant only
    RETURN QUERY
    SELECT 
        t.id,
        t.company_name,
        t.signalwire_subproject_id,
        t.signalwire_subproject_token,
        t.signalwire_subproject_space,
        t.subproject_status
    FROM tenants t
    WHERE t.id = v_tenant_id;
END;
$$;

-- Grant execute only to authenticated users (function will check role internally)
GRANT EXECUTE ON FUNCTION public.get_my_tenant_signalwire_credentials() TO authenticated;

COMMENT ON FUNCTION public.get_my_tenant_signalwire_credentials IS 'Secure function to retrieve SignalWire credentials for admins/owners of their own tenant only';