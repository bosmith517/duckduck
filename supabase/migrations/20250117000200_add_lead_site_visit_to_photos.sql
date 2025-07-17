-- Add lead_id column to job_photos table
ALTER TABLE job_photos 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_job_photos_lead_id ON job_photos(lead_id);

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view photos from leads in their tenant" ON job_photos;

-- Update RLS policies to include lead checks
CREATE POLICY "Users can view photos from leads in their tenant" ON job_photos
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
  AND (
    -- Either job_id or lead_id must belong to tenant
    (job_id IS NOT NULL AND job_id IN (
      SELECT id FROM jobs WHERE tenant_id = job_photos.tenant_id
    ))
    OR
    (lead_id IS NOT NULL AND lead_id IN (
      SELECT id FROM leads WHERE tenant_id = job_photos.tenant_id
    ))
  )
);

-- Update insert policy to allow photos for leads and jobs
DROP POLICY IF EXISTS "Users can insert photos for their tenant" ON job_photos;

CREATE POLICY "Users can insert photos for their tenant" ON job_photos
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  )
  AND (
    -- Must have at least one of: job_id or lead_id
    job_id IS NOT NULL OR lead_id IS NOT NULL
  )
);

-- Update photo_type check constraint to include site visit types
ALTER TABLE job_photos 
DROP CONSTRAINT IF EXISTS job_photos_photo_type_check;

ALTER TABLE job_photos 
ADD CONSTRAINT job_photos_photo_type_check 
CHECK (photo_type IN ('receipt', 'job_progress', 'before', 'after', 'general', 'site_assessment', 'damage', 'measurement'));

-- Add comment explaining the relationships
COMMENT ON COLUMN job_photos.lead_id IS 'Reference to lead when photo is taken before job creation';
COMMENT ON COLUMN job_photos.job_id IS 'Reference to job when photo is taken during job execution';