-- Create testimonial_requests table
CREATE TABLE IF NOT EXISTS testimonial_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  access_token UUID DEFAULT gen_random_uuid() NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'completed', 'expired')),
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  request_sent_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  room_name TEXT,
  recording_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_testimonial_requests_tenant_id ON testimonial_requests(tenant_id);
CREATE INDEX idx_testimonial_requests_job_id ON testimonial_requests(job_id);
CREATE INDEX idx_testimonial_requests_access_token ON testimonial_requests(access_token);
CREATE INDEX idx_testimonial_requests_status ON testimonial_requests(status);

-- Enable Row Level Security
ALTER TABLE testimonial_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see testimonial requests for their tenant
CREATE POLICY "Users can view testimonial requests for their tenant" ON testimonial_requests
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Users can create testimonial requests for their tenant
CREATE POLICY "Users can create testimonial requests for their tenant" ON testimonial_requests
  FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Users can update testimonial requests for their tenant
CREATE POLICY "Users can update testimonial requests for their tenant" ON testimonial_requests
  FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Public access via token (for customers)
CREATE POLICY "Public can view testimonial requests via token" ON testimonial_requests
  FOR SELECT
  USING (access_token::text = current_setting('request.jwt.claims', true)::json->>'access_token');

-- Public can update their own testimonial via token
CREATE POLICY "Public can update testimonial requests via token" ON testimonial_requests
  FOR UPDATE
  USING (access_token::text = current_setting('request.jwt.claims', true)::json->>'access_token');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_testimonial_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_testimonial_requests_updated_at
  BEFORE UPDATE ON testimonial_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_testimonial_requests_updated_at();