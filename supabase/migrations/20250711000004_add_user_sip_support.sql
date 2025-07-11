-- Add user_id to sip_configurations for per-user SIP endpoints
ALTER TABLE public.sip_configurations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_sip_configurations_user_id ON public.sip_configurations(user_id);

-- Update RLS policies to include user-based access
DROP POLICY IF EXISTS "Users can view their own SIP configurations" ON public.sip_configurations;
CREATE POLICY "Users can view their own SIP configurations"
ON public.sip_configurations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  tenant_id IN (
    SELECT tenant_id FROM public.user_profiles WHERE id = auth.uid()
  )
);

-- Function to get or create user SIP configuration
CREATE OR REPLACE FUNCTION public.get_or_create_user_sip_config(
  p_user_id UUID,
  p_email TEXT,
  p_tenant_id UUID
)
RETURNS public.sip_configurations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sip_config public.sip_configurations;
  v_username TEXT;
  v_password TEXT;
  v_count INT;
BEGIN
  -- Check if user already has SIP config
  SELECT * INTO v_sip_config
  FROM public.sip_configurations
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN v_sip_config;
  END IF;
  
  -- Generate username from email
  v_username := LOWER(SPLIT_PART(p_email, '@', 1));
  v_username := REGEXP_REPLACE(v_username, '[^a-z0-9]', '', 'g');
  
  -- Check for username collisions
  SELECT COUNT(*) INTO v_count
  FROM public.sip_configurations
  WHERE sip_username = v_username;
  
  IF v_count > 0 THEN
    v_username := v_username || (v_count + 1)::TEXT;
  END IF;
  
  -- Generate password
  v_password := encode(gen_random_bytes(16), 'base64');
  
  -- Insert new SIP configuration
  INSERT INTO public.sip_configurations (
    user_id,
    tenant_id,
    sip_username,
    sip_password_encrypted,
    sip_domain,
    sip_proxy,
    is_active,
    service_plan,
    notes
  ) VALUES (
    p_user_id,
    p_tenant_id,
    v_username,
    v_password,
    'taurustech-tradeworkspro.sip.signalwire.com',
    'taurustech-tradeworkspro.sip.signalwire.com',
    true,
    'basic',
    'Auto-created user SIP endpoint'
  )
  RETURNING * INTO v_sip_config;
  
  RETURN v_sip_config;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_user_sip_config TO authenticated;

-- Update existing tenant-level configs to be associated with the first admin user
UPDATE public.sip_configurations sc
SET user_id = (
  SELECT up.id 
  FROM public.user_profiles up 
  WHERE up.tenant_id = sc.tenant_id 
  AND up.role = 'admin'
  ORDER BY up.created_at ASC
  LIMIT 1
)
WHERE sc.user_id IS NULL;