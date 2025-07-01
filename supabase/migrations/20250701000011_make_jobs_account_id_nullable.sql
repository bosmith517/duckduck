-- Make account_id nullable in jobs table to support individual customers
-- Migration: 20250701000011_make_jobs_account_id_nullable.sql

-- Drop the NOT NULL constraint on account_id
ALTER TABLE public.jobs 
ALTER COLUMN account_id DROP NOT NULL;

-- Add a check constraint to ensure either account_id or contact_id is provided
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_must_have_client_or_contact 
CHECK (account_id IS NOT NULL OR contact_id IS NOT NULL);

-- Comment explaining the change
COMMENT ON COLUMN public.jobs.account_id IS 'Business account ID (nullable - use contact_id for individual customers)';
COMMENT ON COLUMN public.jobs.contact_id IS 'Contact ID for individual customers or business contact person';

-- Update any existing indexes or constraints if needed
-- The foreign key constraint should already handle NULL values properly