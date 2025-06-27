import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const TrackingMigrationPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [migrationStep, setMigrationStep] = useState(0)

  // Step 1: Check current schema
  const checkCurrentSchema = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      console.log('Checking current schema...')

      // Check job_technician_locations table structure
      const { data: trackingData, error: trackingError } = await supabase
        .from('job_technician_locations')
        .select('*')
        .limit(1)

      // Check if location_logs table exists
      const { data: logsData, error: logsError } = await supabase
        .from('location_logs')
        .select('*')
        .limit(1)

      // Check if jobs table exists
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .limit(1)

      setResults({
        jobTracking: { exists: !trackingError, error: trackingError },
        locationLogs: { exists: !logsError, error: logsError },
        jobs: { exists: !jobsError, error: jobsError }
      })

    } catch (err: any) {
      console.error('Schema check error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Add missing columns to existing tables
  const addMissingColumns = async () => {
    setLoading(true)
    setError(null)
    setMigrationStep(1)

    try {
      console.log('Adding missing columns...')

      // We can't run DDL statements directly through Supabase client
      // Instead, let's check what columns exist and show what needs to be run
      
      const columnsToAdd = [
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS job_id UUID;',
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;',
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
        'ALTER TABLE job_technician_locations ADD COLUMN IF NOT EXISTS technician_id UUID;',
        '',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS job_id UUID;',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(255);',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS speed NUMERIC;',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS heading INTEGER;',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS accuracy NUMERIC;',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS data_retention_category VARCHAR(50) DEFAULT \'business_records\';',
        'ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;'
      ]

      setResults({
        message: 'Please run these SQL statements in Supabase SQL Editor:',
        sql: columnsToAdd.join('\n')
      })

    } catch (err: any) {
      console.error('Column addition error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Create job_status_updates table
  const createJobStatusTable = async () => {
    setLoading(true)
    setError(null)
    setMigrationStep(2)

    try {
      const sql = `
CREATE TABLE IF NOT EXISTS job_status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
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
);`

      setResults({
        message: 'Please run this SQL statement in Supabase SQL Editor:',
        sql: sql
      })

    } catch (err: any) {
      console.error('Table creation error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Add indexes and constraints
  const addIndexesAndConstraints = async () => {
    setLoading(true)
    setError(null)
    setMigrationStep(3)

    try {
      const sql = `
-- Add foreign key constraints
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

-- Add performance indexes
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

-- Enable RLS on all tables
ALTER TABLE job_technician_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON job_technician_locations TO anon, authenticated;
GRANT INSERT, UPDATE ON job_technician_locations TO authenticated;
GRANT SELECT, INSERT ON job_status_updates TO authenticated;
GRANT SELECT ON location_logs TO authenticated;`

      setResults({
        message: 'Please run this SQL statement in Supabase SQL Editor:',
        sql: sql
      })

    } catch (err: any) {
      console.error('Indexes and constraints error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 5: Create RLS policies
  const createRLSPolicies = async () => {
    setLoading(true)
    setError(null)
    setMigrationStep(4)

    try {
      const sql = `
-- Drop all existing tracking policies to start fresh
DROP POLICY IF EXISTS "Public read access with tracking token" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can update their own location" ON job_technician_locations;
DROP POLICY IF EXISTS "Authenticated users can insert tracking data" ON job_technician_locations;
DROP POLICY IF EXISTS "Technicians can insert status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Admins can view all status updates" ON job_status_updates;
DROP POLICY IF EXISTS "Technicians can view their own location history" ON location_logs;
DROP POLICY IF EXISTS "Admins can view all location logs" ON location_logs;

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
ALTER PUBLICATION supabase_realtime ADD TABLE job_technician_locations;`

      setResults({
        message: 'Please run this SQL statement in Supabase SQL Editor:',
        sql: sql
      })

    } catch (err: any) {
      console.error('RLS policies error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Test the migration results
  const testMigrations = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Testing migration results...')

      // Test job_status_updates table
      const { data: statusData, error: statusError } = await supabase
        .from('job_status_updates')
        .select('*')
        .limit(1)

      // Test location_logs with new columns
      const { data: logsData, error: logsError } = await supabase
        .from('location_logs')
        .select('tracking_token, job_id, logged_at')
        .limit(1)

      // Test job_technician_locations
      const { data: trackingData, error: trackingError } = await supabase
        .from('job_technician_locations')
        .select('job_id, is_active, tracking_token')
        .limit(1)

      setResults({
        jobStatusUpdates: { exists: !statusError, error: statusError },
        locationLogsUpdated: { exists: !logsError, error: logsError },
        trackingUpdated: { exists: !trackingError, error: trackingError },
        message: 'Migration test complete! Check results above.'
      })

    } catch (err: any) {
      console.error('Migration test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tracking Tables Migration</h3>
        </div>
        <div className="card-body">
          <p>Use this page to migrate your database for the "On My Way" tracking feature.</p>
          
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <button 
                className="btn btn-primary w-100" 
                onClick={checkCurrentSchema}
                disabled={loading}
              >
                {loading && migrationStep === 0 ? 'Checking...' : '1. Check Current Schema'}
              </button>
            </div>
            
            <div className="col-md-6">
              <button 
                className="btn btn-secondary w-100" 
                onClick={addMissingColumns}
                disabled={loading}
              >
                {loading && migrationStep === 1 ? 'Processing...' : '2. Add Missing Columns'}
              </button>
            </div>
            
            <div className="col-md-6">
              <button 
                className="btn btn-secondary w-100" 
                onClick={createJobStatusTable}
                disabled={loading}
              >
                {loading && migrationStep === 2 ? 'Processing...' : '3. Create Status Table'}
              </button>
            </div>
            
            <div className="col-md-6">
              <button 
                className="btn btn-secondary w-100" 
                onClick={addIndexesAndConstraints}
                disabled={loading}
              >
                {loading && migrationStep === 3 ? 'Processing...' : '4. Add Indexes & Constraints'}
              </button>
            </div>
            
            <div className="col-md-6">
              <button 
                className="btn btn-secondary w-100" 
                onClick={createRLSPolicies}
                disabled={loading}
              >
                {loading && migrationStep === 4 ? 'Processing...' : '5. Create RLS Policies'}
              </button>
            </div>
            
            <div className="col-md-6">
              <button 
                className="btn btn-success w-100" 
                onClick={testMigrations}
                disabled={loading}
              >
                {loading && migrationStep === 5 ? 'Testing...' : '6. Test Migrations'}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger">
              <h5>Error</h5>
              <p>{error}</p>
            </div>
          )}

          {results && (
            <div>
              <h5>Results:</h5>
              {results.sql ? (
                <div className="alert alert-warning">
                  <h6>{results.message}</h6>
                  <div className="bg-dark p-3 rounded">
                    <pre className="text-light mb-0" style={{ fontSize: '12px', overflow: 'auto' }}>
                      {results.sql}
                    </pre>
                  </div>
                  <small className="text-muted mt-2 d-block">
                    Copy this SQL and run it in your Supabase SQL Editor, then continue to the next step.
                  </small>
                </div>
              ) : (
                <div className="alert alert-info">
                  <pre style={{ maxHeight: '400px', overflow: 'auto', fontSize: '12px' }}>
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <h5>Migration Steps:</h5>
            <ol>
              <li><strong>Check Current Schema</strong>: Verify what tables and columns exist</li>
              <li><strong>Add Missing Columns</strong>: Add tracking columns to existing tables</li>
              <li><strong>Create Status Table</strong>: Create job_status_updates table</li>
              <li><strong>Add Indexes & Constraints</strong>: Improve performance and data integrity</li>
              <li><strong>Create RLS Policies</strong>: Set up security policies</li>
              <li><strong>Test Migrations</strong>: Verify everything works correctly</li>
            </ol>
            
            <div className="alert alert-warning mt-3">
              <h6>Additional Steps Required:</h6>
              <p><strong>7. Create System Functions</strong>: Run <code>create_tracking_functions_final.sql</code> in Supabase SQL Editor</p>
              <p><strong>8. Deploy Edge Functions</strong>: Run the following commands:</p>
              <pre className="bg-dark text-light p-2 rounded"><code>{`npx supabase functions deploy start-technician-tracking
npx supabase functions deploy update-technician-location  
npx supabase functions deploy get-technician-location`}</code></pre>
              <p><strong>9. Test Integration</strong>: Use the customer portal at <code>/customer/:customerId</code> to test tracking</p>
            </div>
            
            <div className="alert alert-info mt-3">
              <strong>Important:</strong> This page generates SQL statements that you need to copy and run 
              in your Supabase SQL Editor. The app cannot run DDL statements directly for security reasons.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrackingMigrationPage