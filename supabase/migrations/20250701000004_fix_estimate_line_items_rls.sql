-- Fix estimate_line_items RLS policy to match other tables pattern
-- Drop existing policies that might be problematic
DROP POLICY IF EXISTS "estimate_line_items_tenant_policy" ON "public"."estimate_line_items";

-- Create consistent RLS policies that match the pattern used by other tables
CREATE POLICY "Users can create estimate line items for their own tenant" ON "public"."estimate_line_items" 
FOR INSERT WITH CHECK ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can view estimate line items for their own tenant" ON "public"."estimate_line_items" 
FOR SELECT USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can update estimate line items for their own tenant" ON "public"."estimate_line_items" 
FOR UPDATE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can delete estimate line items for their own tenant" ON "public"."estimate_line_items" 
FOR DELETE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);