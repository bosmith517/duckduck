import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

const VideoTestPage: React.FC = () => {
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const addResult = (key: string, value: any) => {
    setTestResults((prev: any) => ({ ...prev, [key]: value }))
  }

  const testCreateRoom = async () => {
    try {
      addResult('createRoom', { status: 'testing...', data: null })
      const { data, error } = await supabase.functions.invoke('create-signalwire-video-room', {
        body: { jobId: null }
      })
      
      if (error) {
        addResult('createRoom', { status: 'error', error: error.message })
        return null
      }
      
      addResult('createRoom', { status: 'success', data })
      return data
    } catch (err: any) {
      addResult('createRoom', { status: 'error', error: err.message })
      return null
    }
  }

  const testGenerateToken = async (roomName: string) => {
    try {
      addResult('generateToken', { status: 'testing...', data: null })
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addResult('generateToken', { status: 'error', error: 'No user logged in' })
        return null
      }

      const { data, error } = await supabase.functions.invoke('generate-signalwire-token', {
        body: { 
          clientIdentity: `test-user-${user.id.substring(0, 8)}`,
          room_name: roomName
        }
      })
      
      if (error) {
        addResult('generateToken', { status: 'error', error: error.message })
        return null
      }
      
      // Decode the token to inspect it
      if (data.token) {
        try {
          const parts = data.token.split('.')
          const header = JSON.parse(atob(parts[0]))
          const payload = JSON.parse(atob(parts[1]))
          
          addResult('generateToken', { 
            status: 'success', 
            data,
            decoded: { header, payload }
          })
        } catch (decodeErr) {
          addResult('generateToken', { 
            status: 'success', 
            data,
            decoded: 'Failed to decode JWT'
          })
        }
      } else {
        addResult('generateToken', { status: 'success', data })
      }
      
      return data
    } catch (err: any) {
      addResult('generateToken', { status: 'error', error: err.message })
      return null
    }
  }

  const testEnvironmentVariables = async () => {
    try {
      addResult('envVars', { status: 'checking...', data: null })
      
      // Check local environment variables
      const localEnvVars = {
        VITE_SIGNALWIRE_PROJECT_ID: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID || 'NOT SET',
        VITE_SIGNALWIRE_TOKEN: import.meta.env.VITE_SIGNALWIRE_TOKEN ? 'SET (hidden)' : 'NOT SET',
      }
      
      addResult('envVars', { 
        status: 'checked', 
        local: localEnvVars,
        note: 'Edge Function env vars are set in Supabase Dashboard'
      })
    } catch (err: any) {
      addResult('envVars', { status: 'error', error: err.message })
    }
  }

  const runAllTests = async () => {
    setLoading(true)
    setTestResults({})
    
    try {
      // Test 1: Check environment variables
      await testEnvironmentVariables()
      
      // Test 2: Create a room
      const roomData = await testCreateRoom()
      
      if (roomData && roomData.roomName) {
        // Test 3: Generate a token for the room
        await testGenerateToken(roomData.roomName)
      }
      
      showToast.success('All tests completed!')
    } catch (err: any) {
      showToast.error('Test suite failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>SignalWire Video Test Page</PageTitle>

      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>SignalWire Video Configuration Test</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>
                  Test your SignalWire configuration and troubleshoot 401 errors
                </span>
              </h3>
              <div className='card-toolbar'>
                <button 
                  className='btn btn-primary'
                  onClick={runAllTests}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <i className='ki-duotone ki-rocket fs-2 me-2'>
                        <span className='path1'></span>
                        <span className='path2'></span>
                      </i>
                      Run All Tests
                    </>
                  )}
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='mb-5'>
                <h4 className='mb-3'>Test Results:</h4>
                
                {Object.keys(testResults).length === 0 ? (
                  <div className='text-muted'>Click "Run All Tests" to begin testing your SignalWire configuration.</div>
                ) : (
                  <div className='accordion' id='testResultsAccordion'>
                    {Object.entries(testResults).map(([key, result]: [string, any], index) => (
                      <div className='accordion-item' key={key}>
                        <h2 className='accordion-header' id={`heading${key}`}>
                          <button
                            className={`accordion-button ${index !== 0 ? 'collapsed' : ''}`}
                            type='button'
                            data-bs-toggle='collapse'
                            data-bs-target={`#collapse${key}`}
                            aria-expanded={index === 0}
                            aria-controls={`collapse${key}`}
                          >
                            <span className='me-2'>
                              {result.status === 'success' || result.status === 'checked' ? (
                                <i className='ki-duotone ki-check-circle fs-2 text-success'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              ) : result.status === 'error' ? (
                                <i className='ki-duotone ki-cross-circle fs-2 text-danger'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              ) : (
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                              )}
                            </span>
                            <strong>{key}</strong>
                            {result.status && (
                              <span className='ms-2 text-muted'>({result.status})</span>
                            )}
                          </button>
                        </h2>
                        <div
                          id={`collapse${key}`}
                          className={`accordion-collapse collapse ${index === 0 ? 'show' : ''}`}
                          aria-labelledby={`heading${key}`}
                          data-bs-parent='#testResultsAccordion'
                        >
                          <div className='accordion-body'>
                            <pre className='bg-light p-3 rounded'>
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className='separator my-10'></div>

              <div className='mb-5'>
                <h4 className='mb-3'>Troubleshooting Guide:</h4>
                <div className='alert alert-info'>
                  <h5 className='alert-heading'>Common 401 Error Causes:</h5>
                  <ol className='mb-0'>
                    <li><strong>Wrong Project ID:</strong> Ensure SIGNALWIRE_PROJECT_ID matches your TaurusTech Space (000076e6-6359-41a2-b551-015b3ce9166a)</li>
                    <li><strong>Invalid API Token:</strong> The token might be expired or lack Video scope</li>
                    <li><strong>Cluster Mismatch:</strong> JWT header 'ch' must match the WebSocket node_id region</li>
                    <li><strong>Edge Function Cache:</strong> Supabase might be using old environment variables</li>
                  </ol>
                </div>

                <div className='alert alert-warning'>
                  <h5 className='alert-heading'>Required Actions in SignalWire Dashboard:</h5>
                  <ol className='mb-0'>
                    <li>Go to API Credentials → Generate Key</li>
                    <li>Select "Video" scope (and Voice if needed)</li>
                    <li>Copy the new secret immediately</li>
                    <li>Update SIGNALWIRE_API_TOKEN in Supabase Edge Function secrets</li>
                    <li>Redeploy the Edge Functions</li>
                  </ol>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default VideoTestPage
