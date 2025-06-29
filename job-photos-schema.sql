-- Job Photos Schema for TradeWorks Pro
-- Stores photos taken during jobs, including receipts, progress photos, before/after shots

-- Create job_photos table
CREATE TABLE public.job_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid,
  cost_entry_id uuid,
  photo_type character varying NOT NULL CHECK (photo_type IN ('receipt', 'job_progress', 'before', 'after', 'general')),
  file_path text NOT NULL,
  file_url text NOT NULL,
  description text,
  latitude numeric,
  longitude numeric,
  taken_by uuid,
  taken_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (cost_entry_id) REFERENCES job_costs(id) ON DELETE CASCADE,
  FOREIGN KEY (taken_by) REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_job_photos_tenant_id ON job_photos(tenant_id);
CREATE INDEX idx_job_photos_job_id ON job_photos(job_id);
CREATE INDEX idx_job_photos_cost_entry_id ON job_photos(cost_entry_id);
CREATE INDEX idx_job_photos_photo_type ON job_photos(photo_type);
CREATE INDEX idx_job_photos_taken_at ON job_photos(taken_at DESC);

-- Enable Row Level Security
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY "job_photos_tenant_isolation" ON "public"."job_photos"
AS PERMISSIVE FOR ALL TO authenticated
USING ((tenant_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'tenant_id'::text)::uuid));

-- Grant permissions
GRANT ALL ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;

-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', true);

-- Storage policies for job photos
CREATE POLICY "Job photos upload policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Job photos select policy" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'job-photos');

CREATE POLICY "Job photos update policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'job-photos');

CREATE POLICY "Job photos delete policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'job-photos');

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER trigger_update_job_photos_updated_at
  BEFORE UPDATE ON public.job_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_job_photos_updated_at();

-- Create a view for job photos with additional metadata
CREATE OR REPLACE VIEW job_photos_view AS
SELECT 
  jp.*,
  j.job_number,
  j.title as job_title,
  jc.description as cost_description,
  jc.cost_type,
  up.first_name || ' ' || up.last_name as taken_by_name
FROM job_photos jp
LEFT JOIN jobs j ON jp.job_id = j.id
LEFT JOIN job_costs jc ON jp.cost_entry_id = jc.id
LEFT JOIN user_profiles up ON jp.taken_by = up.id;

-- Grant access to the view
GRANT SELECT ON job_photos_view TO authenticated;
GRANT SELECT ON job_photos_view TO service_role;