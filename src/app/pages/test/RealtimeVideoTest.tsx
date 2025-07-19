import React, { useState, useRef } from 'react'
import { SignalWire } from '@signalwire/realtime-api'
import { supabase } from '../../../supabaseClient'

export const RealtimeVideoTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready')
  const [logs, setLogs] = useState<string[]>([])
  const [roomData, setRoomData] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const clientRef = useRef<any>(null)
  const roomSessionRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
    console.log(`[RealtimeVideo] ${message}`)
  }

  const createAndJoinRoom = async () => {
    try {
      setIsConnecting(true)
      setStatus('Creating room...')
      setLogs([])

      // Step 1: Create room via Edge Function
      addLog('Creating room via create-simple-video-room')
      const { data: createData, error: createError } = await supabase.functions.invoke('create-simple-video-room')
      
      if (createError) {
        addLog(`Room creation failed: ${createError.message}`, 'error')
        throw createError
      }

      if (!createData?.room?.name || !createData?.token) {
        addLog('Invalid room data received', 'error')
        throw new Error('Invalid room data')
      }

      const roomInfo = {
        name: createData.room.name,
        id: createData.room.id,
        token: createData.token
      }

      setRoomData(roomInfo)
      addLog(`Room created: ${roomInfo.name}`, 'success')
      addLog(`Token length: ${roomInfo.token.length}`, 'info')

      // Step 2: Try using the token directly with Realtime SDK
      setStatus('Testing Realtime SDK...')
      addLog('Testing different authentication methods with Realtime SDK v4')
      
      // First, let's decode the token to see what we're working with
      try {
        const tokenParts = roomInfo.token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]))
          addLog(`Token type: ${payload.typ || 'unknown'}`, 'info')
          addLog(`Token subject: ${payload.sub}`, 'info')
          addLog(`Token room: ${payload.r}`, 'info')
          addLog(`Token scopes: ${payload.s?.length || 0} permissions`, 'info')
        }
      } catch (e) {
        addLog('Could not decode token', 'info')
      }
      
      // Approach 1: Try the room token directly
      addLog('=== APPROACH 1: Room token ===', 'info')
      try {
        const client = await SignalWire({
          token: roomInfo.token,
          project: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID || 'default-project'
        })

        clientRef.current = client
        addLog('✅ Client created with room token!', 'success')
        
        // Check what's available on the client
        const clientKeys = Object.keys(client)
        addLog(`Client properties: ${clientKeys.join(', ')}`, 'info')
        
        if (client.video) {
          addLog('Video namespace exists!', 'success')
          // Continue with video operations...
        }

      } catch (tokenError: any) {
        addLog(`Room token failed: ${tokenError.message}`, 'error')
        addLog(`Error code: ${tokenError.code}`, 'error')
        
        // Don't give up - try other approaches
        addLog('Trying alternative approaches...', 'info')
      }
      
      // Approach 2: Try with project credentials if available
      addLog('=== APPROACH 2: Project credentials ===', 'info')
      const projectId = import.meta.env.VITE_SIGNALWIRE_PROJECT_ID
      const apiToken = import.meta.env.VITE_SIGNALWIRE_API_TOKEN
      
      if (projectId && apiToken) {
        try {
          const client = await SignalWire({
            project: projectId,
            token: apiToken
          })
          
          clientRef.current = client
          addLog('✅ Client created with project credentials!', 'success')
          
          // Now try to join the room we created
          if (client.video) {
            addLog('Video namespace available', 'success');
            
            // Listen for room events
            (client.video as any).on('room.started', (roomSession: any) => {
              addLog('🎉 Room started!', 'success')
              roomSessionRef.current = roomSession
              setStatus('✅ CONNECTED!')
              setIsConnecting(false)
            })
            
            // Try to join the room
            // Note: With project auth, we might need to join differently
            addLog(`Attempting to join room: ${roomInfo.name}`, 'info')
          }
          
        } catch (projectError: any) {
          addLog(`Project auth failed: ${projectError.message}`, 'error')
        }
      } else {
        addLog('No project credentials in environment', 'info')
      }
      
      // Approach 3: Check if we need to use a different SDK
      addLog('=== APPROACH 3: SDK analysis ===', 'info')
      addLog('The Realtime SDK might be for server-side use only', 'info')
      addLog('Room tokens might only work with @signalwire/js (not realtime-api)', 'info')

    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error')
      addLog(`Error stack: ${error.stack}`, 'error')
      setStatus(`❌ FAILED: ${error.message}`)
      setIsConnecting(false)
    }
  }

  const leaveRoom = async () => {
    try {
      addLog('Leaving room...')
      
      if (roomSessionRef.current) {
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
      }
      
      if (clientRef.current) {
        await clientRef.current.disconnect()
        clientRef.current = null
      }
      
      setStatus('Disconnected')
      addLog('Left room successfully', 'success')
    } catch (error: any) {
      addLog(`Error leaving room: ${error.message}`, 'error')
    }
  }

  const clearLogs = () => {
    setLogs([])
    setStatus('Ready')
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">⚠️ SignalWire Realtime SDK v4 Test</h1>
          <p className="lead mb-4">
            This test attempts to use the Realtime SDK v4 (@signalwire/realtime-api).
            <br/><small className="text-muted text-danger">NOTE: Realtime SDK uses different auth than Video rooms!</small>
          </p>
          
          <div className="alert alert-danger">
            <h5>⚠️ CRITICAL DISCOVERY:</h5>
            <ul className="mb-0">
              <li><strong>@signalwire/js v3</strong> - For BROWSER Video Rooms (uses room tokens) - HAS SDP BUG</li>
              <li><strong>@signalwire/realtime-api v4</strong> - For NODE.JS SERVER apps only!</li>
              <li>The Realtime SDK has NO BROWSER BUILD (only .node.js files)</li>
              <li>These are completely different products for different environments!</li>
              <li><strong>SOLUTION:</strong> We must use @signalwire/js v3 and fix the SDP bug</li>
            </ul>
          </div>
          
          {/* Status */}
          <div className="alert alert-primary mb-4">
            <h4>Status: {status}</h4>
            {roomData && (
              <div className="mt-2">
                <small>Room: <code>{roomData.name}</code></small>
                <br/>
                <small>Room ID: <code>{roomData.id}</code></small>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={createAndJoinRoom}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Connecting...
                </>
              ) : (
                '🚀 Create & Join Room (v4)'
              )}
            </button>

            <button
              className="btn btn-danger"
              onClick={leaveRoom}
              disabled={isConnecting || !clientRef.current}
            >
              Leave Room
            </button>

            <button
              className="btn btn-light"
              onClick={clearLogs}
            >
              Clear Logs
            </button>
          </div>

          {/* Video Container */}
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h3 className="card-title mb-0">Video Stream</h3>
            </div>
            <div className="card-body">
              <div 
                id="videoContainer"
                style={{ 
                  width: '100%',
                  minHeight: '400px',
                  backgroundColor: '#000',
                  position: 'relative'
                }}
              >
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ 
                    width: '100%',
                    maxHeight: '400px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Live Logs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Realtime SDK v4 Logs</h3>
            </div>
            <div className="card-body">
              <div 
                className="bg-dark text-light p-3 rounded"
                style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-muted">Click "Create & Join Room" to start testing with v4 SDK</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SDK v4 Features */}
          <div className="alert alert-info mt-4">
            <h5>🆕 Realtime SDK v4 Features:</h5>
            <ul className="mb-0">
              <li>Improved WebRTC connection handling</li>
              <li>Better event system with typed events</li>
              <li>Simplified room joining process</li>
              <li>No more SDP renegotiation issues (hopefully!)</li>
              <li>Modern async/await API throughout</li>
            </ul>
          </div>

          {/* Expected Flow */}
          <div className="alert alert-success mt-4">
            <h5>📋 Expected Flow:</h5>
            <ol className="mb-0">
              <li>Create room via Edge Function</li>
              <li>Initialize Realtime client with token</li>
              <li>Get user media (audio only)</li>
              <li>Join room with minimal config</li>
              <li>No SDP renegotiation errors!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealtimeVideoTest