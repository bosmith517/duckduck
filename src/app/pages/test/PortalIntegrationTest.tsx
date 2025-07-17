import React, { useState } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import ClientPortalService from '../../services/clientPortalService'

const PortalIntegrationTest: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const addResult = (step: string, success: boolean, data?: any, error?: any) => {
    setResults(prev => [...prev, {
      step,
      success,
      data,
      error,
      timestamp: new Date().toISOString()
    }])
  }

  const runPortalIntegrationTest = async () => {
    setLoading(true)
    setResults([])

    try {
      // Step 1: Run schema setup
      addResult('Starting Portal Integration Test', true)
      
      addResult('Running Database Schema Setup', true)
      const { data: schemaResult, error: schemaError } = await supabase.functions.invoke('setup-portal-tokens')
      
      if (schemaError) {
        addResult('Database Schema Setup', false, null, schemaError)
        return
      } else {
        addResult('Database Schema Setup', true, schemaResult)
      }

      // Step 2: Create a test job
      addResult('Creating Test Job', true)
      const testJobData = {
        title: 'Portal Integration Test Job',
        description: 'Test job for portal integration',
        service_type: 'Testing',
        status: 'scheduled',
        priority: 'normal',
        tenant_id: userProfile?.tenant_id,
        assigned_technician_id: userProfile?.id,
        scheduled_start: new Date().toISOString(),
        estimated_duration: 120,
        contact_id: null, // We'll create a contact
        account_id: null
      }

      // Create test contact first
      const { data: testContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: 'Test',
          last_name: 'Customer',
          phone: '+15551234567',
          email: 'test@example.com',
          tenant_id: userProfile?.tenant_id
        })
        .select()
        .single()

      if (contactError) {
        addResult('Creating Test Contact', false, null, contactError)
        return
      } else {
        addResult('Creating Test Contact', true, testContact)
      }

      // Update job with contact
      testJobData.contact_id = testContact.id

      const { data: testJob, error: jobError } = await supabase
        .from('jobs')
        .insert(testJobData)
        .select()
        .single()

      if (jobError) {
        addResult('Creating Test Job', false, null, jobError)
        return
      } else {
        addResult('Creating Test Job', true, testJob)
      }

      // Step 3: Manually trigger portal generation
      addResult('Generating Portal Token', true)
      const portalSuccess = await ClientPortalService.autoGeneratePortalForJob(testJob.id)
      
      if (!portalSuccess) {
        addResult('Generating Portal Token', false, null, 'Portal generation failed')
        return
      } else {
        addResult('Generating Portal Token', true, { success: portalSuccess })
      }

      // Step 4: Verify portal token was created
      addResult('Verifying Portal Token Creation', true)
      const { data: portalToken, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('job_id', testJob.id)
        .single()

      if (tokenError || !portalToken) {
        addResult('Verifying Portal Token Creation', false, null, tokenError || 'No token found')
        return
      } else {
        addResult('Verifying Portal Token Creation', true, portalToken)
      }

      // Step 5: Test portal access validation
      addResult('Testing Portal Access Validation', true)
      const portalAccess = await ClientPortalService.validatePortalAccess(portalToken.token)
      
      if (!portalAccess) {
        addResult('Testing Portal Access Validation', false, null, 'Portal access validation failed')
        return
      } else {
        addResult('Testing Portal Access Validation', true, portalAccess)
      }

      // Step 6: Test portal analytics
      addResult('Testing Portal Analytics', true)
      const analytics = await ClientPortalService.getPortalAnalytics(testJob.id)
      
      if (!analytics) {
        addResult('Testing Portal Analytics', false, null, 'Analytics generation failed')
        return
      } else {
        addResult('Testing Portal Analytics', true, analytics)
      }

      // Step 7: Test activity logging
      addResult('Testing Activity Logging', true)
      await ClientPortalService.logPortalActivity(portalToken.id, 'view_job', userProfile?.tenant_id || '', {
        test: true,
        page: '/test-portal'
      })
      addResult('Testing Activity Logging', true, { logged: true })

      // Final step: Cleanup test data
      addResult('Cleaning Up Test Data', true)
      await supabase.from('client_portal_tokens').delete().eq('id', portalToken.id)
      await supabase.from('jobs').delete().eq('id', testJob.id)
      await supabase.from('contacts').delete().eq('id', testContact.id)
      addResult('Cleaning Up Test Data', true, { cleaned: true })

      addResult('🎉 Portal Integration Test Complete', true, { 
        summary: 'All portal integration features working correctly!' 
      })

    } catch (error) {
      addResult('Fatal Error', false, null, error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h1 className="text-dark fw-bold mb-2">Portal Integration Test</h1>
          <p className="text-muted mb-0">Test the complete customer portal integration system</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={runPortalIntegrationTest}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Running Tests...
            </>
          ) : (
            <>
              <KTIcon iconName="play" className="fs-6 me-2" />
              Run Portal Test
            </>
          )}
        </button>
      </div>

      <KTCard>
        <div className="card-header">
          <h3 className="card-title">Test Results</h3>
        </div>
        <KTCardBody>
          {results.length === 0 ? (
            <div className="text-center py-10">
              <KTIcon iconName="document" className="fs-2x text-muted mb-3" />
              <h5 className="text-muted">No Test Results Yet</h5>
              <p className="text-muted">Click "Run Portal Test" to start testing the integration.</p>
            </div>
          ) : (
            <div className="timeline">
              {results.map((result, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-line w-40px"></div>
                  <div className="timeline-icon symbol symbol-circle symbol-40px">
                    <div className={`symbol-label bg-light-${result.success ? 'success' : 'danger'}`}>
                      <KTIcon 
                        iconName={result.success ? 'check' : 'cross'} 
                        className={`fs-6 text-${result.success ? 'success' : 'danger'}`} 
                      />
                    </div>
                  </div>
                  <div className="timeline-content ms-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fs-6 fw-bold text-dark">{result.step}</div>
                      <div className="text-muted fs-7">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {result.success ? (
                      <div className="text-success fs-7 mb-2">✅ Success</div>
                    ) : (
                      <div className="text-danger fs-7 mb-2">❌ Failed</div>
                    )}

                    {result.data && (
                      <div className="bg-light-info rounded p-3 mb-2">
                        <div className="fs-7 fw-bold text-info mb-2">Data:</div>
                        <pre className="fs-8 text-muted mb-0" style={{ fontSize: '0.75rem' }}>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {result.error && (
                      <div className="bg-light-danger rounded p-3">
                        <div className="fs-7 fw-bold text-danger mb-2">Error:</div>
                        <pre className="fs-8 text-danger mb-0" style={{ fontSize: '0.75rem' }}>
                          {JSON.stringify(result.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </KTCardBody>
      </KTCard>

      {/* Test Summary */}
      {results.length > 0 && (
        <KTCard className="mt-5">
          <div className="card-header">
            <h3 className="card-title">Test Summary</h3>
          </div>
          <KTCardBody>
            <div className="row">
              <div className="col-md-3">
                <div className="text-center">
                  <div className="fs-2hx fw-bold text-primary">{results.length}</div>
                  <div className="text-muted">Total Steps</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div className="fs-2hx fw-bold text-success">{results.filter(r => r.success).length}</div>
                  <div className="text-muted">Passed</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div className="fs-2hx fw-bold text-danger">{results.filter(r => !r.success).length}</div>
                  <div className="text-muted">Failed</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="text-center">
                  <div className="fs-2hx fw-bold text-info">
                    {results.length > 0 ? Math.round((results.filter(r => r.success).length / results.length) * 100) : 0}%
                  </div>
                  <div className="text-muted">Success Rate</div>
                </div>
              </div>
            </div>
          </KTCardBody>
        </KTCard>
      )}
    </div>
  )
}

export default PortalIntegrationTest