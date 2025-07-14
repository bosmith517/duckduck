import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as SignalWire from '@signalwire/js'

const VideoDebugPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [logs, setLogs] = useState<string[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const [roomSession, setRoomSession] = useState<any>(null)
  
  const swToken = searchParams.get('sw_token')
  
  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }
  
  // Test 1: Basic media access
  const testMediaAccess = async () => {
    addLog('Testing media access...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { facingMode: 'user' } 
      })
      addLog(`✅ Got media stream with ${stream.getTracks().length} tracks`)
      stream.getTracks().forEach(track => {
        addLog(`  - ${track.kind}: ${track.label} (${track.readyState})`)
      })
      setLocalStream(stream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
    } catch (error: any) {
      addLog(`❌ Media access failed: ${error.message}`)
    }
  }
  
  // Test 2: SignalWire connection
  const testSignalWireConnection = async () => {
    if (!swToken || swToken === 'null') {
      addLog('❌ No SignalWire token available')
      return
    }
    
    addLog('Testing SignalWire connection...')
    addLog(`Token (first 50 chars): ${swToken.substring(0, 50)}...`)
    
    try {
      // Check SignalWire SDK
      if (!SignalWire || !SignalWire.Video) {
        addLog('❌ SignalWire SDK not properly loaded')
        return
      }
      
      addLog('✅ SignalWire SDK loaded')
      
      // Create minimal room session
      if (!remoteVideoRef.current) {
        addLog('❌ Remote video container not ready')
        return
      }
      
      addLog('Creating room session...')
      const session = new SignalWire.Video.RoomSession({
        token: swToken,
        rootElement: remoteVideoRef.current
      })
      
      // Set up ALL event handlers before joining
      session.on('room.joined', (e: any) => {
        addLog(`✅ ROOM JOINED: ${JSON.stringify({
          roomId: e.room?.id,
          roomName: e.room?.name,
          memberCount: Object.keys(e.room?.members || {}).length
        })}`)
      })
      
      session.on('member.joined', (e: any) => {
        addLog(`👤 MEMBER JOINED: ${e.member.name || e.member.id}`)
      })
      
      session.on('member.updated', (e: any) => {
        addLog(`👤 MEMBER UPDATED: ${e.member.name || e.member.id} - ${JSON.stringify({
          audioMuted: e.member.audio_muted,
          videoMuted: e.member.video_muted
        })}`)
      })
      
      session.on('track', (e: any) => {
        addLog(`🎥 TRACK EVENT: ${e.type} - ${e.track?.kind}`)
      })
      
      session.on('stream.started', (e: any) => {
        addLog(`📺 STREAM STARTED: ${JSON.stringify(e)}`)
      })
      
      session.on('layout.changed', (e: any) => {
        addLog(`🎨 LAYOUT CHANGED: ${e.layout}`)
      })
      
      session.on('media.connected', () => {
        addLog('✅ MEDIA CONNECTED')
      })
      
      session.on('media.disconnected', () => {
        addLog('❌ MEDIA DISCONNECTED')
      })
      
      session.on('room.updated', (e: any) => {
        addLog(`🔄 ROOM UPDATED: ${Object.keys(e.room?.members || {}).length} members`)
      })
      
      // Handle errors through room.left event instead
      // There's no direct 'error' event in SignalWire SDK
      
      session.on('room.left', (e: any) => {
        addLog(`❌ ROOM LEFT: ${e.reason || 'Unknown reason'}`)
      })
      
      setRoomSession(session)
      
      // Join with explicit media settings
      addLog('Attempting to join room...')
      await session.join({
        audio: true,
        video: true
      })
      
      addLog('✅ Join method completed')
      
    } catch (error: any) {
      addLog(`❌ SignalWire error: ${error.message}`)
      addLog(`Stack: ${error.stack}`)
    }
  }
  
  // Test 3: Check WebRTC stats
  const checkWebRTCStats = async () => {
    if (!roomSession) {
      addLog('❌ No room session to check')
      return
    }
    
    addLog('Checking WebRTC stats...')
    // This would need SignalWire-specific API to get peer connection
    addLog('Stats check not implemented - would need SignalWire API')
  }
  
  // Clean up
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      // Only try to leave if the session is connected
      if (roomSession && roomSession.active) {
        roomSession.leave().catch(console.error)
      }
    }
  }, [localStream, roomSession])
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1>Video Debug Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testMediaAccess} style={{ marginRight: '10px' }}>
          Test Media Access
        </button>
        <button onClick={testSignalWireConnection} style={{ marginRight: '10px' }}>
          Test SignalWire Connection
        </button>
        <button onClick={checkWebRTCStats}>
          Check WebRTC Stats
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>Local Video</h3>
          <video 
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ 
              width: '300px', 
              height: '200px', 
              backgroundColor: '#000',
              border: '2px solid #333'
            }}
          />
        </div>
        
        <div>
          <h3>Remote Video Container</h3>
          <div 
            ref={remoteVideoRef}
            style={{ 
              width: '300px', 
              height: '200px', 
              backgroundColor: '#000',
              border: '2px solid #333',
              position: 'relative'
            }}
          />
        </div>
      </div>
      
      <div>
        <h3>Debug Logs</h3>
        <div style={{ 
          backgroundColor: '#000', 
          color: '#0f0', 
          padding: '10px',
          fontFamily: 'monospace',
          fontSize: '12px',
          height: '300px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VideoDebugPage