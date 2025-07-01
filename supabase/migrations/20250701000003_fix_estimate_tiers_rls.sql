-- Fix estimate_tiers RLS policy to match other tables pattern
-- Drop the existing problematic policy
DROP POLICY IF EXISTS "estimate_tiers_tenant_policy" ON "public"."estimate_tiers";

-- Create consistent RLS policies that match the pattern used by other tables
CREATE POLICY "Users can create estimate tiers for their own tenant" ON "public"."estimate_tiers" 
FOR INSERT WITH CHECK ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can view estimate tiers for their own tenant" ON "public"."estimate_tiers" 
FOR SELECT USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can update estimate tiers for their own tenant" ON "public"."estimate_tiers" 
FOR UPDATE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can delete estimate tiers for their own tenant" ON "public"."estimate_tiers" 
FOR DELETE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);