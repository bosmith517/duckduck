-- Create storage bucket for job photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true, -- Public bucket for easy access
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
) ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

-- Create RLS policies for the bucket (with IF NOT EXISTS checks)
DO $$ 
BEGIN
  -- Check and create read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Enable read access for all users job-photos'
  ) THEN
    CREATE POLICY "Enable read access for all users job-photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'job-photos');
  END IF;

  -- Check and create insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Enable upload for authenticated users job-photos'
  ) THEN
    CREATE POLICY "Enable upload for authenticated users job-photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'job-photos');
  END IF;

  -- Check and create update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Enable update for users based on tenant_id job-photos'
  ) THEN
    CREATE POLICY "Enable update for users based on tenant_id job-photos" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;

  -- Check and create delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Enable delete for users based on tenant_id job-photos'
  ) THEN
    CREATE POLICY "Enable delete for users based on tenant_id job-photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'job-photos' AND (storage.foldername(name))[1] IN (
      SELECT tenant_id::text FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;
END $$;

-- Create job_photos table if it doesn't exist
CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID REFERENCES jobs(id),
  cost_entry_id UUID,
  photo_type VARCHAR(50) NOT NULL CHECK (photo_type IN ('receipt', 'job_progress', 'before', 'after', 'general')),
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  taken_by UUID REFERENCES auth.users(id),
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS to job_photos table
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for job_photos with checks
DO $$ 
BEGIN
  -- Check and create select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_photos' 
    AND policyname = 'Users can view photos from their tenant'
  ) THEN
    CREATE POLICY "Users can view photos from their tenant" ON job_photos
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;

  -- Check and create insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_photos' 
    AND policyname = 'Users can insert photos for their tenant'
  ) THEN
    CREATE POLICY "Users can insert photos for their tenant" ON job_photos
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;

  -- Check and create update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_photos' 
    AND policyname = 'Users can update photos from their tenant'
  ) THEN
    CREATE POLICY "Users can update photos from their tenant" ON job_photos
    FOR UPDATE TO authenticated
    USING (tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;

  -- Check and create delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'job_photos' 
    AND policyname = 'Users can delete photos from their tenant'
  ) THEN
    CREATE POLICY "Users can delete photos from their tenant" ON job_photos
    FOR DELETE TO authenticated
    USING (tenant_id IN (
      SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
    ));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_photos_tenant_id ON job_photos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_taken_at ON job_photos(taken_at DESC);