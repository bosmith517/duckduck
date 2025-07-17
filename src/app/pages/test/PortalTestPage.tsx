import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

const PortalTestPage: React.FC = () => {
  const [portalToken, setPortalToken] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testPortalAccess = async () => {
    if (!portalToken.trim()) {
      showToast.error('Please enter a portal token')
      return
    }

    setLoading(true)
    setTestResult(null)

    try {
      // Test 1: Direct table access (will fail if RLS is blocking)
      const { data: directAccess, error: directError } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('token', portalToken)
        .single()

      // Test 2: RPC function call (should work with new migration)
      const { data: rpcAccess, error: rpcError } = await supabase
        .rpc('validate_portal_token', { token_string: portalToken })
        .single()

      // Test 3: Check if we can access jobs data
      let jobAccess = null
      let jobError = null
      if (rpcAccess && typeof rpcAccess === 'object' && 'job_id' in rpcAccess) {
        const result = await supabase
          .from('jobs')
          .select('id, title, job_number, status')
          .eq('id', rpcAccess.job_id as string)
          .single()
        
        jobAccess = result.data
        jobError = result.error
      }

      setTestResult({
        directAccess: {
          success: !directError,
          data: directAccess,
          error: directError
        },
        rpcAccess: {
          success: !rpcError,
          data: rpcAccess,
          error: rpcError
        },
        jobAccess: {
          success: !jobError,
          data: jobAccess,
          error: jobError
        },
        portalUrl: `${window.location.origin}/portal/${portalToken}`
      })

    } catch (error) {
      console.error('Test error:', error)
      setTestResult({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast.success('Copied to clipboard!')
  }

  return (
    <div className='card'>
      <div className='card-header'>
        <h3 className='card-title'>Portal Access Test</h3>
      </div>
      <div className='card-body'>
        <div className='mb-5'>
          <label className='form-label'>Portal Token</label>
          <input
            type='text'
            className='form-control'
            placeholder='Enter portal token to test'
            value={portalToken}
            onChange={(e) => setPortalToken(e.target.value)}
          />
          <div className='form-text'>
            Enter the portal token from the client_portal_tokens table
          </div>
        </div>

        <button
          className='btn btn-primary'
          onClick={testPortalAccess}
          disabled={loading}
        >
          {loading ? 'Testing...' : 'Test Portal Access'}
        </button>

        {testResult && (
          <div className='mt-5'>
            <h4>Test Results:</h4>
            
            {/* Portal URL */}
            {testResult.portalUrl && (
              <div className='alert alert-info d-flex justify-content-between align-items-center mb-4'>
                <div>
                  <strong>Portal URL:</strong>
                  <br />
                  <a href={testResult.portalUrl} target='_blank' rel='noopener noreferrer'>
                    {testResult.portalUrl}
                  </a>
                </div>
                <button
                  className='btn btn-sm btn-light-info'
                  onClick={() => copyToClipboard(testResult.portalUrl)}
                >
                  Copy URL
                </button>
              </div>
            )}

            {/* Direct Access Test */}
            <div className={`alert ${testResult.directAccess?.success ? 'alert-success' : 'alert-danger'} mb-3`}>
              <h5>Direct Table Access (RLS Check):</h5>
              {testResult.directAccess?.success ? (
                <div>
                  <p className='mb-1'>✅ Success - Token found</p>
                  <small>Token ID: {testResult.directAccess.data?.id}</small>
                </div>
              ) : (
                <div>
                  <p className='mb-1'>❌ Failed - RLS may be blocking access</p>
                  <small>{testResult.directAccess?.error?.message}</small>
                </div>
              )}
            </div>

            {/* RPC Access Test */}
            <div className={`alert ${testResult.rpcAccess?.success ? 'alert-success' : 'alert-warning'} mb-3`}>
              <h5>RPC Function Access:</h5>
              {testResult.rpcAccess?.success ? (
                <div>
                  <p className='mb-1'>✅ Success - Token validated</p>
                  <small>
                    Job ID: {testResult.rpcAccess.data && typeof testResult.rpcAccess.data === 'object' && 'job_id' in testResult.rpcAccess.data ? String(testResult.rpcAccess.data.job_id) : 'N/A'}<br />
                    Valid: {testResult.rpcAccess.data && typeof testResult.rpcAccess.data === 'object' && 'is_valid' in testResult.rpcAccess.data && testResult.rpcAccess.data.is_valid ? 'Yes' : 'No'}
                  </small>
                </div>
              ) : (
                <div>
                  <p className='mb-1'>⚠️ RPC function not available</p>
                  <small>Run the migration: 20250117184000_fix_portal_anonymous_access.sql</small>
                </div>
              )}
            </div>

            {/* Job Access Test */}
            {testResult.jobAccess && (
              <div className={`alert ${testResult.jobAccess.success ? 'alert-success' : 'alert-danger'} mb-3`}>
                <h5>Job Data Access:</h5>
                {testResult.jobAccess.success ? (
                  <div>
                    <p className='mb-1'>✅ Success - Job data accessible</p>
                    <small>
                      Job: {testResult.jobAccess.data?.job_number} - {testResult.jobAccess.data?.title}
                    </small>
                  </div>
                ) : (
                  <div>
                    <p className='mb-1'>❌ Failed - Cannot access job data</p>
                    <small>{testResult.jobAccess.error?.message}</small>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            <div className='alert alert-warning'>
              <h5>Recommendations:</h5>
              <ul className='mb-0'>
                {!testResult.directAccess?.success && (
                  <li>Run migration: <code>supabase db push</code> to apply RLS fixes</li>
                )}
                {!testResult.rpcAccess?.success && (
                  <li>The RPC function is missing. Apply the latest migration.</li>
                )}
                <li>Share the portal URL directly with customers - no login required</li>
                <li>Ensure the token is active and not expired</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PortalTestPage