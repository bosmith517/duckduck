-- Migration: Enforce tight synchronization between leads, contacts, and accounts
-- This ensures no orphaned records and immediate relationship creation

-- First, let's update the existing lead to contact/account sync function to be more robust
CREATE OR REPLACE FUNCTION sync_lead_to_contact_account()
RETURNS TRIGGER AS $$
DECLARE
    v_contact_id UUID;
    v_account_id UUID;
BEGIN
    -- Skip if already has contact/account
    IF NEW.contact_id IS NOT NULL OR NEW.account_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Require minimum data for sync
    IF NEW.name IS NULL OR (NEW.phone IS NULL AND NEW.phone_number IS NULL) THEN
        RAISE EXCEPTION 'Lead must have name and phone to create contact/account';
    END IF;

    -- Determine contact type if not set
    IF NEW.contact_type IS NULL THEN
        NEW.contact_type := 'residential'; -- Default to residential
    END IF;

    -- Create contact or account based on type
    IF NEW.contact_type = 'residential' THEN
        -- Create or find contact
        INSERT INTO contacts (
            tenant_id,
            first_name,
            last_name,
            phone,
            email,
            address,
            city,
            state,
            zip,
            created_at,
            updated_at
        ) VALUES (
            NEW.tenant_id,
            split_part(COALESCE(NEW.name, NEW.caller_name, ''), ' ', 1),
            CASE 
                WHEN array_length(string_to_array(COALESCE(NEW.name, NEW.caller_name, ''), ' '), 1) > 1 
                THEN array_to_string(ARRAY(SELECT unnest(string_to_array(COALESCE(NEW.name, NEW.caller_name, ''), ' ')) OFFSET 1), ' ')
                ELSE ''
            END,
            COALESCE(NEW.phone, NEW.phone_number),
            NEW.email,
            COALESCE(NEW.full_address, NEW.street_address),
            NEW.city,
            NEW.state,
            NEW.zip_code,
            NOW(),
            NOW()
        )
        ON CONFLICT (tenant_id, phone) 
        DO UPDATE SET
            email = COALESCE(EXCLUDED.email, contacts.email),
            address = COALESCE(EXCLUDED.address, contacts.address),
            city = COALESCE(EXCLUDED.city, contacts.city),
            state = COALESCE(EXCLUDED.state, contacts.state),
            zip = COALESCE(EXCLUDED.zip, contacts.zip),
            updated_at = NOW()
        RETURNING id INTO v_contact_id;
        
        -- Update lead with contact_id
        NEW.contact_id := v_contact_id;
        
    ELSIF NEW.contact_type = 'business' THEN
        -- Create or find account
        INSERT INTO accounts (
            tenant_id,
            name,
            phone,
            email,
            billing_address,
            billing_city,
            billing_state,
            billing_zip,
            created_at,
            updated_at
        ) VALUES (
            NEW.tenant_id,
            COALESCE(NEW.company_name, NEW.name, NEW.caller_name),
            COALESCE(NEW.phone, NEW.phone_number),
            NEW.email,
            COALESCE(NEW.full_address, NEW.street_address),
            NEW.city,
            NEW.state,
            NEW.zip_code,
            NOW(),
            NOW()
        )
        ON CONFLICT (tenant_id, name) 
        DO UPDATE SET
            phone = COALESCE(EXCLUDED.phone, accounts.phone),
            email = COALESCE(EXCLUDED.email, accounts.email),
            billing_address = COALESCE(EXCLUDED.billing_address, accounts.billing_address),
            billing_city = COALESCE(EXCLUDED.billing_city, accounts.billing_city),
            billing_state = COALESCE(EXCLUDED.billing_state, accounts.billing_state),
            billing_zip = COALESCE(EXCLUDED.billing_zip, accounts.billing_zip),
            updated_at = NOW()
        RETURNING id INTO v_account_id;
        
        -- Update lead with account_id
        NEW.account_id := v_account_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BEFORE INSERT trigger to ensure lead has proper relationships
CREATE OR REPLACE FUNCTION before_lead_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure tenant_id is set
    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required for leads';
    END IF;
    
    -- Ensure contact_type is set
    IF NEW.contact_type IS NULL THEN
        NEW.contact_type := 'residential'; -- Default to residential
    END IF;
    
    -- Ensure name is set
    IF NEW.name IS NULL AND NEW.caller_name IS NULL THEN
        RAISE EXCEPTION 'Lead must have either name or caller_name';
    END IF;
    
    -- Normalize name field
    IF NEW.name IS NULL AND NEW.caller_name IS NOT NULL THEN
        NEW.name := NEW.caller_name;
    END IF;
    
    -- Ensure phone is set (normalize phone vs phone_number)
    IF NEW.phone IS NULL AND NEW.phone_number IS NOT NULL THEN
        NEW.phone := NEW.phone_number;
    ELSIF NEW.phone_number IS NULL AND NEW.phone IS NOT NULL THEN
        NEW.phone_number := NEW.phone;
    END IF;
    
    IF NEW.phone IS NULL THEN
        RAISE EXCEPTION 'Lead must have phone number';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS sync_lead_contacts_accounts ON leads;
DROP TRIGGER IF EXISTS before_lead_insert_trigger ON leads;

-- Create new triggers
CREATE TRIGGER before_lead_insert_trigger
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION before_lead_insert();

CREATE TRIGGER sync_lead_contacts_accounts
    BEFORE INSERT OR UPDATE OF name, phone, phone_number, email, contact_type, company_name
    ON leads
    FOR EACH ROW
    EXECUTE FUNCTION sync_lead_to_contact_account();

-- Add constraint to ensure leads have proper client reference
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_client_check;

ALTER TABLE leads
ADD CONSTRAINT leads_client_check
CHECK (
  (contact_type = 'residential' AND contact_id IS NOT NULL)
  OR
  (contact_type = 'business' AND account_id IS NOT NULL)
) NOT VALID;

-- Don't validate immediately to avoid breaking existing data
-- We'll fix existing data first, then validate

-- Fix existing leads that don't have contact/account
DO $$
DECLARE
    lead_record RECORD;
BEGIN
    FOR lead_record IN 
        SELECT * FROM leads 
        WHERE contact_id IS NULL AND account_id IS NULL
        AND name IS NOT NULL 
        AND (phone IS NOT NULL OR phone_number IS NOT NULL)
    LOOP
        -- Update the lead to trigger sync
        UPDATE leads 
        SET updated_at = NOW()
        WHERE id = lead_record.id;
    END LOOP;
END $$;

-- Now validate the constraint
ALTER TABLE leads VALIDATE CONSTRAINT leads_client_check;

-- Update estimates constraint to be more flexible during journey
ALTER TABLE estimates 
DROP CONSTRAINT IF EXISTS estimates_client_check;

ALTER TABLE estimates 
DROP CONSTRAINT IF EXISTS estimates_client_type_check;

-- New constraint that requires at least one client reference
ALTER TABLE estimates 
ADD CONSTRAINT estimates_client_check 
CHECK (
  account_id IS NOT NULL OR 
  contact_id IS NOT NULL OR 
  lead_id IS NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_sync_fields ON leads(tenant_id, contact_type, phone, phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_name ON accounts(tenant_id, name);

-- Add comments
COMMENT ON CONSTRAINT leads_client_check ON leads IS 
'Ensures lead has appropriate contact or account based on contact_type';

COMMENT ON FUNCTION sync_lead_to_contact_account() IS 
'Automatically creates and links contact or account records when lead is created/updated';

COMMENT ON FUNCTION before_lead_insert() IS 
'Validates and normalizes lead data before insertion';

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_lead_to_contact_account() TO authenticated;
GRANT EXECUTE ON FUNCTION before_lead_insert() TO authenticated;