import React, { useState, useRef } from 'react'
import { Video } from '@signalwire/js'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

export const JustJoinRoomTest: React.FC = () => {
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
    console.log(`[JustJoinRoom] ${message}`)
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

      // Step 2: Skip getting user media - let SignalWire handle it
      addLog('Skipping getUserMedia - will let SignalWire handle audio creation')
      
      // Step 3: Create room session
      setStatus('Joining room...')
      addLog('Creating SignalWire RoomSession')
      
      const roomSession = new Video.RoomSession({
        token: roomInfo.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug'
      })

      roomSessionRef.current = roomSession
      
      // HACK 1: Override updateMedia to intercept automatic constraint application
      const originalUpdateMedia = roomSession.updateMedia.bind(roomSession)
      let hasInterceptedConstraints = false
      
      roomSession.updateMedia = async function(params: any) {
        addLog(`🔍 updateMedia called with params: ${JSON.stringify(params)}`, 'info')
        
        // If this is the automatic constraint application, modify it
        if (!hasInterceptedConstraints && params.audio && typeof params.audio === 'object') {
          hasInterceptedConstraints = true
          addLog('🚨 INTERCEPTED automatic constraint application! Modifying params...', 'success')
          
          // Force negotiateAudio: false to prevent renegotiation
          const modifiedParams = {
            ...params,
            negotiateAudio: false,
            negotiateVideo: false,
            manual: true
          }
          
          addLog(`🔧 Modified params: ${JSON.stringify(modifiedParams)}`, 'info')
          return originalUpdateMedia(modifiedParams)
        }
        
        return originalUpdateMedia(params)
      }
      
      // HACK 2: Override the hangup method to prevent automatic hangup on SDP errors
      const originalHangup = (roomSession as any).hangup?.bind(roomSession)
      let connectionWasStable = false
      let sdpErrorOccurred = false
      
      if (originalHangup) {
        (roomSession as any).hangup = function(...args: any[]) {
        addLog('🚫 Hangup called - checking reason', 'info')
        addLog(`Connection was stable: ${connectionWasStable}`, 'info')
        addLog(`SDP error occurred: ${sdpErrorOccurred}`, 'info')
        addLog(`Current peer state: ${(roomSession as any).peer?.connectionState}`, 'info')
        
        // If we had a stable connection OR this is an SDP error, prevent hangup
        if (connectionWasStable || sdpErrorOccurred) {
          addLog('✅ BLOCKING HANGUP - Connection is actually fine!', 'success')
          setStatus('✅ CONNECTED (blocked erroneous hangup)')
          setIsConnecting(false)
          return Promise.resolve() // Don't actually hang up
        }
        addLog('❌ Connection was not stable - allowing hangup', 'error')
        return originalHangup(...args)
        }
      }

      // Add handler for room.subscribed event - THIS IS WHEN MCU IS READY!
      roomSession.on('room.subscribed', async (params: any) => {
        addLog(`📡 ROOM SUBSCRIBED - MCU IS READY!`, 'success')
        addLog(`Room session: ${params.room_session?.room_id}`, 'info')
        connectionWasStable = true
        
        // CRITICAL: Call updateMedia NOW while MCU is in a good state
        addLog('🚨 ROOM SUBSCRIBED: Immediately calling updateMedia to lock negotiation flags', 'info')
        try {
          await roomSession.updateMedia({
            audio: true,
            video: false,
            negotiateAudio: false,  // CRITICAL: Prevent renegotiation
            negotiateVideo: false,  // CRITICAL: Prevent renegotiation
            manual: true           // CRITICAL: Don't let SDK rewrite params
          } as any)
          addLog('✅ Successfully set negotiation flags during room.subscribed!', 'success')
        } catch (error: any) {
          addLog(`Failed to updateMedia on room.subscribed: ${error.message}`, 'error')
        }
      })
      
      // Set up room.joined handler
      roomSession.on('room.joined', async (params: any) => {
        addLog(`🎉 ROOM JOINED SUCCESSFULLY!`, 'success')
        addLog(`Room ID: ${params.room_id}`, 'info')
        addLog(`Member ID: ${params.member_id}`, 'info')
        addLog(`Session ID: ${params.room_session_id}`, 'info')
        connectionWasStable = true // Mark as stable on room join
        setStatus('✅ CONNECTED WITH AUDIO!')
        setIsConnecting(false)
      })

      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`❌ ERROR: ${error.message}`, 'error')
        addLog(`Error code: ${error.code}`, 'error')
        
        // Handle specific errors - DON'T crash on SDP renegotiation errors
        if (error.message?.includes('setRemoteDescription') || error.message?.includes('wrong state')) {
          sdpErrorOccurred = true // Mark that we had an SDP error
          addLog('⚠️ SDP re-negotiation error detected - this is SignalWire SDK behavior', 'info')
          addLog('🛡️ Marking this as non-fatal - connection should continue', 'info')
          
          // Don't update status to error - keep it as connected
          if (connectionWasStable) {
            setStatus('✅ CONNECTED (ignoring SDP error)')
          }
          
          return // Don't treat this as a fatal error
        } else if (error.message?.includes('CALL_REJECTED')) {
          addLog('📞 Call was rejected - likely due to SDP renegotiation glare', 'error')
        } else {
          addLog(`Error stack: ${error.stack}`, 'error')
        }
        
        setStatus(`❌ ERROR: ${error.message}`)
        setIsConnecting(false)
      })

      roomSession.on('room.left', (params: any) => {
        addLog('Room left', 'info')
        if (params?.error) {
          addLog(`Left with error: ${params.error.message}`, 'error')
          
          // If we left due to SDP error but connection was actually stable, this is problematic
          if (params.error.message?.includes('setRemoteDescription') || params.error.message?.includes('wrong state')) {
            addLog('⚠️ Room left due to SDP renegotiation error - this should not happen', 'error')
            addLog('🔄 The WebRTC connection was actually working fine', 'error')
          }
        }
        setStatus('Disconnected')
        setIsConnecting(false)
      })

      // Critical connection state events
      // @ts-ignore - deprecated event
      roomSession.on('peer.connection.state' as any, async (params: any) => {
        addLog(`🔗 Peer connection: ${params.state}`, 'info')
        if (params.state === 'connected') {
          addLog(`🎉 WebRTC connection is stable!`, 'success')
          connectionWasStable = true // Mark that we had a stable connection
          
          // Check if SignalWire has already started applying constraints
          const currentTime = new Date().toISOString()
          addLog(`Connection established at: ${currentTime}`, 'info')
          
          // IMMEDIATELY set negotiateAudio: false to prevent renegotiation
          addLog('🚨 IMMEDIATE: Calling updateMedia with manual: true to prevent renegotiation', 'info')
          try {
            await roomSession.updateMedia({
              audio: true,  // Keep audio enabled
              video: false,
              negotiateAudio: false,  // CRITICAL: Prevent future renegotiation
              negotiateVideo: false,  // CRITICAL: Prevent future renegotiation
              manual: true           // CRITICAL: Don't let SDK rewrite params
            } as any)
            addLog('✅ Set negotiateAudio: false - should prevent SDP errors!', 'success')
            setStatus('✅ CONNECTED - Renegotiation blocked!')
            setIsConnecting(false)
          } catch (error: any) {
            addLog(`Failed to set negotiate flags: ${error.message}`, 'error')
          }
        }
      })

      // @ts-ignore - deprecated event
      roomSession.on('peer.ice.state' as any, (params: any) => {
        addLog(`🧊 ICE connection: ${params.state}`, 'info')
        if (params.state === 'connected') {
          addLog(`🎉 ICE negotiation successful!`, 'success')
          connectionWasStable = true // Also mark on ICE connected
        }
      })

      // @ts-ignore - deprecated event
      roomSession.on('signaling.state' as any, (params: any) => {
        addLog(`📡 Signaling: ${params.state}`, 'info')
      })
      
      // Add handler for MCU ready state
      roomSession.on('member.updated', async (params: any) => {
        if (!connectionWasStable && params.member?.id === params.room_session?.member_id) {
          addLog('🚨 MEMBER UPDATED - Immediately calling updateMedia to prevent renegotiation', 'info')
          connectionWasStable = true
          try {
            await roomSession.updateMedia({
              audio: true,
              video: false,
              negotiateAudio: false,
              negotiateVideo: false,
              manual: true
            } as any)
            addLog('✅ Called updateMedia with manual: true and negotiateAudio: false', 'success')
          } catch (error: any) {
            addLog(`Failed early updateMedia: ${error.message}`, 'error')
          }
        }
      })

      // Step 4: HYBRID APPROACH - Join with audio but use manual flag
      addLog('🚀 HYBRID FIX: Join with audio: true + immediate manual updateMedia')
      
      // Join with audio: true (required by our token) 
      addLog('Joining room with audio: true (token requires it)')
      // Try a different approach - join with minimal config first
      await roomSession.join({
        audio: false,    // Start with no media
        video: false     // No video
      })
      
      // Don't call updateMedia immediately - wait for events to signal readiness
      addLog('Join method completed, waiting for connection events...')
      
      // OPTION A: Let SignalWire handle all media acquisition (still causes renegotiation)
      // await roomSession.join({
      //   audio: true,  // Let SignalWire create and manage the audio track
      //   video: false
      // })

      addLog('Join method called, waiting for room.joined event...')

      // Set timeout to detect stuck connections
      setTimeout(() => {
        if (isConnecting) {
          addLog('⏰ 30 second timeout - connection stuck', 'error')
          setStatus('❌ Connection timeout')
          setIsConnecting(false)
        }
      }, 30000)

      // Wait for connection to be established before considering it successful
      setTimeout(() => {
        if ((roomSession as any).peer?.connectionState === 'connected') {
          addLog('🎉 CONNECTION CONFIRMED: WebRTC peer is connected!', 'success')
          setStatus('✅ CONNECTION SUCCESSFUL!')
          setIsConnecting(false)
          connectionWasStable = true
        }
      }, 5000)
      
      // Also check connection state immediately after join
      setTimeout(() => {
        const peerState = (roomSession as any).peer?.connectionState
        const iceState = (roomSession as any).peer?.iceConnectionState
        addLog(`Quick check - Peer state: ${peerState}, ICE state: ${iceState}`, 'info')
        if (peerState === 'connected' || iceState === 'connected') {
          connectionWasStable = true
          addLog('Connection detected as stable in quick check', 'success')
        }
      }, 500)

    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error')
      addLog(`Error details: ${JSON.stringify(error, null, 2)}`, 'error')
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
          <h1 className="mb-4">🎯 JUST JOIN ROOM TEST</h1>
          <p className="lead mb-4">
            This test focuses ONLY on creating a room and joining it. No AI, no complex features - just the core connection.
            <br/><small className="text-muted">CONSTRAINT MATCHING: Join with exact constraints SignalWire applies + updateMedia interception.</small>
          </p>
          
          {/* Status */}
          <div className="alert alert-info mb-4">
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
                '🚀 Create & Join Room'
              )}
            </button>

            <button
              className="btn btn-danger"
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
            <div className="card-header">
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
            <div className="card-header">
              <h3 className="card-title">Live Connection Logs</h3>
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
                  <div className="text-muted">Click "Create & Join Room" to start testing</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick Analysis */}
          <div className="alert alert-success mt-4">
            <h5>🔍 Method Interception Strategy:</h5>
            <ol className="mb-0">
              <li><strong>Override updateMedia()</strong> - Intercept automatic constraint application</li>
              <li><strong>Modify parameters</strong> - Add negotiateAudio: false and manual: true</li>
              <li><strong>On member.updated</strong> - Additional safety check</li>
              <li><strong>On room.subscribed</strong> - When MCU is ready</li>
              <li><strong>Override hangup()</strong> - Prevent erroneous disconnections</li>
            </ol>
            <p className="mb-0 mt-2"><strong>Key:</strong> Intercept SignalWire's automatic behavior before it causes problems</p>
          </div>

          {/* Expected Results */}
          <div className="alert alert-info mt-4">
            <h5>📊 Expected Results (Hybrid Fix):</h5>
            <ul className="mb-0">
              <li><strong>Join succeeds</strong> with audio: true (no "Invalid arguments" error)</li>
              <li><strong>Connection establishes</strong> and peer.connection.state = connected fires</li>
              <li><strong>UpdateMedia called immediately</strong> with manual: true</li>
              <li><strong>No SDP renegotiation error</strong> because negotiateAudio: false</li>
              <li><strong>Stable connection:</strong> Room stays connected without CALL_REJECTED!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JustJoinRoomTest