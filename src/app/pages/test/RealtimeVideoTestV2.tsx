import React, { useState, useRef } from 'react'
import { SignalWire } from '@signalwire/realtime-api'
import { Video } from '@signalwire/realtime-api'
import { supabase } from '../../../supabaseClient'

export const RealtimeVideoTestV2: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready')
  const [logs, setLogs] = useState<string[]>([])
  const [roomData, setRoomData] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const clientRef = useRef<any>(null)
  const roomSessionRef = useRef<any>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
    console.log(`[RealtimeV2] ${message}`)
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
      addLog(`Token preview: ${roomInfo.token.substring(0, 50)}...`, 'info')

      // Step 2: Analyze the token
      try {
        const tokenParts = roomInfo.token.split('.')
        if (tokenParts.length === 3) {
          addLog('Token appears to be a JWT', 'info')
          const payload = JSON.parse(atob(tokenParts[1]))
          addLog(`Token payload: ${JSON.stringify(payload, null, 2)}`, 'info')
        }
      } catch (e) {
        addLog('Could not decode token', 'info')
      }

      // Step 3: Try different approaches with Realtime SDK
      addLog('=== APPROACH 1: Direct token usage ===', 'info')
      
      try {
        const client1 = await SignalWire({
          token: roomInfo.token,
          project: import.meta.env.VITE_SIGNALWIRE_PROJECT_ID || 'default-project',
          debug: { 
            logWsTraffic: true
          }
        })
        
        addLog('Client created with room token!', 'success')
        clientRef.current = client1
        
        // Try to access video namespace
        addLog('Checking video namespace...', 'info')
        if (client1.video) {
          addLog('Video namespace exists!', 'success')
          
          // Check available methods on video namespace
          const videoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(client1.video))
          addLog(`Video methods: ${videoMethods.join(', ')}`, 'info')
          
          // Try different join methods
          if ((client1.video as any).joinRoom) {
            addLog('joinRoom method exists', 'info')
            const roomSession = await (client1.video as any).joinRoom({
              roomName: roomInfo.name,
              rootElement: videoContainerRef.current,
              audio: true,
              video: false
            })
            
            addLog('Room joined successfully!', 'success')
            roomSessionRef.current = roomSession
          } else if (client1.video.getRoomSessions) {
            addLog('Trying getRoomSessions...', 'info')
            const { roomSessions } = await client1.video.getRoomSessions()
            addLog(`Found ${roomSessions.length} room sessions`, 'info')
          } else {
            addLog('No familiar join methods found', 'error')
          }
          
        } else {
          addLog('No video namespace found', 'error')
        }
        
      } catch (error1: any) {
        addLog(`Approach 1 failed: ${error1.message}`, 'error')
        
        // Step 4: Try creating a Video.RoomSession directly
        addLog('=== APPROACH 2: Video.RoomSession with token ===', 'info')
        
        try {
          // Import Video namespace differently
          const { Video: VideoNamespace } = await import('@signalwire/realtime-api')
          
          if (VideoNamespace && (VideoNamespace as any).RoomSession) {
            const roomSession = new (VideoNamespace as any).RoomSession({
              token: roomInfo.token,
              rootElement: videoContainerRef.current,
              audio: true,
              video: false
            })
            
            addLog('RoomSession created!', 'success')
            roomSessionRef.current = roomSession
            
            // Set up events
            roomSession.on('room.joined', () => {
              addLog('🎉 Room joined!', 'success')
              setStatus('✅ CONNECTED!')
              setIsConnecting(false)
            })
            
            roomSession.on('error', (error: any) => {
              addLog(`Room error: ${error.message}`, 'error')
            })
            
            // Join room
            addLog('Attempting to join...', 'info')
            await roomSession.join()
            
          } else {
            addLog('Video.RoomSession not found in Realtime SDK', 'error')
          }
          
        } catch (error2: any) {
          addLog(`Approach 2 failed: ${error2.message}`, 'error')
          
          // Step 5: Important discovery about the SDK
          addLog('=== IMPORTANT DISCOVERY ===', 'info')
          addLog('The Realtime SDK files are:', 'info')
          addLog('- index.node.js (CommonJS for Node.js)', 'info')
          addLog('- index.node.mjs (ES modules for Node.js)', 'info')
          addLog('NO BROWSER BUILD FOUND!', 'error')
          addLog('This SDK is for Node.js server-side use only!', 'error')
          
          addLog('=== SOLUTION ===', 'success')
          addLog('For browser-based video rooms, use @signalwire/js (not realtime-api)', 'success')
          addLog('The Realtime SDK v4 is for server-side applications', 'success')
          addLog('Room tokens work with @signalwire/js Video.RoomSession', 'success')
        }
      }

    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error')
      addLog(`Error type: ${error.constructor.name}`, 'error')
      if (error.code) {
        addLog(`Error code: ${error.code}`, 'error')
      }
      setStatus(`❌ FAILED: ${error.message}`)
      setIsConnecting(false)
    }
  }

  const leaveRoom = async () => {
    try {
      addLog('Leaving room...')
      
      if (roomSessionRef.current) {
        if (roomSessionRef.current.leave) {
          await roomSessionRef.current.leave()
        } else if (roomSessionRef.current.disconnect) {
          await roomSessionRef.current.disconnect()
        }
        roomSessionRef.current = null
      }
      
      if (clientRef.current) {
        if (clientRef.current.disconnect) {
          await clientRef.current.disconnect()
        }
        clientRef.current = null
      }
      
      setStatus('Disconnected')
      addLog('Cleanup completed', 'success')
    } catch (error: any) {
      addLog(`Error during cleanup: ${error.message}`, 'error')
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
          <h1 className="mb-4">🔬 Realtime SDK v4 Deep Dive Test</h1>
          <p className="lead mb-4">
            This test thoroughly explores all possible ways to use Realtime SDK v4 with video rooms.
            <br/><small className="text-muted">Testing multiple approaches and authentication methods.</small>
          </p>
          
          {/* Status */}
          <div className="alert alert-info mb-4">
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
                  Testing...
                </>
              ) : (
                '🔬 Run Deep Test'
              )}
            </button>

            <button
              className="btn btn-danger"
              onClick={leaveRoom}
              disabled={isConnecting}
            >
              Stop/Leave
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
              <h3 className="card-title mb-0">Video Container</h3>
            </div>
            <div className="card-body">
              <div 
                ref={videoContainerRef}
                style={{ 
                  minHeight: '300px',
                  backgroundColor: '#000',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <p className="text-white-50">Video will appear here if connection succeeds</p>
              </div>
            </div>
          </div>

          {/* Live Logs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Deep Test Logs</h3>
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
                  <div className="text-muted">Click "Run Deep Test" to explore all options</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Test Approaches */}
          <div className="alert alert-info mt-4">
            <h5>🔬 Test Approaches:</h5>
            <ol className="mb-0">
              <li><strong>Direct Token</strong> - Try using room token with SignalWire client</li>
              <li><strong>Video.RoomSession</strong> - Try importing Video namespace directly</li>
              <li><strong>Project Credentials</strong> - Try using project auth if available</li>
              <li><strong>Token Analysis</strong> - Decode and examine the token structure</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealtimeVideoTestV2