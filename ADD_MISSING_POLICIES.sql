-- ADD MISSING RLS POLICIES FOR EDITING LEADS AND RELATED DATA
-- This adds UPDATE and DELETE policies that were missing

DO $$
BEGIN
  -- Add missing UPDATE policy for call_logs
  DROP POLICY IF EXISTS "tenant_isolation_update" ON call_logs;
  CREATE POLICY "tenant_isolation_update" ON call_logs
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Add missing DELETE policy for call_logs  
  DROP POLICY IF EXISTS "tenant_isolation_delete" ON call_logs;
  CREATE POLICY "tenant_isolation_delete" ON call_logs
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

  -- Add missing UPDATE policy for lead_reminders
  DROP POLICY IF EXISTS "tenant_isolation_update" ON lead_reminders;
  CREATE POLICY "tenant_isolation_update" ON lead_reminders
    FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
  
  -- Add missing DELETE policy for lead_reminders
  DROP POLICY IF EXISTS "tenant_isolation_delete" ON lead_reminders;
  CREATE POLICY "tenant_isolation_delete" ON lead_reminders
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

  -- Add missing DELETE policy for leads (in case you want to delete leads)
  DROP POLICY IF EXISTS "tenant_isolation_delete" ON leads;
  CREATE POLICY "tenant_isolation_delete" ON leads
    FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));

  RAISE NOTICE '✅ Added missing UPDATE and DELETE policies';
  RAISE NOTICE 'Leads should now be fully editable!';
END $$;

-- Verify policies are in place
SELECT 
  'CURRENT RLS POLICIES FOR LEADS:' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'leads'
ORDER BY cmd, policyname;