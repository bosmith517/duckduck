-- Create table for storing AI analysis results
CREATE TABLE IF NOT EXISTS job_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('document', 'photos', 'full')),
  document_url TEXT,
  photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  analysis_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_ai_analyses_job_id ON job_ai_analyses(job_id);
CREATE INDEX IF NOT EXISTS idx_job_ai_analyses_created_at ON job_ai_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_ai_analyses_analysis_type ON job_ai_analyses(analysis_type);

-- Enable RLS
ALTER TABLE job_ai_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for job_ai_analyses
DO $$ 
BEGIN
  -- Check and create select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_ai_analyses' 
    AND policyname = 'Users can view AI analyses from their tenant'
  ) THEN
    CREATE POLICY "Users can view AI analyses from their tenant" ON job_ai_analyses
    FOR SELECT TO authenticated
    USING (
      job_id IN (
        SELECT j.id FROM jobs j
        JOIN user_profiles up ON up.tenant_id = j.tenant_id
        WHERE up.id = auth.uid()
      )
    );
  END IF;

  -- Check and create insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_ai_analyses' 
    AND policyname = 'Users can create AI analyses for their tenant jobs'
  ) THEN
    CREATE POLICY "Users can create AI analyses for their tenant jobs" ON job_ai_analyses
    FOR INSERT TO authenticated
    WITH CHECK (
      job_id IN (
        SELECT j.id FROM jobs j
        JOIN user_profiles up ON up.tenant_id = j.tenant_id
        WHERE up.id = auth.uid()
      )
      AND created_by = auth.uid()
    );
  END IF;

  -- Check and create update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_ai_analyses' 
    AND policyname = 'Users can update their own AI analyses'
  ) THEN
    CREATE POLICY "Users can update their own AI analyses" ON job_ai_analyses
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid());
  END IF;

  -- Check and create delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_ai_analyses' 
    AND policyname = 'Users can delete their own AI analyses'
  ) THEN
    CREATE POLICY "Users can delete their own AI analyses" ON job_ai_analyses
    FOR DELETE TO authenticated
    USING (created_by = auth.uid());
  END IF;
END $$;

-- Create a view for easier querying with job details
CREATE OR REPLACE VIEW job_ai_analyses_view AS
SELECT 
  jaa.*,
  j.title as job_title,
  j.description as job_description,
  j.status as job_status,
  up.first_name || ' ' || up.last_name as analyst_name
FROM job_ai_analyses jaa
JOIN jobs j ON j.id = jaa.job_id
LEFT JOIN user_profiles up ON up.id = jaa.created_by;

-- Grant access to the view
GRANT SELECT ON job_ai_analyses_view TO authenticated;