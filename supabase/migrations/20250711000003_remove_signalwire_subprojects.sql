-- Remove all SignalWire subproject functionality
-- Simplify to use only main project credentials

-- Drop the subproject views first
DROP VIEW IF EXISTS public.subproject_status_overview CASCADE;
DROP VIEW IF EXISTS public.admin_subproject_overview CASCADE;
DROP VIEW IF EXISTS public.my_subproject_status CASCADE;

-- Drop any subproject-related functions
DROP FUNCTION IF EXISTS public.get_tenant_subproject_status(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_tenant_signalwire_credentials() CASCADE;
DROP FUNCTION IF EXISTS public.create_signalwire_subproject(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_signalwire_credentials(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.tenant_needs_signalwire_setup(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.auto_create_signalwire_subproject() CASCADE;

-- Drop the new subprojects table if it was created
DROP TABLE IF EXISTS public.signalwire_subprojects CASCADE;

-- Remove subproject columns from tenants table
ALTER TABLE public.tenants 
  DROP COLUMN IF EXISTS signalwire_subproject_id,
  DROP COLUMN IF EXISTS signalwire_subproject_token,
  DROP COLUMN IF EXISTS signalwire_subproject_space,
  DROP COLUMN IF EXISTS subproject_status,
  DROP COLUMN IF EXISTS subproject_created_at,
  DROP COLUMN IF EXISTS subproject_error,
  DROP COLUMN IF EXISTS subproject_retry_needed;

-- Remove any triggers related to subprojects
DROP TRIGGER IF EXISTS trigger_create_signalwire_subproject ON public.tenants;

-- Clean up admin_notifications that were subproject-related
DELETE FROM public.admin_notifications 
WHERE type IN ('subproject_failed', 'subproject_retry_needed', 'subproject_created', 'subproject_pending_creation');

-- Create a simple function to check if main SignalWire is configured
CREATE OR REPLACE FUNCTION public.is_signalwire_configured()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT true; -- Always return true since we're using main project
$$;

GRANT EXECUTE ON FUNCTION public.is_signalwire_configured() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.is_signalwire_configured IS 'Simple check that SignalWire is available (always true for main project usage)';

-- Migration complete - removed all subproject functionality