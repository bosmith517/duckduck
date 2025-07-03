-- Enhance Estimates table for advanced workflow management
-- Adding new status values, versioning, and parent-child relationships

-- First, update existing 'Draft' status records to lowercase 'draft'
UPDATE public.estimates 
SET status = 'draft' 
WHERE status = 'Draft';

-- Add version column for estimate revisions
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add parent_estimate_id for tracking estimate revisions
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS parent_estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL;

-- Add contact_id column to support individual customers (not just business accounts)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Make account_id nullable to support individual customers
ALTER TABLE public.estimates 
ALTER COLUMN account_id DROP NOT NULL;

-- Update the default status to lowercase
ALTER TABLE public.estimates 
ALTER COLUMN status SET DEFAULT 'draft';

-- Add index on parent_estimate_id for performance
CREATE INDEX IF NOT EXISTS idx_estimates_parent_estimate_id ON public.estimates(parent_estimate_id);

-- Add index on status for filtering
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);

-- Add index on version for revision tracking
CREATE INDEX IF NOT EXISTS idx_estimates_version ON public.estimates(version);

-- Add a check constraint to ensure either account_id or contact_id is provided
ALTER TABLE public.estimates 
ADD CONSTRAINT estimates_client_check 
CHECK (account_id IS NOT NULL OR contact_id IS NOT NULL);

-- Add comment to document the new workflow statuses
COMMENT ON COLUMN public.estimates.status IS 'Estimate workflow status: draft, sent, pending_review, awaiting_site_visit, site_visit_scheduled, under_negotiation, revised, approved, rejected, expired';

COMMENT ON COLUMN public.estimates.version IS 'Version number for estimate revisions, increments with each revision';

COMMENT ON COLUMN public.estimates.parent_estimate_id IS 'References the original estimate if this is a revision';

COMMENT ON COLUMN public.estimates.contact_id IS 'For individual customers (alternative to account_id for businesses)';