import React, { useState, useRef, useCallback } from 'react'
import { Video } from '@signalwire/js'

interface TestStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  data?: any
}

export const SignalWireProperTest: React.FC = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'env', name: 'Environment Check', status: 'pending' },
    { id: 'room', name: 'Create Video Room', status: 'pending' },
    { id: 'token', name: 'Generate Room Token', status: 'pending' },
    { id: 'client', name: 'Initialize SignalWire Client', status: 'pending' },
    { id: 'connect', name: 'Connect to Room', status: 'pending' }
  ])
  
  const [isRunning, setIsRunning] = useState(false)
  const [roomData, setRoomData] = useState<any>(null)
  const [tokenData, setTokenData] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<any>(null)
  
  // Manual credential inputs
  const [credentials, setCredentials] = useState({
    projectId: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID || '',
    apiToken: '',
    spaceUrl: ''
  })

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs(prev => [...prev, logEntry])
    console.log(`[SignalWireProperTest] ${message}`)
  }, [])

  const updateStep = useCallback((stepId: string, status: TestStep['status'], message?: string, data?: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message, data } : step
    ))
  }, [])

  const runTest = async () => {
    setIsRunning(true)
    setLogs([])
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, data: undefined })))
    
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
      
      updateStep('env', 'success', 'All credentials provided')
      addLog('Credentials check passed', 'success')
      
      // Step 2: Create Video Room using SignalWire REST API
      updateStep('room', 'running')
      addLog('Creating video room via SignalWire REST API...')
      
      const roomName = `proper_test_${Date.now()}`
      const roomPayload = {
        name: roomName,
        display_name: `Proper Test Room`,
        max_participants: 5,
        enable_recording: false
      }
      
      addLog(`Room payload: ${JSON.stringify(roomPayload)}`)
      
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      
      try {
        const roomResponse = await fetch(`https://${credentials.spaceUrl}/api/video/rooms`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(roomPayload)
        })
        
        if (!roomResponse.ok) {
          const errorText = await roomResponse.text()
          const message = `Room creation failed: ${roomResponse.status} ${errorText}`
          updateStep('room', 'error', message)
          addLog(message, 'error')
          return
        }
        
        const roomData = await roomResponse.json()
        setRoomData(roomData)
        updateStep('room', 'success', `Room created: ${roomData.name}`, roomData)
        addLog(`Room created successfully: ${roomData.name}`, 'success')
        addLog(`Room ID: ${roomData.id}`, 'info')
        
      } catch (error: any) {
        const message = `Room creation error: ${error.message}`
        updateStep('room', 'error', message)
        addLog(message, 'error')
        return
      }
      
      // Step 3: Generate Room Token (we'll use BOTH project auth AND room token)
      updateStep('token', 'running')
      addLog('Generating room token for joining specific room...')
      
      // Generate room token for joining the specific room
      const tokenPayload = {
        user_name: `test_user_${Date.now()}`,
        room_name: roomName,
        join_as: 'member',
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute'
        ],
        expires_in: 3600
      }
      
      addLog(`Room token payload: ${JSON.stringify(tokenPayload)}`)
      
      try {
        const tokenResponse = await fetch(`https://${credentials.spaceUrl}/api/video/room_tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tokenPayload)
        })
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          const message = `Room token generation failed: ${tokenResponse.status} ${errorText}`
          updateStep('token', 'error', message)
          addLog(message, 'error')
          return
        }
        
        const tokenResponseData = await tokenResponse.json()
        setTokenData({
          roomToken: tokenResponseData.token,
          projectAuth: {
            project: credentials.projectId,
            token: credentials.apiToken
          }
        })
        updateStep('token', 'success', `Room token generated (${tokenResponseData.token.length} chars)`, tokenResponseData)
        addLog(`Room token generated successfully`, 'success')
        addLog(`Token length: ${tokenResponseData.token.length}`, 'info')
      
        // Step 4: Create Video.RoomSession (the working approach)
        updateStep('client', 'running')
        addLog('Creating Video.RoomSession with room token...')
        
        if (!videoContainerRef.current) {
          const message = 'Video container not ready'
          updateStep('client', 'error', message)
          addLog(message, 'error')
          return
        }
        
        const roomSession = new Video.RoomSession({
          token: tokenResponseData.token,
          rootElement: videoContainerRef.current,
          logLevel: 'debug'
        })
        
        clientRef.current = roomSession
        updateStep('client', 'success', 'Video.RoomSession created')
        addLog('Video.RoomSession created successfully', 'success')
        
        // Step 5: Join the room
        updateStep('connect', 'running')
        addLog('Joining room with Video.RoomSession...')
        
        // Set up event handlers
        roomSession.on('room.joined', (params: any) => {
          addLog(`Room joined via RoomSession: ${params.room_id}`, 'success')
          updateStep('connect', 'success', `Connected to room: ${params.room_id}`)
        })
        
        // @ts-ignore - deprecated event
        roomSession.on('error' as any, (error: any) => {
          addLog(`RoomSession error: ${error.message}`, 'error')
        })
        
        // Join the room
        await roomSession.join()
        addLog('RoomSession join method completed', 'success')
      
      } catch (error: any) {
        const message = `Room token generation error: ${error.message}`
        updateStep('token', 'error', message)
        addLog(message, 'error')
        return
      }
      
    } catch (error: any) {
      addLog(`Fatal error: ${error.message}`, 'error')
      addLog(`Error stack: ${error.stack}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        addLog('Leaving room...')
        await clientRef.current.leave()
        clientRef.current = null
        addLog('Left room successfully', 'success')
      } catch (error: any) {
        addLog(`Error leaving room: ${error.message}`, 'error')
      }
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🎯 SignalWire Proper Implementation Test</h1>
          <p className="lead mb-4">
            Testing video room functionality using SignalWire's official documented approach.
            This follows the exact patterns from their documentation.
          </p>

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
              onClick={runTest}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Running Test...
                </>
              ) : (
                '🚀 Run Proper Test'
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
              Clear Logs
            </button>
          </div>

          {/* Test Steps */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Test Steps</h3>
            </div>
            <div className="card-body">
              {steps.map(step => (
                <div key={step.id} className="d-flex align-items-center mb-3">
                  <div className="me-3" style={{ minWidth: '30px' }}>
                    {step.status === 'pending' && '⏳'}
                    {step.status === 'running' && <span className="spinner-border spinner-border-sm text-primary"></span>}
                    {step.status === 'success' && '✅'}
                    {step.status === 'error' && '❌'}
                  </div>
                  <div className="flex-grow-1">
                    <strong>{step.name}</strong>
                    {step.message && <div className="text-muted small">{step.message}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Display */}
          {(roomData || tokenData) && (
            <div className="card mb-4">
              <div className="card-header">
                <h3 className="card-title">Generated Data</h3>
              </div>
              <div className="card-body">
                {roomData && (
                  <div className="mb-3">
                    <h5>Room Data:</h5>
                    <pre className="bg-light p-2 rounded">
                      {JSON.stringify(roomData, null, 2)}
                    </pre>
                  </div>
                )}
                {tokenData && (
                  <div className="mb-3">
                    <h5>Token Data:</h5>
                    <pre className="bg-light p-2 rounded">
                      {JSON.stringify(tokenData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

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
              <h3 className="card-title">Live Test Logs</h3>
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
                  <div className="text-muted">Click "Run Proper Test" to start testing</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Documentation Reference */}
          <div className="alert alert-success mt-4">
            <h5>📚 Proper SignalWire Implementation</h5>
            <p className="mb-2">This test follows the official SignalWire pattern from their documentation:</p>
            <ul className="mb-0">
              <li><strong>Step 1:</strong> Create room via REST API</li>
              <li><strong>Step 2:</strong> Generate room token via REST API with <code>join_as: "member"</code></li>
              <li><strong>Step 3:</strong> Use <code>Video.RoomSession</code> with room token</li>
              <li><strong>Step 4:</strong> Call <code>roomSession.join()</code> with media settings</li>
            </ul>
          </div>
          
          <div className="alert alert-info mt-4">
            <h5>🔑 Key Insights</h5>
            <ul className="mb-0">
              <li><strong>Room tokens</strong> are for joining specific rooms (not project auth)</li>
              <li><strong>Video.RoomSession</strong> is the correct class for video rooms</li>
              <li><strong>Realtime SDK</strong> is for different use cases (voice, messaging)</li>
              <li><strong>React SDK</strong> with <code>&lt;Video /&gt;</code> component is recommended for production</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignalWireProperTest