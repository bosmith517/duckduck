-- Add estimate_id column to jobs table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'jobs' 
                   AND column_name = 'estimate_id') THEN
        ALTER TABLE jobs 
        ADD COLUMN estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster lookups if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE indexname = 'idx_jobs_estimate_id') THEN
        CREATE INDEX idx_jobs_estimate_id ON jobs(estimate_id);
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN jobs.estimate_id IS 'Reference to the estimate this job was created from';

-- Update RLS policies to include estimate_id in selects
DROP POLICY IF EXISTS "Users can view jobs for their tenant" ON jobs;
CREATE POLICY "Users can view jobs for their tenant" ON jobs
FOR SELECT USING (tenant_id = auth.uid() OR tenant_id IN (
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
));