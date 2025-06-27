-- Create tracking tables step by step (SIMPLE APPROACH)

-- STEP 1: Fix the existing job_technician_locations table
-- Run this first, then check for errors before proceeding

-- Add missing columns one by one
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS technician_id UUID;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);

-- Update NULL values in new columns
UPDATE job_technician_locations 
SET 
  is_active = true,
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, created_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW()),
  expires_at = COALESCE(expires_at, created_at + INTERVAL '4 hours', NOW() + INTERVAL '4 hours'),
  tracking_token = COALESCE(tracking_token, 'track_' || encode(gen_random_bytes(16), 'hex'))
WHERE expires_at IS NULL OR tracking_token IS NULL;

-- Add foreign key constraint for technician_id (if it doesn't exist)
DO $$ 
BEGIN
    ALTER TABLE job_technician_locations 
    ADD CONSTRAINT fk_technician_id 
    FOREIGN KEY (technician_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END $$;

-- Add unique constraint for tracking_token
DO $$ 
BEGIN
    ALTER TABLE job_technician_locations 
    ADD CONSTRAINT tracking_token_unique UNIQUE(tracking_token);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END $$;