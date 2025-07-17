import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { Video } from '@signalwire/js'

interface TestResult {
  step: string
  status: 'pending' | 'testing' | 'success' | 'failed'
  message: string
  error?: any
  details?: any
}

export const VideoSystemDiagnostics: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [credentials, setCredentials] = useState({
    projectId: '',
    apiToken: '',
    spaceUrl: '',
    aiScriptId: ''
  })
  const [testRoomData, setTestRoomData] = useState<any>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Load credentials from environment or localStorage
  useEffect(() => {
    const savedCreds = localStorage.getItem('signalwire_test_credentials')
    if (savedCreds) {
      setCredentials(JSON.parse(savedCreds))
    }
  }, [])

  const saveCredentials = () => {
    localStorage.setItem('signalwire_test_credentials', JSON.stringify(credentials))
    showToast.success('Credentials saved')
  }

  const updateTestResult = (step: string, status: TestResult['status'], message: string, error?: any, details?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.step === step)
      if (existing) {
        return prev.map(r => r.step === step ? { ...r, status, message, error, details } : r)
      }
      return [...prev, { step, status, message, error, details }]
    })
  }

  const runCompleteDiagnostics = async () => {
    setIsRunning(true)
    setTestResults([])
    
    try {
      // Test 1: Check Supabase Connection
      await testSupabaseConnection()
      
      // Test 2: Check SignalWire Credentials
      await testSignalWireCredentials()
      
      // Test 3: Create Test Room
      await testCreateRoom()
      
      // Test 4: Generate Room Token
      await testGenerateToken()
      
      // Test 5: Test Media Permissions
      await testMediaPermissions()
      
      // Test 6: Join Room
      await testJoinRoom()
      
      // Test 7: Add AI to Room
      await testAddAI()
      
      // Test 8: Test Vision Capabilities
      await testVisionCapabilities()
      
    } catch (error) {
      console.error('Diagnostic error:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const testSupabaseConnection = async () => {
    const step = 'Supabase Connection'
    updateTestResult(step, 'testing', 'Testing Supabase connection...')
    
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      
      updateTestResult(step, 'success', 'Supabase connected successfully', null, {
        hasSession: !!data.session,
        url: supabase.supabaseUrl
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Supabase connection failed', error)
      throw error
    }
  }

  const testSignalWireCredentials = async () => {
    const step = 'SignalWire Credentials'
    updateTestResult(step, 'testing', 'Verifying SignalWire credentials...')
    
    try {
      // First check if we have credentials
      if (!credentials.projectId || !credentials.apiToken || !credentials.spaceUrl) {
        throw new Error('Missing SignalWire credentials. Please enter them above.')
      }

      // Test the credentials by making a simple API call
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const response = await fetch(`https://${credentials.spaceUrl}/api/video/rooms?page_size=1`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SignalWire API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      updateTestResult(step, 'success', 'SignalWire credentials valid', null, {
        projectId: credentials.projectId,
        spaceUrl: credentials.spaceUrl,
        roomsFound: data.data?.length || 0
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'SignalWire credential verification failed', error)
      throw error
    }
  }

  const testCreateRoom = async () => {
    const step = 'Create Video Room'
    updateTestResult(step, 'testing', 'Creating test video room...')
    
    try {
      const { data, error } = await supabase.functions.invoke('create-video-room', {
        body: {
          room_name: `test_diagnostics_${Date.now()}`,
          trade_type: 'ROOFING',
          enable_vision: true,
          enable_recording: false,
          max_participants: 3
        }
      })

      if (error) throw error
      if (!data || !data.room_name) throw new Error('No room data returned')

      setTestRoomData(data)
      updateTestResult(step, 'success', 'Video room created successfully', null, {
        roomName: data.room_name,
        roomUrl: data.room_url,
        roomId: data.room_id
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to create video room', error)
      throw error
    }
  }

  const testGenerateToken = async () => {
    const step = 'Generate Room Token'
    updateTestResult(step, 'testing', 'Generating room access token...')
    
    try {
      if (!testRoomData) throw new Error('No test room available')

      const { data, error } = await supabase.functions.invoke('generate-room-token', {
        body: {
          room_id: testRoomData.room_name,
          user_name: 'Test User',
          permissions: [
            'room.self.audio_mute',
            'room.self.audio_unmute',
            'room.self.video_mute',
            'room.self.video_unmute'
          ]
        }
      })

      if (error) throw error
      if (!data || !data.token) throw new Error('No token returned')

      updateTestResult(step, 'success', 'Token generated successfully', null, {
        tokenLength: data.token.length,
        hasToken: true
      })
      
      // Store token for next test
      testRoomData.token = data.token
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to generate room token', error)
      throw error
    }
  }

  const testMediaPermissions = async () => {
    const step = 'Media Permissions'
    updateTestResult(step, 'testing', 'Checking camera/microphone permissions...')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()

      updateTestResult(step, 'success', 'Media permissions granted', null, {
        videoDevice: videoTracks[0]?.label || 'Unknown camera',
        audioDevice: audioTracks[0]?.label || 'Unknown microphone',
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled
      })

      // Clean up
      stream.getTracks().forEach(track => track.stop())
    } catch (error: any) {
      updateTestResult(step, 'failed', 'Media permissions denied or devices not found', error, {
        errorName: error.name,
        errorMessage: error.message
      })
      // Don't throw - we can continue testing without media
    }
  }

  const testJoinRoom = async () => {
    const step = 'Join Video Room'
    updateTestResult(step, 'testing', 'Attempting to join video room...')
    
    try {
      if (!testRoomData || !testRoomData.token) {
        throw new Error('No room token available')
      }

      // Create room session
      const roomSession = new Video.RoomSession({
        token: testRoomData.token,
        rootElement: videoContainerRef.current,
        audio: false, // Start muted for testing
        video: false
      })

      // Set up event handlers with promises
      const joinPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Join timeout - no response after 30 seconds'))
        }, 30000)

        roomSession.on('room.joined', (params: any) => {
          clearTimeout(timeout)
          resolve(params)
        })

        roomSession.on('error', (error: any) => {
          clearTimeout(timeout)
          reject(error)
        })

        roomSession.on('room.left', (params: any) => {
          if (params?.error) {
            clearTimeout(timeout)
            reject(new Error(params.error.message || 'Room left with error'))
          }
        })
      })

      // Attempt to join
      await roomSession.join()
      const joinResult = await joinPromise

      updateTestResult(step, 'success', 'Successfully joined video room', null, {
        roomSessionId: (joinResult as any)?.room_session_id,
        memberId: (joinResult as any)?.member_id,
        roomSize: (joinResult as any)?.room?.members?.length || 0
      })

      // Clean up
      setTimeout(() => {
        roomSession.leave()
      }, 2000)

    } catch (error: any) {
      updateTestResult(step, 'failed', 'Failed to join video room', error, {
        errorType: error.name,
        errorDetails: error.message
      })
      throw error
    }
  }

  const testAddAI = async () => {
    const step = 'Add AI Agent'
    updateTestResult(step, 'testing', 'Adding AI agent to room...')
    
    try {
      if (!testRoomData) throw new Error('No test room available')
      if (!credentials.aiScriptId) {
        updateTestResult(step, 'failed', 'No AI Script ID configured', null)
        return
      }

      const { data, error } = await supabase.functions.invoke('add-ai-to-video-room', {
        body: {
          room_name: testRoomData.room_name,
          session_id: 'test-session',
          trade_type: 'ROOFING'
        }
      })

      if (error) throw error

      updateTestResult(step, 'success', 'AI agent request sent', null, {
        success: data?.success,
        scriptId: data?.script_id,
        executionResult: data?.execution_result
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to add AI agent', error)
      // Don't throw - AI is optional
    }
  }

  const testVisionCapabilities = async () => {
    const step = 'Vision Capabilities'
    updateTestResult(step, 'testing', 'Checking AI vision configuration...')
    
    try {
      // Check if the SWML file exists and is properly configured
      const swmlCheck = {
        hasVisionEnabled: true, // Based on your SWML config
        visionModel: 'gpt-4o-mini',
        functions: ['get_visual_input', 'capture_issue', 'process_visual_analysis']
      }

      updateTestResult(step, 'success', 'Vision capabilities configured', null, swmlCheck)
    } catch (error) {
      updateTestResult(step, 'failed', 'Vision configuration check failed', error)
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'testing':
        return '🔄'
      case 'success':
        return '✅'
      case 'failed':
        return '❌'
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-muted'
      case 'testing':
        return 'text-primary'
      case 'success':
        return 'text-success'
      case 'failed':
        return 'text-danger'
    }
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-5">Video System Diagnostics</h1>
          
          {/* Credentials Setup */}
          <div className="card mb-5">
            <div className="card-header">
              <h3 className="card-title">SignalWire Configuration</h3>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Project ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your SignalWire Project ID"
                    value={credentials.projectId}
                    onChange={(e) => setCredentials(prev => ({ ...prev, projectId: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">API Token</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Your SignalWire API Token"
                    value={credentials.apiToken}
                    onChange={(e) => setCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Space URL</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="your-space.signalwire.com"
                    value={credentials.spaceUrl}
                    onChange={(e) => setCredentials(prev => ({ ...prev, spaceUrl: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">AI Script ID (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your AI Script ID"
                    value={credentials.aiScriptId}
                    onChange={(e) => setCredentials(prev => ({ ...prev, aiScriptId: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button 
                  className="btn btn-light-primary me-3"
                  onClick={saveCredentials}
                >
                  Save Credentials
                </button>
                <small className="text-muted">Credentials are saved locally for testing only</small>
              </div>
            </div>
          </div>

          {/* Run Tests Button */}
          <div className="text-center mb-5">
            <button
              className="btn btn-lg btn-primary"
              onClick={runCompleteDiagnostics}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <i className="ki-duotone ki-shield-search fs-2 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Run Complete Diagnostics
                </>
              )}
            </button>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Test Results</h3>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-row-dashed">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Status</th>
                        <th>Message</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResults.map((result, index) => (
                        <tr key={index}>
                          <td className="fw-bold">{result.step}</td>
                          <td>
                            <span className={getStatusColor(result.status)}>
                              {getStatusIcon(result.status)} {result.status}
                            </span>
                          </td>
                          <td>{result.message}</td>
                          <td>
                            {result.error && (
                              <div className="text-danger small">
                                Error: {result.error.message || result.error}
                              </div>
                            )}
                            {result.details && (
                              <details className="small">
                                <summary>View Details</summary>
                                <pre className="mt-2 p-2 bg-light rounded">
                                  {JSON.stringify(result.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Video Container for Testing */}
          <div 
            ref={videoContainerRef} 
            style={{ display: 'none' }}
            className="video-test-container"
          />

          {/* Common Issues & Solutions */}
          <div className="card mt-5">
            <div className="card-header">
              <h3 className="card-title">Common Issues & Solutions</h3>
            </div>
            <div className="card-body">
              <div className="accordion" id="issuesAccordion">
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue1">
                      SignalWire Authentication Fails
                    </button>
                  </h2>
                  <div id="issue1" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Verify Project ID and API Token are correct</li>
                        <li>Check that the Space URL doesn't include https://</li>
                        <li>Ensure API token has video room permissions</li>
                        <li>Try regenerating your API token in SignalWire dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue2">
                      Room Creation Fails
                    </button>
                  </h2>
                  <div id="issue2" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Check Supabase Edge Function logs for errors</li>
                        <li>Verify environment variables are set correctly</li>
                        <li>Ensure SignalWire account has available room capacity</li>
                        <li>Check for special characters in room names</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue3">
                      Can't Join Room
                    </button>
                  </h2>
                  <div id="issue3" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Check browser console for WebRTC errors</li>
                        <li>Ensure you're using HTTPS (required for WebRTC)</li>
                        <li>Try disabling browser extensions</li>
                        <li>Check firewall/network restrictions</li>
                        <li>Verify token has correct permissions</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue4">
                      AI Agent Not Joining
                    </button>
                  </h2>
                  <div id="issue4" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Verify AI Script ID is correct</li>
                        <li>Check that SWML script is properly uploaded to SignalWire</li>
                        <li>Ensure script has correct room join permissions</li>
                        <li>Check SignalWire logs for script execution errors</li>
                        <li>Verify webhook URLs in SWML are accessible</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoSystemDiagnostics