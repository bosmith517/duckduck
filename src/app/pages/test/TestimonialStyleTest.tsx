import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../supabaseClient'

// Declare SignalWire globally (loaded via CDN)
declare global {
  interface Window {
    SignalWire: any
  }
}

const TestimonialStyleTest: React.FC = () => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)
  const startTimeRef = useRef<number>(0)
  
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionTime, setConnectionTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[TestimonialStyle] ${message}`)
  }

  // Load SignalWire SDK from CDN
  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const loadStartTime = performance.now()
      addLog('Loading SignalWire SDK from CDN...')
      
      const script = document.createElement('script')
      script.src = 'https://cdn.signalwire.com/@signalwire/js'
      script.async = true
      script.onload = () => {
        const loadTime = performance.now() - loadStartTime
        addLog(`✅ SignalWire Browser SDK loaded in ${loadTime.toFixed(0)}ms`)
        scriptLoadedRef.current = true
      }
      script.onerror = () => {
        addLog('❌ Failed to load SignalWire SDK')
        setError('Failed to load video SDK')
      }
      document.body.appendChild(script)

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    }
  }, [])

  const runTest = async () => {
    if (!scriptLoadedRef.current || !window.SignalWire) {
      addLog('❌ SignalWire SDK not loaded yet')
      return
    }

    const startTime = performance.now()
    startTimeRef.current = Date.now()
    addLog('🚀 Starting video initialization...')
    
    try {
      setIsConnecting(true)
      setError(null)
      setConnectionTime(null)

      // Get room token from backend using the FAST function
      const tokenStartTime = performance.now()
      addLog('📡 Fetching token from FAST edge function...')
      
      const roomName = `testimonial-style-${Date.now()}`
      const { data, error } = await supabase.functions.invoke('create-signalwire-room-fast', {
        body: { 
          room_name: roomName,
          customer_name: 'Test User'
        }
      })
      
      const tokenTime = performance.now() - tokenStartTime
      addLog(`✅ Token received in ${tokenTime.toFixed(0)}ms`)

      if (error) {
        throw error
      }
      
      if (!data.token) throw new Error('No token received')
      
      // Join room with token
      await joinVideoRoom(data.token)
      
      const totalTime = performance.now() - startTime
      addLog(`🎉 Video initialization complete in ${totalTime.toFixed(0)}ms (${(totalTime/1000).toFixed(1)}s)`)
      
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`)
      setError(err.message || 'Failed to initialize video room')
      setIsConnecting(false)
    }
  }

  const joinVideoRoom = async (token: string) => {
    if (!window.SignalWire || !videoContainerRef.current) {
      addLog('❌ SignalWire SDK or container not ready')
      return
    }

    try {
      // Request permissions first to avoid delays
      const permStartTime = performance.now()
      addLog('🎤 Requesting media permissions...')
      
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        addLog(`✅ Media permissions granted in ${(performance.now() - permStartTime).toFixed(0)}ms`)
      } catch (permError) {
        addLog(`⚠️ Media permission error: ${permError}`)
      }
      
      const roomStartTime = performance.now()
      addLog('🔧 Creating room session...')
      
      // Create room session with browser SDK (minimal config like testimonial)
      const roomSession = new window.SignalWire.Video.RoomSession({
        token: token,
        rootElement: videoContainerRef.current
      })
      
      addLog(`✅ Room session created in ${(performance.now() - roomStartTime).toFixed(0)}ms`)

      // Event handlers
      roomSession.on('room.joined', (params: any) => {
        const elapsed = Date.now() - startTimeRef.current
        addLog(`🎊 Room joined! Total time: ${elapsed}ms`)
        setIsConnected(true)
        setIsConnecting(false)
        setConnectionTime(elapsed)
      })

      roomSession.on('room.left', () => {
        addLog('Room left')
        setIsConnected(false)
      })

      roomSession.on('error', (error: any) => {
        addLog(`❌ Room error: ${error.message}`)
      })

      roomSessionRef.current = roomSession

      // Join the room with audio/video options (like testimonial)
      const joinStartTime = performance.now()
      addLog('🚪 Joining room with audio/video options...')
      await roomSession.join({
        audio: true,
        video: true
      })
      
      const joinTime = performance.now() - joinStartTime
      addLog(`✅ Join method completed in ${joinTime.toFixed(0)}ms`)
      
    } catch (err: any) {
      addLog(`❌ Error joining room: ${err.message}`)
      setIsConnecting(false)
      setError(err.message || 'Could not join video room')
    }
  }

  const disconnect = async () => {
    if (roomSessionRef.current) {
      try {
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
        setIsConnected(false)
        addLog('✅ Disconnected')
      } catch (error) {
        addLog(`❌ Disconnect error: ${error}`)
      }
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Testimonial-Style Connection Test</h3>
        <div className="card-toolbar">
          <span className="badge badge-light-success">Uses CDN + Fast Edge Function</span>
        </div>
      </div>
      
      <div className="card-body">
        <div className="mb-4">
          <h4>Test Objective</h4>
          <p>Replicate the exact pattern from TestimonialVideoRoomClean that achieves sub-6 second connections.</p>
          
          <div className="alert alert-info">
            <h5>Key Differences:</h5>
            <ul className="mb-0">
              <li>Loads SignalWire from CDN (not npm package)</li>
              <li>Uses create-signalwire-room-fast Edge Function</li>
              <li>Minimal room session configuration</li>
              <li>Passes audio/video options to join()</li>
            </ul>
          </div>
        </div>

        {/* Controls */}
        <div className="text-center mb-4">
          {!isConnected ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={runTest}
              disabled={isConnecting || !scriptLoadedRef.current}
            >
              {isConnecting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Connecting...
                </>
              ) : !scriptLoadedRef.current ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading SDK...
                </>
              ) : (
                '🚀 Run Test'
              )}
            </button>
          ) : (
            <button
              className="btn btn-danger btn-lg"
              onClick={disconnect}
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Result */}
        {connectionTime && (
          <div className={`alert ${connectionTime < 6000 ? 'alert-success' : connectionTime < 10000 ? 'alert-warning' : 'alert-danger'} mb-4`}>
            <h4>Connection Time: {(connectionTime / 1000).toFixed(1)} seconds</h4>
            <p className="mb-0">
              {connectionTime < 6000 && '🎉 SUCCESS! Sub-6 second connection achieved!'}
              {connectionTime >= 6000 && connectionTime < 10000 && '✅ Good, but not quite sub-6 seconds'}
              {connectionTime >= 10000 && '❌ Still too slow'}
            </p>
          </div>
        )}

        {/* Video Container */}
        <div className="mb-4">
          <div 
            ref={videoContainerRef}
            style={{
              width: '100%',
              height: '400px',
              backgroundColor: '#000',
              position: 'relative',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            {isConnecting && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                textAlign: 'center',
                color: 'white'
              }}>
                <div className="spinner-border text-light mb-3" role="status">
                  <span className="visually-hidden">Connecting...</span>
                </div>
                <div>Setting up your camera...</div>
              </div>
            )}

            {error && !isConnecting && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: '20px',
                borderRadius: '10px'
              }}>
                <div className="alert alert-danger mb-0">
                  <h5>Connection Error</h5>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </div>
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
            {logs.length === 0 ? (
              <div className="text-muted">Click "Run Test" to start</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={
                  log.includes('✅') ? 'text-success' :
                  log.includes('❌') ? 'text-danger' :
                  log.includes('⚠️') ? 'text-warning' :
                  log.includes('🎉') || log.includes('🎊') ? 'text-primary' :
                  ''
                }>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestimonialStyleTest