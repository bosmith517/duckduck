-- Add direct tenant_id to AI analysis table for better isolation
-- Migration: 20250701000013_add_tenant_id_to_ai_analysis.sql

-- Add tenant_id column to job_ai_analyses table
ALTER TABLE public.job_ai_analyses 
ADD COLUMN tenant_id uuid;

-- Populate tenant_id from the associated job's tenant_id
UPDATE public.job_ai_analyses 
SET tenant_id = (
  SELECT jobs.tenant_id 
  FROM public.jobs 
  WHERE jobs.id = job_ai_analyses.job_id
);

-- Make tenant_id NOT NULL after populating data
ALTER TABLE public.job_ai_analyses 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.job_ai_analyses
ADD CONSTRAINT job_ai_analyses_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_job_ai_analyses_tenant ON public.job_ai_analyses USING btree (tenant_id);

-- Update RLS policy to use direct tenant_id (simpler and more secure)
DROP POLICY IF EXISTS "Users can view AI analyses for their own tenant" ON public.job_ai_analyses;

CREATE POLICY "Users can view AI analyses for their own tenant" ON public.job_ai_analyses
FOR SELECT USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can insert AI analyses for their own tenant" ON public.job_ai_analyses
FOR INSERT WITH CHECK ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

CREATE POLICY "Users can update AI analyses for their own tenant" ON public.job_ai_analyses
FOR UPDATE USING ((
  SELECT user_profiles.tenant_id 
  FROM user_profiles 
  WHERE user_profiles.id = auth.uid()
) = tenant_id);

-- Comment explaining the purpose
COMMENT ON COLUMN public.job_ai_analyses.tenant_id IS 'Direct tenant isolation for AI analysis records';