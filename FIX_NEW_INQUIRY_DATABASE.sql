-- Fix New Inquiry Database Issues
-- Run this if New Inquiry isn't creating contacts/accounts

-- 1. Ensure all required columns exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS caller_type TEXT,
ADD COLUMN IF NOT EXISTS converted_contact_id UUID REFERENCES contacts(id),
ADD COLUMN IF NOT EXISTS converted_account_id UUID REFERENCES accounts(id);

-- 2. Update RLS policies to allow lead conversion
CREATE POLICY "Users can update their own leads for conversion" ON leads
    FOR UPDATE
    USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        tenant_id IN (SELECT tenant_id FROM user_profiles WHERE id = auth.uid())
    );

-- 3. Grant necessary permissions
GRANT INSERT ON contacts TO authenticated;
GRANT INSERT ON accounts TO authenticated;
GRANT UPDATE ON leads TO authenticated;

-- 4. Refresh the schema cache (if using PostgREST)
NOTIFY pgrst, 'reload schema';

SELECT 'New Inquiry database fixes applied!' as status;