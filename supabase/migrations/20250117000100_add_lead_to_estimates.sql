-- Add lead_id column to estimates table to support lead-based estimates
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- Add job_id column to estimates table to support job-based estimates (change orders)
ALTER TABLE estimates 
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);

-- Add context_type to track how estimate was created
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS context_type VARCHAR(20) CHECK (context_type IN ('journey', 'job', 'standalone')) DEFAULT 'standalone';

-- Add version tracking
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_estimates_lead_id ON estimates(lead_id);
CREATE INDEX IF NOT EXISTS idx_estimates_job_id ON estimates(job_id);

-- Update RLS policies to include lead and job checks
DROP POLICY IF EXISTS "Users can view estimates from leads in their tenant" ON estimates;

CREATE POLICY "Users can view estimates from their tenant" ON estimates
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
);

-- Update insert policy
DROP POLICY IF EXISTS "Users can insert estimates for their tenant" ON estimates;

CREATE POLICY "Users can insert estimates for their tenant" ON estimates
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
);

-- Add comments explaining the relationships
COMMENT ON COLUMN estimates.lead_id IS 'Reference to lead when estimate is created in journey context';
COMMENT ON COLUMN estimates.job_id IS 'Reference to job when estimate is a change order';
COMMENT ON COLUMN estimates.context_type IS 'How the estimate was created: journey (from lead), job (change order), or standalone';
COMMENT ON COLUMN estimates.version IS 'Version number for tracking estimate revisions';

-- Success message
SELECT 'Estimates migration applied successfully!' as status;