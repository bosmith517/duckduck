-- Fix estimates table to support both business accounts and individual customers (corrected)
-- Migration: 20250701000014_fix_estimates_for_individual_customers_corrected.sql

-- Add foreign key constraint for contact_id (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimates_contact_id_fkey') THEN
        ALTER TABLE public.estimates
        ADD CONSTRAINT estimates_contact_id_fkey 
        FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Make account_id nullable to support individual customers
ALTER TABLE public.estimates 
ALTER COLUMN account_id DROP NOT NULL;

-- Add check constraint to ensure either account_id or contact_id is provided (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimates_must_have_client_or_contact') THEN
        ALTER TABLE public.estimates
        ADD CONSTRAINT estimates_must_have_client_or_contact 
        CHECK (account_id IS NOT NULL OR contact_id IS NOT NULL);
    END IF;
END $$;

-- Add indexes for better query performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON public.estimates USING btree (contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_contact ON public.estimates USING btree (tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_account ON public.estimates USING btree (tenant_id, account_id);

-- Update column comments
COMMENT ON COLUMN public.estimates.account_id IS 'Business account ID (nullable - for B2B customers)';
COMMENT ON COLUMN public.estimates.contact_id IS 'Contact ID (nullable - for individual customers or business contact person)';