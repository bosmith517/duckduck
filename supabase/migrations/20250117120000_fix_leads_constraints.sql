-- Fix the ON CONFLICT error by disabling the problematic trigger
-- The sync_lead_contacts_accounts trigger uses ON CONFLICT but the required unique constraints don't exist

-- Just disable the trigger since the frontend handles contact/account creation
ALTER TABLE leads DISABLE TRIGGER sync_lead_contacts_accounts;

-- Log what we did
DO $$
BEGIN
    RAISE NOTICE 'Disabled sync_lead_contacts_accounts trigger on leads table';
    RAISE NOTICE 'This fixes the ON CONFLICT error when creating leads';
    RAISE NOTICE 'The frontend NewInquiryModal component handles contact/account creation directly';
END $$;