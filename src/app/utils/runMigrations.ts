// Database migration utility for tracking tables
import { supabase } from '../../supabaseClient'

const migrations = {
  // Migration 1: Create tracking tables that work with existing schema
  createTrackingTables: `
-- Create tracking tables that work with your existing schema

-- 1. Your job_technician_locations table already exists and has most columns we need!
-- Let's just verify it has everything and add what's missing:

-- Add any missing columns (most should already exist)
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS technician_id UUID;

-- 2. Create job_status_updates table (using your existing column names)
CREATE TABLE IF NOT EXISTS job_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE, -- Using your existing user_id pattern
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Status information
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    status_notes TEXT,
    
    -- Location context (captured automatically when status changes)
    location_latitude NUMERIC,
    location_longitude NUMERIC,
    location_accuracy NUMERIC,
    
    -- Timestamps (matching your existing pattern)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update the existing location_logs table to match our needs
-- Your location_logs table exists but is missing some columns we need
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS speed NUMERIC;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS heading INTEGER;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS accuracy NUMERIC;
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS data_retention_category VARCHAR(50) DEFAULT 'business_records';
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
`,

  // Migration 2: Update NULL values
  updateNullValues: `
-- 4. Update any NULL values in the tracking table
UPDATE job_technician_locations 
SET 
  is_active = COALESCE(is_active, true),
  started_at = COALESCE(started_at, created_at, NOW()),
  last_updated = COALESCE(last_updated, created_at, NOW()),
  updated_at = COALESCE(updated_at, created_at, NOW()),
  technician_id = COALESCE(technician_id, user_id) -- Use existing user_id if technician_id is null
WHERE is_active IS NULL OR started_at IS NULL OR last_updated IS NULL OR updated_at IS NULL OR technician_id IS NULL;
`,

  // Migration 3: Add foreign key constraints
  addForeignKeys: `
-- 5. Add foreign key constraints that match your existing pattern
DO $$
BEGIN
    -- Add foreign key for job_status_updates.job_id to jobs table
    BEGIN
        ALTER TABLE job_status_updates 
        ADD CONSTRAINT fk_job_status_updates_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;

    -- Add foreign key for location_logs.job_id to jobs table  
    BEGIN
        ALTER TABLE location_logs 
        ADD CONSTRAINT fk_location_logs_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;

    -- Add foreign key for job_technician_locations.job_id to jobs table (if not exists)
    BEGIN
        ALTER TABLE job_technician_locations 
        ADD CONSTRAINT fk_job_technician_locations_job_id 
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Constraint already exists
    END;
END
$$;
`,

  // Migration 4: Add indexes and permissions
  addIndexesAndPermissions: `
-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_job_status_updates_job_id ON job_status_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_user ON job_status_updates(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_job_status_updates_tenant ON job_status_updates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_location_logs_job_id ON location_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_tracking_token ON location_logs(tracking_token);
CREATE INDEX IF NOT EXISTS idx_location_logs_logged_at ON location_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_location_logs_user_date ON location_logs(user_id, logged_at);

CREATE INDEX IF NOT EXISTS idx_job_technician_locations_tracking_token ON job_technician_locations(tracking_token);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_job_id ON job_technician_locations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_active ON job_technician_locations(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_job_technician_locations_user ON job_technician_locations(user_id);

-- 7. Enable RLS on all tables
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- 8. Grant permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;
GRANT SELECT, INSERT ON job_status_updates TO authenticated;
GRANT SELECT ON location_logs TO authenticated;
`,

  // Migration 5: Create RLS policies
  createPolicies: `
-- Drop all existing tracking policies to start fresh
DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can update their own location" ON job_technician_locations;
DROP POLICY IF EXISTS "Authenticated users can insert tracking data" ON job_technician_locations;
DROP POLICY IF EXISTS "System can deactivate expired sessions" ON job_technician_locations;

DROP POLICY IF EXISTS "Technicians can insert status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Admins can view all status updates" ON job_status_updates;

DROP POLICY IF EXISTS "Technicians can view their own location history" ON location_logs;
DROP POLICY IF EXISTS "Admins can view all location logs" ON location_logs;
DROP POLICY IF EXISTS "Authenticated users can insert location logs" ON location_logs;
DROP POLICY IF EXISTS "Admins can archive location logs" ON location_logs;

-- Create policies for job_technician_locations
CREATE POLICY "Public read access with tracking token" ON job_technician_locations
    FOR SELECT 
    USING (
        is_active = true 
        AND expires_at > NOW()
        AND tracking_token IS NOT NULL
    );

CREATE POLICY "Technicians can update their own location" ON job_technician_locations
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert tracking data" ON job_technician_locations
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Create policies for job_status_updates
CREATE POLICY "Technicians can insert status updates" ON job_status_updates
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Technicians can view their own status updates" ON job_status_updates
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all status updates" ON job_status_updates
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Create policies for location_logs
CREATE POLICY "Technicians can view their own location history" ON location_logs
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all location logs" ON location_logs
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;
`
}

export async function runTrackingMigrations() {
  console.log('Starting tracking migrations...')
  
  try {
    // Migration 1: Create tables and add columns
    console.log('Running migration 1: Creating tracking tables...')
    const { error: error1 } = await supabase.rpc('exec_sql', { 
      sql: migrations.createTrackingTables 
    })
    if (error1) {
      console.error('Migration 1 failed:', error1)
      return { success: false, error: error1 }
    }

    // Migration 2: Update NULL values
    console.log('Running migration 2: Updating NULL values...')
    const { error: error2 } = await supabase.rpc('exec_sql', { 
      sql: migrations.updateNullValues 
    })
    if (error2) {
      console.error('Migration 2 failed:', error2)
      return { success: false, error: error2 }
    }

    // Migration 3: Add foreign keys
    console.log('Running migration 3: Adding foreign key constraints...')
    const { error: error3 } = await supabase.rpc('exec_sql', { 
      sql: migrations.addForeignKeys 
    })
    if (error3) {
      console.error('Migration 3 failed:', error3)
      return { success: false, error: error3 }
    }

    // Migration 4: Add indexes and permissions
    console.log('Running migration 4: Adding indexes and permissions...')
    const { error: error4 } = await supabase.rpc('exec_sql', { 
      sql: migrations.addIndexesAndPermissions 
    })
    if (error4) {
      console.error('Migration 4 failed:', error4)
      return { success: false, error: error4 }
    }

    // Migration 5: Create RLS policies
    console.log('Running migration 5: Creating RLS policies...')
    const { error: error5 } = await supabase.rpc('exec_sql', { 
      sql: migrations.createPolicies 
    })
    if (error5) {
      console.error('Migration 5 failed:', error5)
      return { success: false, error: error5 }
    }

    console.log('All migrations completed successfully!')
    return { success: true }

  } catch (error) {
    console.error('Migration failed:', error)
    return { success: false, error }
  }
}

// Function to check current schema
export async function checkCurrentSchema() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            'job_technician_locations' as table_name,
            column_name, 
            data_type, 
            is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'job_technician_locations'
        ORDER BY ordinal_position;
      `
    })

    if (error) {
      console.error('Schema check failed:', error)
      return { success: false, error }
    }

    console.log('Current schema:', data)
    return { success: true, data }
  } catch (error) {
    console.error('Schema check failed:', error)
    return { success: false, error }
  }
}