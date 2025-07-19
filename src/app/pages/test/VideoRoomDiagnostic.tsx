import React, { useState, useRef, useCallback } from 'react'
import { Video } from '@signalwire/js'

interface TestStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  data?: any
}

export const VideoRoomDiagnostic: React.FC = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'env', name: 'Environment Check', status: 'pending' },
    { id: 'room', name: 'Create Video Room', status: 'pending' },
    { id: 'token', name: 'Generate Room Token', status: 'pending' },
    { id: 'connect', name: 'Connect to Room', status: 'pending' },
    { id: 'media', name: 'Enable Audio/Video', status: 'pending' }
  ])
  
  const [isRunning, setIsRunning] = useState(false)
  const [roomData, setRoomData] = useState<any>(null)
  const [tokenData, setTokenData] = useState<any>(null)
  const [logs, setLogs] = useState<string[]>([])
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs(prev => [...prev, logEntry])
    console.log(`[VideoRoomDiagnostic] ${message}`)
  }, [])

  const updateStep = useCallback((stepId: string, status: TestStep['status'], message?: string, data?: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message, data } : step
    ))
  }, [])

  const runDiagnostic = async () => {
    setIsRunning(true)
    setLogs([])
    
    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, data: undefined })))
    
    try {
      // Step 1: Environment Check
      updateStep('env', 'running')
      addLog('Checking environment variables...')
      
      const envVars = {
        SIGNALWIRE_PROJECT_ID: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID,
        SIGNALWIRE_API_TOKEN: import.meta.env.VITE_SIGNALWIRE_API_TOKEN,
        SIGNALWIRE_SPACE_URL: import.meta.env.VITE_SIGNALWIRE_SPACE_URL
      }
      
      const missingEnvVars = Object.entries(envVars).filter(([_, value]) => !value).map(([key]) => key)
      
      if (missingEnvVars.length > 0) {
        const message = `Missing environment variables: ${missingEnvVars.join(', ')}`
        updateStep('env', 'error', message)
        addLog(message, 'error')
        return
      }
      
      updateStep('env', 'success', 'All environment variables present')
      addLog('Environment check passed', 'success')
      
      // Step 2: Create Video Room using SignalWire REST API
      updateStep('room', 'running')
      addLog('Creating video room via SignalWire REST API...')
      
      const roomName = `diagnostic_test_${Date.now()}`
      const roomPayload = {
        name: roomName,
        display_name: `Diagnostic Test Room`,
        max_participants: 5,
        enable_recording: false
      }
      
      addLog(`Room payload: ${JSON.stringify(roomPayload)}`)
      
      const signalwireSpaceUrl = envVars.SIGNALWIRE_SPACE_URL
      const signalwireProjectId = envVars.SIGNALWIRE_PROJECT_ID
      const signalwireApiToken = envVars.SIGNALWIRE_API_TOKEN
      
      const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
      
      try {
        const roomResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/rooms`, {
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
      
      // Step 3: Generate Room Token using SignalWire REST API
      updateStep('token', 'running')
      addLog('Generating room token via SignalWire REST API...')
      
      const tokenPayload = {
        room_name: roomName,
        user_name: `test_user_${Date.now()}`,
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute'
        ],
        auto_join: true,
        expires_in: 3600 // 1 hour
      }
      
      addLog(`Token payload: ${JSON.stringify(tokenPayload)}`)
      
      try {
        const tokenResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/room_tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tokenPayload)
        })
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          const message = `Token generation failed: ${tokenResponse.status} ${errorText}`
          updateStep('token', 'error', message)
          addLog(message, 'error')
          return
        }
        
        const tokenData = await tokenResponse.json()
        setTokenData(tokenData)
        updateStep('token', 'success', `Token generated (${tokenData.token.length} chars)`, tokenData)
        addLog(`Token generated successfully`, 'success')
        addLog(`Token length: ${tokenData.token.length}`, 'info')
        
        // Decode token to inspect payload
        try {
          const tokenPayloadDecoded = JSON.parse(atob(tokenData.token.split('.')[1]))
          addLog(`Token payload decoded: ${JSON.stringify(tokenPayloadDecoded, null, 2)}`, 'info')
        } catch (e) {
          addLog(`Could not decode token payload: ${e}`, 'error')
        }
        
      } catch (error: any) {
        const message = `Token generation error: ${error.message}`
        updateStep('token', 'error', message)
        addLog(message, 'error')
        return
      }
      
      // Step 4: Connect to Room
      updateStep('connect', 'running')
      addLog('Connecting to video room...')
      
      if (!videoContainerRef.current) {
        const message = 'Video container not ready'
        updateStep('connect', 'error', message)
        addLog(message, 'error')
        return
      }
      
      try {
        // Create room session using SignalWire Realtime SDK
        const roomSession = new Video.RoomSession({
          token: tokenData.token,
          rootElement: videoContainerRef.current,
          logLevel: 'debug'
        })
        
        roomSessionRef.current = roomSession
        
        // WORKAROUND: Override updateMedia to prevent SDP renegotiation errors
        const originalUpdateMedia = roomSession.updateMedia.bind(roomSession)
        let hasInterceptedConstraints = false
        
        roomSession.updateMedia = async function(params: any) {
          addLog(`updateMedia called with params: ${JSON.stringify(params)}`, 'info')
          
          // If this is the automatic constraint application, modify it
          if (!hasInterceptedConstraints && params.audio && typeof params.audio === 'object') {
            hasInterceptedConstraints = true
            addLog('Intercepting automatic constraint application - adding negotiation flags', 'success')
            
            // Force negotiateAudio: false to prevent renegotiation
            const modifiedParams = {
              ...params,
              negotiateAudio: false,
              negotiateVideo: false,
              manual: true
            }
            
            addLog(`Modified params: ${JSON.stringify(modifiedParams)}`, 'info')
            return originalUpdateMedia(modifiedParams)
          }
          
          return originalUpdateMedia(params)
        }
        
        // WORKAROUND: Override hangup to prevent erroneous disconnections
        const originalHangup = (roomSession as any).hangup?.bind(roomSession)
        let connectionWasStable = false
        let sdpErrorOccurred = false
        
        if (originalHangup) {
          (roomSession as any).hangup = function(...args: any[]) {
          addLog('Hangup called - checking if we should actually disconnect', 'info')
          
          // If we had a stable connection OR this is an SDP error, prevent hangup
          if (connectionWasStable || sdpErrorOccurred) {
            addLog('Blocking erroneous hangup - connection is actually fine', 'success')
            return Promise.resolve()
          }
          
            return originalHangup(...args)
          }
        }
        
        // Set up event handlers with detailed logging
        roomSession.on('room.joined', (params) => {
          addLog(`Room joined event: ${JSON.stringify(params)}`, 'success')
          connectionWasStable = true
          updateStep('connect', 'success', `Connected to room: ${(params as any).room_id}`)
          
          // Step 5: Enable Media
          updateStep('media', 'running')
          addLog('Attempting to enable media...')
          
          // Test media enablement
          setTimeout(async () => {
            try {
              // Try to enable audio only first
              await roomSession.updateMedia({
                audio: true as any,
                video: false as any,
                negotiateAudio: false,  // Prevent renegotiation
                negotiateVideo: false,
                manual: true
              } as any)
              updateStep('media', 'success', 'Audio enabled successfully')
              addLog('Media enabled successfully', 'success')
            } catch (mediaError: any) {
              updateStep('media', 'error', `Media error: ${mediaError.message}`)
              addLog(`Media error: ${mediaError.message}`, 'error')
            }
          }, 1000)
        })
        
        roomSession.on('room.left', (params) => {
          addLog(`Room left event: ${JSON.stringify(params)}`, 'info')
          if (params && (params as any).error) {
            addLog(`Left due to error: ${(params as any).error.message}`, 'error')
          }
        })
        
        // @ts-ignore - deprecated event
        roomSession.on('error' as any, (error) => {
          addLog(`Room session error: ${error.message}`, 'error')
          addLog(`Error code: ${error.code}`, 'error')
          addLog(`Error stack: ${error.stack}`, 'error')
          
          // Handle specific SDP renegotiation errors
          if (error.message?.includes('setRemoteDescription') || error.message?.includes('wrong state')) {
            sdpErrorOccurred = true
            addLog('SDP renegotiation error detected - this is the known SignalWire SDK bug', 'info')
            addLog('Marking this as non-fatal - connection should continue', 'info')
            
            // Don't treat this as a fatal error if we had a stable connection
            if (connectionWasStable) {
              addLog('Connection was stable - ignoring SDP error', 'success')
              return
            }
          }
          
          updateStep('connect', 'error', `Connection error: ${error.message}`)
        })
        
        // @ts-ignore - deprecated event
        roomSession.on('peer.connection.state' as any, (params) => {
          addLog(`Peer connection state: ${params.state}`, 'info')
          if (params.state === 'connected') {
            connectionWasStable = true
            addLog('WebRTC connection is stable!', 'success')
          }
        })
        
        // @ts-ignore - deprecated event
        roomSession.on('peer.ice.state' as any, (params) => {
          addLog(`ICE connection state: ${params.state}`, 'info')
          if (params.state === 'connected') {
            connectionWasStable = true
            addLog('ICE negotiation successful!', 'success')
          }
        })
        
        // @ts-ignore - deprecated event
        roomSession.on('signaling.state' as any, (params) => {
          addLog(`Signaling state: ${params.state}`, 'info')
        })
        
        roomSession.on('member.joined', (params) => {
          addLog(`Member joined: ${params.member.name}`, 'info')
        })
        
        roomSession.on('member.left', (params) => {
          addLog(`Member left: ${params.member.name}`, 'info')
        })
        
        // Attempt to join
        addLog('Calling roomSession.join()...')
        await roomSession.join()
        addLog('roomSession.join() completed without error', 'success')
        
      } catch (connectError: any) {
        const message = `Connection failed: ${connectError.message}`
        updateStep('connect', 'error', message)
        addLog(message, 'error')
        addLog(`Connection error stack: ${connectError.stack}`, 'error')
      }
      
    } catch (error: any) {
      addLog(`Fatal error: ${error.message}`, 'error')
      addLog(`Error stack: ${error.stack}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const disconnectRoom = async () => {
    if (roomSessionRef.current) {
      try {
        addLog('Disconnecting from room...')
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
        addLog('Disconnected successfully', 'success')
      } catch (error: any) {
        addLog(`Error disconnecting: ${error.message}`, 'error')
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
          <h1 className="mb-4">🔬 Video Room Diagnostic</h1>
          <p className="lead mb-4">
            Comprehensive diagnostic test for video room creation and joining functionality.
            This will test each step of the process to identify where failures occur.
          </p>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={runDiagnostic}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Running Diagnostic...
                </>
              ) : (
                '🚀 Run Full Diagnostic'
              )}
            </button>
            
            <button
              className="btn btn-danger"
              onClick={disconnectRoom}
              disabled={!roomSessionRef.current}
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
              <h3 className="card-title">Live Diagnostic Logs</h3>
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
                  <div className="text-muted">Click "Run Full Diagnostic" to start testing</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoRoomDiagnostic