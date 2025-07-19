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

export const ReusableRoomTest: React.FC = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'create', name: 'Create Long-Lived Room', status: 'pending' },
    { id: 'connect', name: 'Join Existing Room', status: 'pending' }
  ])
  
  const [isRunning, setIsRunning] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [totalTime, setTotalTime] = useState<number | null>(null)
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
    console.log(`[ReusableRoom] ${message}`)
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

  // Create a long-lived room once
  const createLongLivedRoom = async () => {
    setIsRunning(true)
    setLogs([])
    
    updateStep('create', 'running')
    addLog('Creating long-lived room for reuse...')
    
    try {
      if (!credentials.projectId || !credentials.apiToken || !credentials.spaceUrl) {
        const message = 'Please enter all SignalWire credentials'
        updateStep('create', 'error', message)
        addLog(message, 'error')
        return
      }
      
      const roomName = `reusable_room_${Date.now()}`
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const baseUrl = `https://${credentials.spaceUrl}/api/video`
      
      // Create room with longer settings for reuse
      const roomResponse = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          display_name: `Reusable Test Room`,
          max_participants: 10,
          enable_recording: false
        })
      })
      
      if (!roomResponse.ok) {
        const errorText = await roomResponse.text()
        const message = `Room creation failed: ${roomResponse.status} ${errorText}`
        updateStep('create', 'error', message)
        addLog(message, 'error')
        return
      }
      
      const roomData = await roomResponse.json()
      
      // Create a long-lived token (24 hours)
      const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: `reusable_user_${Date.now()}`,
          room_name: roomName,
          join_as: 'member',
          permissions: [
            'room.self.audio_mute',
            'room.self.audio_unmute',
            'room.self.video_mute',
            'room.self.video_unmute'
          ],
          expires_in: 86400 // 24 hours
        })
      })
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        const message = `Token creation failed: ${tokenResponse.status} ${errorText}`
        updateStep('create', 'error', message)
        addLog(message, 'error')
        return
      }
      
      const tokenData = await tokenResponse.json()
      
      const info = {
        room: roomData,
        token: tokenData.token,
        createdAt: new Date().toISOString()
      }
      
      setRoomInfo(info)
      updateStep('create', 'success', `Room created: ${roomData.name}`)
      addLog(`✅ Long-lived room created: ${roomData.name}`, 'success')
      addLog(`Token expires in 24 hours`, 'info')
      
    } catch (error: any) {
      addLog(`Error creating room: ${error.message}`, 'error')
      updateStep('create', 'error', error.message)
    } finally {
      setIsRunning(false)
    }
  }

  // Join the existing room (this should be fast)
  const joinExistingRoom = async () => {
    if (!roomInfo) {
      addLog('No room available - create a room first', 'error')
      return
    }

    setIsConnecting(true)
    setTotalTime(null)
    startTimeRef.current = Date.now()
    
    updateStep('connect', 'running')
    addLog('Joining pre-existing room...')
    
    try {
      if (!videoContainerRef.current) {
        const message = 'Video container not ready'
        updateStep('connect', 'error', message)
        addLog(message, 'error')
        return
      }
      
      // Join existing room with existing token
      const roomSession = new Video.RoomSession({
        token: roomInfo.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug' // Keep debug to see what's happening
      })
      
      clientRef.current = roomSession
      
      // Track connection events
      roomSession.on('room.joined', (params: any) => {
        const elapsed = Date.now() - startTimeRef.current
        addLog(`🎉 JOINED EXISTING ROOM in ${elapsed}ms!`, 'success')
        updateStep('connect', 'success', `Connected in ${elapsed}ms`)
        setTotalTime(elapsed)
        setIsConnecting(false)
      })
      
      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`❌ Connection error: ${error.message}`, 'error')
        updateStep('connect', 'error', error.message)
        setIsConnecting(false)
      })

      roomSession.on('member.joined', (params: any) => {
        addLog(`Member joined: ${params.member.name}`, 'info')
      })

      roomSession.on('member.left', (params: any) => {
        addLog(`Member left: ${params.member.name}`, 'info')
      })
      
      // Join the existing room
      addLog('Calling join() on existing room...')
      await roomSession.join()
      addLog('Join method completed', 'success')
      
    } catch (error: any) {
      addLog(`Fatal error: ${error.message}`, 'error')
      updateStep('connect', 'error', error.message)
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (clientRef.current) {
      try {
        addLog('Leaving room...')
        await clientRef.current.leave()
        clientRef.current = null
        addLog('Left room successfully', 'success')
        updateStep('connect', 'pending', undefined)
      } catch (error: any) {
        addLog(`Error leaving room: ${error.message}`, 'error')
      }
    }
  }

  const clearLogs = () => {
    setLogs([])
    setTotalTime(null)
  }

  const clearRoom = () => {
    setRoomInfo(null)
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, startTime: undefined, endTime: undefined })))
    clearLogs()
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🔄 Reusable Room Test</h1>
          <p className="lead mb-4">
            Theory: The 43-second delay might be room initialization. This test creates a room once, then tests joining the existing room multiple times.
          </p>

          {/* Performance Summary */}
          {totalTime && (
            <div className={`alert ${totalTime < 5000 ? 'alert-success' : 'alert-warning'} mb-4`}>
              <h4>⏱️ Join Time: {totalTime}ms</h4>
              <p className="mb-0">
                If this is still ~43 seconds, the delay is in WebRTC negotiation, not room creation.
              </p>
            </div>
          )}

          {/* Room Status */}
          {roomInfo && (
            <div className="alert alert-info mb-4">
              <h5>📡 Room Ready</h5>
              <p className="mb-1"><strong>Room:</strong> {roomInfo.room.name}</p>
              <p className="mb-1"><strong>Created:</strong> {new Date(roomInfo.createdAt).toLocaleString()}</p>
              <p className="mb-0"><strong>Status:</strong> Ready for fast joins</p>
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
              className="btn btn-primary"
              onClick={createLongLivedRoom}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Creating Room...
                </>
              ) : (
                '🏗️ Create Long-Lived Room'
              )}
            </button>
            
            <button
              className="btn btn-success btn-lg"
              onClick={joinExistingRoom}
              disabled={isConnecting || !roomInfo}
            >
              {isConnecting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Joining...
                </>
              ) : (
                '⚡ Join Existing Room'
              )}
            </button>
            
            <button
              className="btn btn-danger"
              onClick={disconnect}
              disabled={!clientRef.current}
            >
              Leave Room
            </button>
            
            <button
              className="btn btn-light"
              onClick={clearLogs}
            >
              Clear Logs
            </button>
            
            <button
              className="btn btn-outline-secondary"
              onClick={clearRoom}
            >
              Clear Room
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
              <h3 className="card-title">Connection Logs</h3>
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
                  <div className="text-muted">Create a room, then test joining it</div>
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
              <strong>Hypothesis:</strong> The 43-second delay might be SignalWire's MCU (Media Control Unit) initializing the room infrastructure.
            </p>
            <ul className="mb-0">
              <li><strong>Step 1:</strong> Create a room once (may take 43+ seconds)</li>
              <li><strong>Step 2:</strong> Join the existing room multiple times (should be much faster)</li>
              <li><strong>Result:</strong> If Step 2 is still slow, the delay is in WebRTC negotiation, not room setup</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReusableRoomTest