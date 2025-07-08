-- FINAL DATABASE FIX - Ensure all tables have the correct columns

-- 1. Fix LEADS table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,  -- Frontend uses phone_number
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- If phone column exists but phone_number doesn't, rename it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number') THEN
        ALTER TABLE leads RENAME COLUMN phone TO phone_number;
    END IF;
END $$;

-- Update any null names
UPDATE leads 
SET name = COALESCE(email, phone_number, 'Unnamed Lead')
WHERE name IS NULL;

-- 2. Fix CONTACTS table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,  -- Contacts uses phone
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT;

-- Rename columns if they have different names
DO $$
BEGIN
    -- Rename address_line1 to address if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address_line1')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'address') THEN
        ALTER TABLE contacts RENAME COLUMN address_line1 TO address;
    END IF;
    
    -- Rename zip_code to zip if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip_code')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'zip') THEN
        ALTER TABLE contacts RENAME COLUMN zip_code TO zip;
    END IF;
END $$;

-- 3. Fix ACCOUNTS table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'customer',
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS billing_city TEXT,
ADD COLUMN IF NOT EXISTS billing_state TEXT,
ADD COLUMN IF NOT EXISTS billing_zip TEXT;

-- Rename type to account_type if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'type')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_type') THEN
        ALTER TABLE accounts RENAME COLUMN type TO account_type;
    END IF;
END $$;

-- 4. Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at 
BEFORE UPDATE ON leads 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 5. Grant permissions
GRANT ALL ON leads TO authenticated;
GRANT ALL ON contacts TO authenticated;
GRANT ALL ON accounts TO authenticated;
GRANT ALL ON calendar_events TO authenticated;

-- 6. Verify the fix
SELECT 
    'VERIFICATION COMPLETE' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'phone_number') as leads_has_phone_number,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'phone') as contacts_has_phone,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'account_type') as accounts_has_account_type,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'calendar_events') as calendar_events_exists;