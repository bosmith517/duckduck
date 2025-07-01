-- Add job_id column to estimates table to associate estimates with jobs
-- Migration: 20250701000010_add_job_id_to_estimates.sql

-- Add job_id column to estimates table (nullable for backward compatibility)
ALTER TABLE public.estimates 
ADD COLUMN job_id uuid;

-- Add foreign key constraint to ensure referential integrity
ALTER TABLE public.estimates
ADD CONSTRAINT estimates_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_estimates_job_id ON public.estimates USING btree (job_id);

-- Add index for tenant + job queries
CREATE INDEX idx_estimates_tenant_job ON public.estimates USING btree (tenant_id, job_id);

-- Comment explaining the purpose
COMMENT ON COLUMN public.estimates.job_id IS 'Links this estimate to a specific job. Nullable for backward compatibility with existing estimates.';