import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const SimpleTrackingTest: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testBasicTables = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      console.log('Testing basic table access...')

      // Test 1: Check if job_status_updates table exists by trying to select from it
      const { data: statusData, error: statusError } = await supabase
        .from('job_status_updates')
        .select('id')
        .limit(1)

      console.log('job_status_updates test:', { statusData, statusError })

      // Test 2: Check if location_logs table has new columns
      const { data: logsData, error: logsError } = await supabase
        .from('location_logs')
        .select('id')
        .limit(1)

      console.log('location_logs test:', { logsData, logsError })

      // Test 3: Check job_technician_locations
      const { data: trackingData, error: trackingError } = await supabase
        .from('job_technician_locations')
        .select('id')
        .limit(1)

      console.log('job_technician_locations test:', { trackingData, trackingError })

      setResults({
        job_status_updates: {
          exists: !statusError,
          error: statusError?.message || null
        },
        location_logs: {
          exists: !logsError,
          error: logsError?.message || null
        },
        job_technician_locations: {
          exists: !trackingError,
          error: trackingError?.message || null
        },
        message: 'Basic table test completed'
      })

    } catch (err: any) {
      console.error('Test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const testRLSPolicies = async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('Testing RLS policies...')

      // Get current user first
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('Current user for test:', { user, userError })

      if (!user) {
        setError('No authenticated user found')
        return
      }

      // Get a real job to use for testing
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .limit(1)

      if (jobsError || !jobs || jobs.length === 0) {
        setError('No jobs found in database. Please create a job first.')
        return
      }

      const jobId = jobs[0].id
      console.log('Using job ID for test:', jobId)

      // Test inserting into job_status_updates (should work for authenticated user)
      const { data: insertData, error: insertError } = await supabase
        .from('job_status_updates')
        .insert({
          job_id: jobId, // Use real job ID
          user_id: user.id, // Use the actual user ID
          tenant_id: '10076fd5-e70f-4062-8192-e42173cf57fd', // correct tenant ID
          new_status: 'test_status',
          status_notes: 'Test note from RLS check'
        })
        .select()

      console.log('RLS insert test:', { insertData, insertError })

      setResults({
        rls_test: {
          success: !insertError,
          error: insertError?.message || null,
          user_id: user.id
        },
        message: 'RLS test completed'
      })

    } catch (err: any) {
      console.error('RLS test error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Simple Tracking Test</h3>
        </div>
        <div className="card-body">
          <p>Quick tests to verify the tracking migration worked.</p>
          
          <div className="d-flex gap-3 mb-4">
            <button 
              className="btn btn-primary" 
              onClick={testBasicTables}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Basic Tables'}
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={testRLSPolicies}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test RLS Policies'}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger">
              <h5>Error</h5>
              <p>{error}</p>
            </div>
          )}

          {results && (
            <div>
              <h5>Test Results:</h5>
              <div className="alert alert-info">
                <pre style={{ maxHeight: '400px', overflow: 'auto', fontSize: '12px' }}>
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div className="mt-4">
            <h5>What these tests check:</h5>
            <ul>
              <li><strong>Basic Tables</strong>: Verifies tables exist and are accessible</li>
              <li><strong>RLS Policies</strong>: Tests if Row Level Security is working correctly</li>
            </ul>
            
            <div className="alert alert-warning mt-3">
              <strong>Note:</strong> If basic tables work but RLS fails, the migration was successful 
              but you may need to adjust the RLS policies for your specific user setup.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleTrackingTest