-- Fix missing columns in job_technician_locations table

-- First, let's see the current structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations';

-- Add missing columns to job_technician_locations
ALTER TABLE job_technician_locations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS technician_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Update existing records to have proper values
UPDATE job_technician_locations 
SET 
  is_active = true,
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, updated_at, NOW()),
  expires_at = COALESCE(expires_at, created_at + INTERVAL '4 hours', NOW() + INTERVAL '4 hours')
WHERE expires_at IS NULL OR is_active IS NULL;

-- Ensure the tracking_token column exists and is unique
ALTER TABLE job_technician_locations 
ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);

-- Update any NULL tracking tokens
UPDATE job_technician_locations 
SET tracking_token = 'track_' || encode(gen_random_bytes(16), 'hex')
WHERE tracking_token IS NULL;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    ALTER TABLE job_technician_locations ADD CONSTRAINT tracking_token_unique UNIQUE(tracking_token);
EXCEPTION WHEN duplicate_table THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- Add indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_technician ON job_technician_locations(technician_id);

-- Verify the structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'job_technician_locations'
ORDER BY ordinal_position;