import React, { useState, useRef } from 'react'
import { Video } from '@signalwire/js'
import { supabase } from '../../../supabaseClient'

export const NuclearOptionTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready')
  const [logs, setLogs] = useState<string[]>([])
  const [roomData, setRoomData] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
    console.log(`[NuclearOption] ${message}`)
  }

  const createAndJoinRoom = async () => {
    try {
      setIsConnecting(true)
      setStatus('Creating room...')
      setLogs([])

      // Step 1: Create room
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

      // Step 2: Get user media FIRST
      addLog('Getting user media BEFORE creating RoomSession')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        },
        video: false
      })
      
      const audioTrack = stream.getAudioTracks()[0]
      addLog(`Got audio track: ${audioTrack.label}`, 'success')
      
      // Step 3: Create room session
      setStatus('Creating room session...')
      addLog('Creating SignalWire RoomSession')
      
      const roomSession = new Video.RoomSession({
        token: roomInfo.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug'
      })

      roomSessionRef.current = roomSession
      
      // NUCLEAR OPTION: Override EVERYTHING
      addLog('🔥 NUCLEAR OPTION: Overriding all SDK methods')
      
      // Store original methods
      const originalJoin = roomSession.join.bind(roomSession)
      const originalUpdateMedia = roomSession.updateMedia.bind(roomSession)
      const originalHangup = (roomSession as any).hangup?.bind(roomSession)
      
      // Track state
      let hasJoined = false
      let isStable = false
      let updateCount = 0
      
      // Override join to prevent negotiate flags
      roomSession.join = async function(params: any) {
        addLog(`🔍 JOIN intercepted with params: ${JSON.stringify(params)}`, 'info')
        
        // Force specific parameters
        const forcedParams = {
          ...params,
          audio: audioTrack, // Pass the track directly
          video: false,
          negotiateAudio: false,
          negotiateVideo: false
        }
        
        addLog(`🔧 Forced params: ${JSON.stringify(forcedParams)}`, 'info')
        const result = await originalJoin(forcedParams)
        hasJoined = true
        return result
      }
      
      // Override updateMedia to block ALL automatic updates
      roomSession.updateMedia = async function(params: any) {
        updateCount++
        addLog(`🔍 UPDATE MEDIA #${updateCount} intercepted: ${JSON.stringify(params)}`, 'info')
        
        // If this is the first automatic update after join, BLOCK IT
        if (updateCount === 1 && hasJoined && !params.manual) {
          addLog('🚫 BLOCKING automatic constraint application!', 'success')
          return Promise.resolve() // Return success without doing anything
        }
        
        // For manual updates, pass through with negotiate flags forced
        if (params.manual) {
          const forcedParams = {
            ...params,
            negotiateAudio: false,
            negotiateVideo: false
          }
          return originalUpdateMedia(forcedParams)
        }
        
        // Block all other automatic updates
        addLog('🚫 BLOCKING automatic update', 'info')
        return Promise.resolve()
      }
      
      // Override hangup to prevent disconnection
      if (originalHangup) {
        (roomSession as any).hangup = function(...args: any[]) {
        addLog('🚫 Hangup intercepted', 'info')
        if (isStable) {
          addLog('✅ Connection is stable - BLOCKING hangup!', 'success')
          return Promise.resolve()
        }
          return originalHangup(...args)
        }
      }
      
      // Set up minimal event handlers
      roomSession.on('room.joined', () => {
        addLog('🎉 ROOM JOINED!', 'success')
        setStatus('✅ CONNECTED!')
        isStable = true
        setIsConnecting(false)
      })

      // @ts-ignore - deprecated event
      roomSession.on('peer.connection.state' as any, (params: any) => {
        addLog(`Peer connection: ${params.state}`, 'info')
        if (params.state === 'connected') {
          isStable = true
        }
      })

      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`Error: ${error.message}`, 'error')
        // Don't update status - we might recover
      })

      // Step 4: Join with our track
      addLog('Attempting join with audio track')
      await roomSession.join({
        audio: audioTrack as any,
        video: false
      })

      addLog('Join completed, waiting for events...')

    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error')
      setStatus(`❌ FAILED: ${error.message}`)
      setIsConnecting(false)
    }
  }

  const leaveRoom = async () => {
    if (roomSessionRef.current) {
      try {
        addLog('Leaving room...')
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
        setStatus('Disconnected')
        addLog('Left room successfully', 'success')
      } catch (error: any) {
        addLog(`Error leaving room: ${error.message}`, 'error')
      }
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
          <h1 className="mb-4">☢️ NUCLEAR OPTION TEST</h1>
          <p className="lead mb-4">
            This test overrides EVERYTHING to prevent automatic SDK behavior.
            <br/><small className="text-muted">Blocks ALL automatic updates, forces negotiate flags, provides track upfront.</small>
          </p>
          
          {/* Status */}
          <div className="alert alert-warning mb-4">
            <h4>Status: {status}</h4>
            {roomData && (
              <div className="mt-2">
                <small>Room: <code>{roomData.name}</code></small>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-danger btn-lg"
              onClick={createAndJoinRoom}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Connecting...
                </>
              ) : (
                '☢️ LAUNCH NUCLEAR OPTION'
              )}
            </button>

            <button
              className="btn btn-dark"
              onClick={leaveRoom}
              disabled={isConnecting || !roomSessionRef.current}
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
            <div className="card-header bg-warning">
              <h3 className="card-title">Video Container</h3>
            </div>
            <div className="card-body">
              <div 
                ref={videoContainerRef}
                style={{ 
                  minHeight: '300px', 
                  backgroundColor: '#f5f5f5',
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
            <div className="card-header bg-dark text-white">
              <h3 className="card-title">Nuclear Option Logs</h3>
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
                  <div className="text-muted">Click "LAUNCH NUCLEAR OPTION" to start</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Strategy */}
          <div className="alert alert-danger mt-4">
            <h5>☢️ Nuclear Option Strategy:</h5>
            <ol className="mb-0">
              <li><strong>Get user media FIRST</strong> - Before creating RoomSession</li>
              <li><strong>Override join()</strong> - Force negotiateAudio: false</li>
              <li><strong>Override updateMedia()</strong> - Block ALL automatic updates</li>
              <li><strong>Override hangup()</strong> - Prevent disconnection after stable</li>
              <li><strong>Pass audio track directly</strong> - Not constraints object</li>
            </ol>
            <p className="mb-0 mt-2"><strong>Goal:</strong> Complete control over SDK behavior</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NuclearOptionTest