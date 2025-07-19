import React, { useState, useEffect, useRef } from 'react'
import * as SignalWire from '@signalwire/js'

const DirectSignalWireTest: React.FC = () => {
  const [credentials, setCredentials] = useState({
    projectId: '',
    apiToken: '',
    spaceUrl: ''
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionTime, setConnectionTime] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[DirectTest] ${message}`)
  }

  // Pre-warm permissions on mount
  useEffect(() => {
    const preWarm = async () => {
      try {
        addLog('Pre-warming media permissions...')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        stream.getTracks().forEach(track => track.stop())
        addLog('✅ Media permissions pre-warmed')
      } catch (err) {
        addLog(`❌ Failed to pre-warm: ${err}`)
      }
    }
    preWarm()
  }, [])

  const testDirectConnection = async () => {
    if (!credentials.projectId || !credentials.apiToken || !credentials.spaceUrl) {
      addLog('❌ Please enter all credentials')
      return
    }

    setIsConnecting(true)
    setConnectionTime(null)
    startTimeRef.current = Date.now()
    
    try {
      // Create room and token directly
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const baseUrl = `https://${credentials.spaceUrl}/api/video`
      const roomName = `direct-test-${Date.now()}`
      
      addLog('Creating room directly via REST API...')
      
      // Create room
      const roomResponse = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          display_name: 'Direct Test Room',
          max_participants: 5,
          enable_recording: false
        })
      })

      if (!roomResponse.ok) {
        throw new Error(`Room creation failed: ${roomResponse.status}`)
      }

      const roomData = await roomResponse.json()
      addLog(`✅ Room created: ${roomData.name}`)

      // Create token with minimal permissions
      addLog('Creating token with minimal permissions...')
      const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: 'Direct Test User',
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

      if (!tokenResponse.ok) {
        throw new Error(`Token creation failed: ${tokenResponse.status}`)
      }

      const tokenData = await tokenResponse.json()
      addLog(`✅ Token created`)

      // Decode token to check ICE servers
      try {
        const payload = JSON.parse(atob(tokenData.token.split('.')[1]))
        addLog(`Token has ICE servers: ${payload.ice_servers ? 'YES' : 'NO'}`)
        if (payload.ice_servers) {
          addLog(`ICE server count: ${payload.ice_servers.length}`)
        }
      } catch (e) {
        addLog('Could not decode token')
      }

      // Connect using minimal configuration
      addLog('Connecting with minimal config...')
      if (!containerRef.current) {
        throw new Error('Container not ready')
      }

      const roomSession = new SignalWire.Video.RoomSession({
        token: tokenData.token,
        rootElement: containerRef.current,
        logLevel: 'debug' // Changed to debug to see more details
      })

      roomSessionRef.current = roomSession

      roomSession.on('room.joined', () => {
        const elapsed = Date.now() - startTimeRef.current
        setConnectionTime(elapsed)
        addLog(`🎉 CONNECTED in ${elapsed}ms (${(elapsed/1000).toFixed(1)}s)`)
        setIsConnecting(false)
      })

      // @ts-ignore - deprecated event
      roomSession.on('error' as any, (error: any) => {
        addLog(`❌ Error: ${error.message}`)
        setIsConnecting(false)
      })

      addLog('Calling join()...')
      await roomSession.join()
      
    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`)
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (roomSessionRef.current) {
      try {
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
        addLog('✅ Disconnected')
      } catch (err) {
        addLog(`❌ Disconnect error: ${err}`)
      }
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Direct SignalWire Connection Test</h3>
        <div className="card-toolbar">
          <span className="badge badge-light-warning">Bypasses Edge Functions</span>
        </div>
      </div>
      
      <div className="card-body">
        <div className="mb-4">
          <h4>Test Objective</h4>
          <p>Connect directly to SignalWire API to isolate if the delay is from our Edge Function or SignalWire itself.</p>
        </div>

        {/* Credentials */}
        <div className="row mb-4">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Project ID"
              value={credentials.projectId}
              onChange={(e) => setCredentials(prev => ({ ...prev, projectId: e.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <input
              type="password"
              className="form-control"
              placeholder="API Token"
              value={credentials.apiToken}
              onChange={(e) => setCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
            />
          </div>
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Space URL (e.g., yourspace.signalwire.com)"
              value={credentials.spaceUrl}
              onChange={(e) => setCredentials(prev => ({ ...prev, spaceUrl: e.target.value }))}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="d-flex gap-3 mb-4">
          <button
            className="btn btn-primary"
            onClick={testDirectConnection}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Connecting...
              </>
            ) : (
              'Test Direct Connection'
            )}
          </button>
          
          <button
            className="btn btn-danger"
            onClick={disconnect}
            disabled={!roomSessionRef.current}
          >
            Disconnect
          </button>
        </div>

        {/* Result */}
        {connectionTime && (
          <div className={`alert ${connectionTime < 5000 ? 'alert-success' : connectionTime < 20000 ? 'alert-warning' : 'alert-danger'} mb-4`}>
            <h5>Connection Time: {(connectionTime / 1000).toFixed(1)} seconds</h5>
          </div>
        )}

        {/* Video Container */}
        <div className="mb-4" style={{ minHeight: '400px' }}>
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: '400px',
              backgroundColor: '#000',
              borderRadius: '8px',
              position: 'relative'
            }}
          />
        </div>

        {/* Logs */}
        <div className="mt-4">
          <h5>Connection Logs</h5>
          <div className="bg-dark text-light p-3 rounded" style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {logs.map((log, i) => (
              <div key={i} className={
                log.includes('✅') ? 'text-success' :
                log.includes('❌') ? 'text-danger' :
                log.includes('🎉') ? 'text-primary' :
                ''
              }>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectSignalWireTest