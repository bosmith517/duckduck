-- Clean up duplicate relationships between leads and accounts/contacts

-- First, let's check what data exists in these columns
DO $$
DECLARE
    converted_account_count INTEGER;
    converted_contact_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO converted_account_count 
    FROM leads WHERE converted_account_id IS NOT NULL;
    
    SELECT COUNT(*) INTO converted_contact_count 
    FROM leads WHERE converted_contact_id IS NOT NULL;
    
    RAISE NOTICE 'Leads with converted_account_id: %', converted_account_count;
    RAISE NOTICE 'Leads with converted_contact_id: %', converted_contact_count;
END $$;

-- Migrate data from converted_account_id to account_id if needed
UPDATE leads 
SET account_id = converted_account_id 
WHERE converted_account_id IS NOT NULL 
  AND account_id IS NULL;

-- Migrate data from converted_contact_id to contact_id if needed
UPDATE leads 
SET contact_id = converted_contact_id 
WHERE converted_contact_id IS NOT NULL 
  AND contact_id IS NULL;

-- Drop the foreign key constraints for the duplicate columns
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_converted_account_id_fkey;

ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_converted_contact_id_fkey;

-- Drop the duplicate columns
ALTER TABLE leads 
DROP COLUMN IF EXISTS converted_account_id;

ALTER TABLE leads 
DROP COLUMN IF EXISTS converted_contact_id;

-- Also clean up other redundant contact-related columns if they're not being used
-- These seem to be duplicates of existing functionality
ALTER TABLE leads 
DROP COLUMN IF EXISTS preferred_contact_method;

ALTER TABLE leads 
DROP COLUMN IF EXISTS best_time_to_contact;

ALTER TABLE leads 
DROP COLUMN IF EXISTS preferred_contact_time;

-- Verify we now have only one relationship to each table
DO $$
DECLARE
    fk_record RECORD;
BEGIN
    RAISE NOTICE 'Remaining foreign keys from leads to accounts/contacts:';
    
    FOR fk_record IN
        SELECT
            conname AS constraint_name,
            a.attname AS column_name,
            confrelid::regclass AS foreign_table_name
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.contype = 'f'
            AND c.conrelid = 'leads'::regclass
            AND c.confrelid IN ('accounts'::regclass, 'contacts'::regclass)
    LOOP
        RAISE NOTICE '  - %.% -> %', 
            'leads',
            fk_record.column_name,
            fk_record.foreign_table_name;
    END LOOP;
END $$;

-- Add comment to document the proper relationships
COMMENT ON COLUMN leads.account_id IS 'Primary reference to business accounts';
COMMENT ON COLUMN leads.contact_id IS 'Primary reference to residential contacts';
COMMENT ON COLUMN leads.contact_type IS 'Determines whether this lead is for a business (account) or residential (contact) customer';