-- Fix client_portal_tokens table structure to remove contact_id constraint
-- and properly handle customer_id which can be either account_id or contact_id

-- Only proceed if the table exists
DO $$ 
BEGIN
    -- Check if contact_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'client_portal_tokens' AND column_name = 'contact_id') THEN
        
        -- Drop the existing foreign key constraint on contact_id
        ALTER TABLE client_portal_tokens DROP CONSTRAINT IF EXISTS client_portal_tokens_contact_id_fkey;
        
        -- Make contact_id nullable since we're using customer_id instead
        ALTER TABLE client_portal_tokens ALTER COLUMN contact_id DROP NOT NULL;
        
        -- Add comment to clarify the structure
        COMMENT ON COLUMN client_portal_tokens.contact_id IS 'Optional - only populated if customer_id is a contact_id';
    END IF;
    
    -- Add comment for customer_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'client_portal_tokens' AND column_name = 'customer_id') THEN
        COMMENT ON COLUMN client_portal_tokens.customer_id IS 'Can reference either accounts.id or contacts.id depending on job assignment';
    END IF;
END $$;

-- Create index for better performance on customer_id lookups
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_customer_id ON client_portal_tokens(customer_id);