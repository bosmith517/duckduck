-- Add job_id column to estimates table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'estimates' 
                   AND column_name = 'job_id') THEN
        ALTER TABLE estimates 
        ADD COLUMN job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster lookups if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE indexname = 'idx_estimates_job_id') THEN
        CREATE INDEX idx_estimates_job_id ON estimates(job_id);
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN estimates.job_id IS 'Reference to the job created from this estimate';

-- Update the RLS policies to include job_id in selects
DROP POLICY IF EXISTS "Users can view estimates for their tenant" ON estimates;
CREATE POLICY "Users can view estimates for their tenant" ON estimates
FOR SELECT USING (tenant_id = auth.uid() OR tenant_id IN (
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
));