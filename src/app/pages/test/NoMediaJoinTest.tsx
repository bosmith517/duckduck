import React, { useState, useRef, useCallback } from 'react'
import { Video } from '@signalwire/js'

interface TestStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  startTime?: number
  endTime?: number
}

export const NoMediaJoinTest: React.FC = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'env', name: 'Environment Check', status: 'pending' },
    { id: 'api', name: 'Create Room & Token', status: 'pending' },
    { id: 'join-no-media', name: 'Join WITHOUT Media', status: 'pending' },
    { id: 'add-media', name: 'Add Media After Join', status: 'pending' }
  ])
  
  const [isRunning, setIsRunning] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentTest, setCurrentTest] = useState<string>('')
  const [results, setResults] = useState<{[key: string]: number}>({})
  const [logs, setLogs] = useState<string[]>([])
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  
  // Manual credential inputs
  const [credentials, setCredentials] = useState({
    projectId: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID || '',
    apiToken: '',
    spaceUrl: ''
  })

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    const logEntry = `${timestamp} (+${elapsed}ms) ${emoji} ${message}`
    setLogs(prev => [...prev, logEntry])
    console.log(`[NoMediaJoin] ${message}`)
  }, [])

  const updateStep = useCallback((stepId: string, status: TestStep['status'], message?: string) => {
    const now = Date.now()
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            status, 
            message, 
            startTime: status === 'running' ? now : step.startTime,
            endTime: status === 'success' || status === 'error' ? now : undefined
          } 
        : step
    ))
  }, [])

  const runNoMediaTest = async () => {
    setIsRunning(true)
    setIsConnecting(true)
    setLogs([])
    setResults({})
    startTimeRef.current = Date.now()
    setCurrentTest('no-media')
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, startTime: undefined, endTime: undefined })))
    
    try {
      // Step 1: Environment Check
      updateStep('env', 'running')
      addLog('Checking credentials...')
      
      if (!credentials.projectId || !credentials.apiToken || !credentials.spaceUrl) {
        const message = 'Please enter all SignalWire credentials'
        updateStep('env', 'error', message)
        addLog(message, 'error')
        return
      }
      
      updateStep('env', 'success', 'Credentials OK')
      addLog('Credentials validated', 'success')
      
      // Step 2: Create Room & Token
      updateStep('api', 'running')
      addLog('Creating room and token...')
      
      const roomName = `no_media_test_${Date.now()}`
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const baseUrl = `https://${credentials.spaceUrl}/api/video`
      
      const [roomResponse, tokenResponse] = await Promise.all([
        fetch(`${baseUrl}/rooms`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: roomName,
            display_name: `No Media Test Room`,
            max_participants: 5,
            enable_recording: false
          })
        }),
        fetch(`${baseUrl}/room_tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_name: `no_media_user_${Date.now()}`,
            room_name: roomName,
            join_as: 'audience',
            permissions: [],
            expires_in: 3600
          })
        })
      ])
      
      if (!roomResponse.ok || !tokenResponse.ok) {
        const message = `API failed: Room ${roomResponse.status}, Token ${tokenResponse.status}`
        updateStep('api', 'error', message)
        addLog(message, 'error')
        return
      }
      
      const [roomData, tokenData] = await Promise.all([
        roomResponse.json(),
        tokenResponse.json()
      ])
      
      updateStep('api', 'success', `Room: ${roomData.name}`)
      addLog(`Room and token created successfully`, 'success')
      
      // Step 3: Join WITHOUT Media (This should be fast!)
      updateStep('join-no-media', 'running')
      addLog('🚀 ATTEMPTING TO JOIN WITHOUT MEDIA - should be instant!')
      
      if (!videoContainerRef.current) {
        const message = 'Video container not ready'
        updateStep('join-no-media', 'error', message)
        addLog(message, 'error')
        return
      }
      
      const joinStartTime = Date.now()
      
      const roomSession = new Video.RoomSession({
        token: tokenData.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug'
      })
      
      clientRef.current = roomSession
      
      // Track room joined event
      roomSession.on('room.joined', (params: any) => {
        const joinElapsed = Date.now() - joinStartTime
        const totalElapsed = Date.now() - startTimeRef.current
        
        addLog(`🎉 JOINED WITHOUT MEDIA in ${joinElapsed}ms!`, 'success')
        updateStep('join-no-media', 'success', `Joined in ${joinElapsed}ms`)
        setResults(prev => ({ ...prev, 'no-media-join': joinElapsed }))
        
        // Step 4: Now try to add media
        updateStep('add-media', 'running')
        addLog('Now attempting to add media after join...')
        
        const mediaStartTime = Date.now()
        
        // Try to add media after joining
        roomSession.updateMedia({
          audio: true as any,
          video: false as any
        }).then(() => {
          const mediaElapsed = Date.now() - mediaStartTime
          addLog(`✅ Media added in ${mediaElapsed}ms!`, 'success')
          updateStep('add-media', 'success', `Media added in ${mediaElapsed}ms`)
          setResults(prev => ({ ...prev, 'add-media': mediaElapsed, 'total': Date.now() - startTimeRef.current }))
        }).catch((error: any) => {
          addLog(`❌ Failed to add media: ${error.message}`, 'error')
          updateStep('add-media', 'error', error.message)
        }).finally(() => {
          setIsConnecting(false)
        })
      })
      
      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`❌ Connection error: ${error.message}`, 'error')
        updateStep('join-no-media', 'error', error.message)
        setIsConnecting(false)
      })
      
      // Join as audience with NO MEDIA - this should bypass WebRTC media negotiation
      addLog('Joining as audience with no media...')
      await roomSession.join()
      
      addLog('Join method completed - waiting for room.joined event...', 'success')
      
    } catch (error: any) {
      addLog(`Fatal error: ${error.message}`, 'error')
      updateStep('join-no-media', 'error', error.message)
      setIsConnecting(false)
    } finally {
      setIsRunning(false)
    }
  }

  const runTraditionalTest = async () => {
    setIsRunning(true)
    setIsConnecting(true)
    setLogs([])
    startTimeRef.current = Date.now()
    setCurrentTest('traditional')
    
    // Reset steps for traditional test
    setSteps([
      { id: 'env', name: 'Environment Check', status: 'success' },
      { id: 'api', name: 'Create Room & Token', status: 'pending' },
      { id: 'join-with-media', name: 'Join WITH Media (Traditional)', status: 'pending' }
    ])
    
    try {
      addLog('Running traditional join with media for comparison...')
      
      const roomName = `traditional_test_${Date.now()}`
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const baseUrl = `https://${credentials.spaceUrl}/api/video`
      
      updateStep('api', 'running')
      const [roomResponse, tokenResponse] = await Promise.all([
        fetch(`${baseUrl}/rooms`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: roomName,
            display_name: `Traditional Test Room`,
            max_participants: 5,
            enable_recording: false
          })
        }),
        fetch(`${baseUrl}/room_tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_name: `traditional_user_${Date.now()}`,
            room_name: roomName,
            join_as: 'member',
            permissions: [
              'room.self.audio_mute',
              'room.self.audio_unmute',
              'room.self.video_mute',
              'room.self.video_unmute'
            ],
            expires_in: 3600
          })
        })
      ])
      
      const [roomData, tokenData] = await Promise.all([
        roomResponse.json(),
        tokenResponse.json()
      ])
      
      updateStep('api', 'success', `Room: ${roomData.name}`)
      
      updateStep('join-with-media', 'running')
      addLog('🐌 TRADITIONAL JOIN WITH MEDIA - expecting 43+ seconds...')
      
      const joinStartTime = Date.now()
      
      const roomSession = new Video.RoomSession({
        token: tokenData.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug'
      })
      
      clientRef.current = roomSession
      
      roomSession.on('room.joined', (params: any) => {
        const joinElapsed = Date.now() - joinStartTime
        addLog(`🐌 TRADITIONAL JOIN completed in ${joinElapsed}ms`, 'success')
        updateStep('join-with-media', 'success', `Joined in ${joinElapsed}ms`)
        setResults(prev => ({ ...prev, 'traditional-join': joinElapsed }))
        setIsConnecting(false)
      })
      
      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`❌ Traditional join error: ${error.message}`, 'error')
        updateStep('join-with-media', 'error', error.message)
        setIsConnecting(false)
      })
      
      // Traditional join WITH media
      await roomSession.join({
        audio: true,
        video: false
      })
      
    } catch (error: any) {
      addLog(`Traditional test error: ${error.message}`, 'error')
      setIsConnecting(false)
    } finally {
      setIsRunning(false)
    }
  }

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        addLog('Disconnecting...')
        await clientRef.current.leave()
        clientRef.current = null
        addLog('Disconnected successfully', 'success')
      } catch (error: any) {
        addLog(`Error disconnecting: ${error.message}`, 'error')
      }
    }
  }

  const clearLogs = () => {
    setLogs([])
    setResults({})
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🚫🎤 No-Media Join Test</h1>
          <p className="lead mb-4">
            Theory: The 43-second delay is WebRTC media negotiation. Let's join without media first, then add it.
          </p>

          {/* Results Comparison */}
          {Object.keys(results).length > 0 && (
            <div className="alert alert-success mb-4">
              <h4>📊 Performance Results</h4>
              {results['no-media-join'] && (
                <p className="mb-1"><strong>No-Media Join:</strong> {results['no-media-join']}ms</p>
              )}
              {results['add-media'] && (
                <p className="mb-1"><strong>Add Media After:</strong> {results['add-media']}ms</p>
              )}
              {results['traditional-join'] && (
                <p className="mb-1"><strong>Traditional Join:</strong> {results['traditional-join']}ms</p>
              )}
              {results['total'] && (
                <p className="mb-0"><strong>Total (No-Media Method):</strong> {results['total']}ms</p>
              )}
            </div>
          )}

          {/* SignalWire Credentials */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">SignalWire Credentials</h3>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Project ID</label>
                    <input
                      type="text"
                      className="form-control"
                      value={credentials.projectId}
                      onChange={(e) => setCredentials(prev => ({ ...prev, projectId: e.target.value }))}
                      placeholder="Enter SignalWire Project ID"
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">API Token</label>
                    <input
                      type="password"
                      className="form-control"
                      value={credentials.apiToken}
                      onChange={(e) => setCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
                      placeholder="Enter SignalWire API Token"
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mb-3">
                    <label className="form-label">Space URL</label>
                    <input
                      type="text"
                      className="form-control"
                      value={credentials.spaceUrl}
                      onChange={(e) => setCredentials(prev => ({ ...prev, spaceUrl: e.target.value }))}
                      placeholder="e.g., yourspace.signalwire.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={runNoMediaTest}
              disabled={isRunning}
            >
              {isRunning && currentTest === 'no-media' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Testing No-Media Join...
                </>
              ) : (
                '🚀 Test No-Media Join'
              )}
            </button>
            
            <button
              className="btn btn-warning"
              onClick={runTraditionalTest}
              disabled={isRunning}
            >
              {isRunning && currentTest === 'traditional' ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Testing Traditional Join...
                </>
              ) : (
                '🐌 Test Traditional Join'
              )}
            </button>
            
            <button
              className="btn btn-danger"
              onClick={disconnect}
              disabled={!clientRef.current}
            >
              Disconnect
            </button>
            
            <button
              className="btn btn-light"
              onClick={clearLogs}
            >
              Clear Results
            </button>
          </div>

          {/* Test Steps */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Test Steps</h3>
            </div>
            <div className="card-body">
              {steps.map(step => {
                const duration = step.startTime && step.endTime ? step.endTime - step.startTime : null
                return (
                  <div key={step.id} className="d-flex align-items-center mb-3">
                    <div className="me-3" style={{ minWidth: '30px' }}>
                      {step.status === 'pending' && '⏳'}
                      {step.status === 'running' && <span className="spinner-border spinner-border-sm text-primary"></span>}
                      {step.status === 'success' && '✅'}
                      {step.status === 'error' && '❌'}
                    </div>
                    <div className="flex-grow-1">
                      <strong>{step.name}</strong>
                      {duration && <span className="badge bg-info ms-2">{duration}ms</span>}
                      {step.message && <div className="text-muted small">{step.message}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Video Container */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Video Container</h3>
            </div>
            <div className="card-body">
              <div
                ref={videoContainerRef}
                style={{
                  width: '100%',
                  height: '400px',
                  backgroundColor: '#f8f9fa',
                  border: '2px dashed #dee2e6',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <p className="text-muted">Video will appear here when connected</p>
              </div>
            </div>
          </div>

          {/* Live Logs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Test Logs</h3>
            </div>
            <div className="card-body">
              <div
                className="bg-dark text-light p-3 rounded"
                style={{
                  maxHeight: '500px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-muted">Run a test to see results</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Theory */}
          <div className="alert alert-info mt-4">
            <h5>🧪 Test Theory</h5>
            <p className="mb-2">
              <strong>Hypothesis:</strong> The 43-second delay is WebRTC media negotiation (getUserMedia + ICE gathering).
            </p>
            <ul className="mb-2">
              <li><strong>No-Media Join:</strong> Join with audio:false, video:false (should be instant)</li>
              <li><strong>Add Media After:</strong> Call updateMedia() after room is joined</li>
              <li><strong>Traditional Join:</strong> Join with audio:true (should take 43+ seconds)</li>
            </ul>
            <p className="mb-0">
              <strong>Expected Result:</strong> If no-media join is fast, we've isolated the media negotiation as the bottleneck.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoMediaJoinTest