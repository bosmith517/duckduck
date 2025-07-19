import React, { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../supabaseClient'

// Declare SignalWire globally (loaded via CDN)
declare global {
  interface Window {
    SignalWire: any
  }
}

interface SignalWireVideoRoomCDNProps {
  token?: string
  roomName?: string
  userName?: string
  onRoomJoined?: (roomSession: any) => void
  onMemberJoined?: (member: any) => void
  onMemberLeft?: (member: any) => void
  onError?: (error: any) => void
  enableAudio?: boolean
  enableVideo?: boolean
  layout?: 'grid' | 'highlight' | 'screen-share' | 'grid-responsive'
  className?: string
}

export const SignalWireVideoRoomCDN: React.FC<SignalWireVideoRoomCDNProps> = ({
  token: providedToken,
  roomName,
  userName = 'Guest',
  onRoomJoined,
  onMemberJoined,
  onMemberLeft,
  onError,
  enableAudio = true,
  enableVideo = true,
  layout = 'grid-responsive',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<Map<string, any>>(new Map())
  const [sdkLoaded, setSdkLoaded] = useState(false)

  // Load SignalWire SDK from CDN
  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script')
      script.src = 'https://cdn.signalwire.com/@signalwire/js'
      script.async = true
      script.onload = () => {
        console.log('✅ SignalWire Browser SDK loaded from CDN')
        scriptLoadedRef.current = true
        setSdkLoaded(true)
      }
      script.onerror = () => {
        console.error('Failed to load SignalWire SDK from CDN')
        setError('Failed to load video SDK')
      }
      document.body.appendChild(script)

      return () => {
        if (script.parentNode) {
          script.parentNode.removeChild(script)
        }
      }
    } else {
      setSdkLoaded(true)
    }
  }, [])

  // Join room when SDK is loaded and token is provided
  useEffect(() => {
    if (sdkLoaded && providedToken && !isConnecting && !isConnected) {
      joinRoom(providedToken)
    }
  }, [sdkLoaded, providedToken])

  // Generate a test token if none provided
  const generateTestToken = async () => {
    try {
      console.log('Generating test token...')
      const { data, error } = await supabase.functions.invoke('create-signalwire-room-fast', {
        body: { 
          room_name: `test-room-${Date.now()}`,
          customer_name: userName
        }
      })

      if (error) throw error
      if (!data.token) throw new Error('No token received')

      console.log('Test token generated successfully')
      return data.token
    } catch (err: any) {
      console.error('Error generating test token:', err)
      setError('Failed to generate test token: ' + err.message)
      return null
    }
  }

  const joinRoom = async (tokenToUse: string) => {
    if (!window.SignalWire) {
      console.error('SignalWire SDK not loaded')
      setError('Video SDK not ready')
      return
    }

    if (!containerRef.current) {
      console.error('Missing container')
      return
    }

    // Find or create SignalWire container
    let signalWireContainer = containerRef.current.querySelector('#signalwire-container')
    if (!signalWireContainer) {
      signalWireContainer = document.createElement('div')
      signalWireContainer.id = 'signalwire-container'
      ;(signalWireContainer as HTMLElement).style.width = '100%'
      ;(signalWireContainer as HTMLElement).style.height = '100%'
      ;(signalWireContainer as HTMLElement).style.position = 'absolute'
      ;(signalWireContainer as HTMLElement).style.top = '0'
      ;(signalWireContainer as HTMLElement).style.left = '0'
      containerRef.current.appendChild(signalWireContainer)
    }

    setIsConnecting(true)
    setError(null)

    try {
      const startTime = performance.now()
      console.log('🚀 Starting video initialization...')
      
      // Request permissions first to avoid delays
      if (enableAudio || enableVideo) {
        try {
          const permStartTime = performance.now()
          console.log('Pre-requesting media permissions...')
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          stream.getTracks().forEach(track => track.stop())
          console.log(`✅ Media permissions pre-warmed in ${(performance.now() - permStartTime).toFixed(0)}ms`)
        } catch (err) {
          console.error('Failed to pre-request media permissions:', err)
        }
      }
      
      const roomStartTime = performance.now()
      console.log('Creating SignalWire room session with CDN SDK...')
      
      // Create room session with CDN SDK (minimal config like testimonial)
      const roomSession = new window.SignalWire.Video.RoomSession({
        token: tokenToUse,
        rootElement: signalWireContainer
      })
      
      console.log(`✅ Room session created in ${(performance.now() - roomStartTime).toFixed(0)}ms`)

      // Set up event handlers
      roomSession.on('room.joined', (params: any) => {
        const totalTime = performance.now() - startTime
        console.log(`🎉 Room joined in ${totalTime.toFixed(0)}ms (${(totalTime/1000).toFixed(1)}s)`)
        setIsConnected(true)
        setIsConnecting(false)
        
        if (params.room && 'members' in params.room) {
          const memberMap = new Map()
          Object.entries(params.room.members).forEach(([id, member]) => {
            memberMap.set(id, member)
          })
          setMembers(memberMap)
        }
        
        onRoomJoined?.(roomSession)
      })

      roomSession.on('room.updated', (params: any) => {
        console.log('Room updated:', params)
        if (params.room && 'members' in params.room) {
          const memberMap = new Map()
          Object.entries(params.room.members).forEach(([id, member]) => {
            memberMap.set(id, member)
          })
          setMembers(memberMap)
        }
      })

      roomSession.on('member.joined', (e: any) => {
        console.log(`${e.member.name} joined the room.`)
        setMembers(prev => {
          if (prev.has(e.member.id)) {
            return prev
          }
          const newMap = new Map(prev)
          newMap.set(e.member.id, e.member)
          return newMap
        })
        onMemberJoined?.(e.member)
      })

      roomSession.on('member.left', (e: any) => {
        console.log(`${e.member.name} left the room.`)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.delete(e.member.id)
          return newMap
        })
        onMemberLeft?.(e.member)
      })

      roomSession.on('member.updated', (params: any) => {
        console.log('Member updated:', params.member)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.set(params.member.id, params.member)
          return newMap
        })
      })

      roomSession.on('room.left', () => {
        console.log('Room left')
        setIsConnected(false)
      })

      roomSession.on('error', (error: any) => {
        console.error('Room error:', error)
        setError(error.message || 'Connection failed')
        onError?.(error)
      })

      // Store room session reference
      roomSessionRef.current = roomSession

      // Join the room with audio/video options (like testimonial)
      const joinStartTime = performance.now()
      console.log('Joining room with audio/video options...')
      await roomSession.join({
        audio: enableAudio,
        video: enableVideo
      })
      
      const joinTime = performance.now() - joinStartTime
      console.log(`✅ Join method completed in ${joinTime.toFixed(0)}ms`)

    } catch (err: any) {
      console.error('Error joining room:', err)
      setIsConnecting(false)
      setError(err.message || 'Could not join video session.')
      onError?.(err)
    }
  }

  // Join with test token button
  const joinWithTestToken = async () => {
    const token = await generateTestToken()
    if (token) {
      await joinRoom(token)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomSessionRef.current) {
        try {
          if (roomSessionRef.current.state === 'connected' || roomSessionRef.current.state === 'joined') {
            roomSessionRef.current.leave()
          }
        } catch (error) {
          console.log('Room session cleanup error:', error)
        }
        roomSessionRef.current = null
      }
    }
  }, [])

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!roomSessionRef.current || !isConnected) return
    
    try {
      const audioMuted = roomSessionRef.current.audioMuted
      if (audioMuted) {
        await roomSessionRef.current.audioUnmute()
      } else {
        await roomSessionRef.current.audioMute()
      }
    } catch (err) {
      console.error('Error toggling audio:', err)
    }
  }, [isConnected])

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!roomSessionRef.current || !isConnected) return
    
    try {
      const videoMuted = roomSessionRef.current.videoMuted
      if (videoMuted) {
        await roomSessionRef.current.videoUnmute()
      } else {
        await roomSessionRef.current.videoMute()
      }
    } catch (err) {
      console.error('Error toggling video:', err)
    }
  }, [isConnected])

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!roomSessionRef.current) return
    
    try {
      await roomSessionRef.current.leave()
      setIsConnected(false)
      roomSessionRef.current = null
    } catch (err) {
      console.error('Error leaving room:', err)
    }
  }, [])

  return (
    <div className={`signalwire-video-room ${className}`}>
      {/* Test Mode Banner */}
      {!providedToken && !sdkLoaded && (
        <div className="alert alert-info mb-3">
          <h5>Loading SignalWire SDK...</h5>
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      
      {!providedToken && sdkLoaded && (
        <div className="alert alert-info mb-3">
          <h5>SignalWire Video Room Test Mode</h5>
          <p>No token provided. Click below to generate a test token and join a new room.</p>
          <button 
            className="btn btn-primary"
            onClick={joinWithTestToken}
            disabled={isConnecting || isConnected}
          >
            Generate Test Token & Join Room
          </button>
        </div>
      )}

      {/* Video Container */}
      <div 
        ref={containerRef}
        className="video-container"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          backgroundColor: '#000',
          borderRadius: '8px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Loading State */}
        {isConnecting && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            pointerEvents: 'none',
            textAlign: 'center',
            color: 'white'
          }}>
            <div className="spinner-border text-light mb-3" role="status">
              <span className="visually-hidden">Connecting...</span>
            </div>
            <div>Connecting to video room...</div>
          </div>
        )}

        {/* Error State */}
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
              <button 
                className="btn btn-sm btn-outline-danger"
                onClick={() => {
                  setError(null)
                  if (providedToken) {
                    joinRoom(providedToken)
                  } else {
                    joinWithTestToken()
                  }
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isConnected && (
        <div className="video-controls mt-3">
          <div className="btn-group" role="group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={toggleAudio}
              title="Toggle Audio"
            >
              <i className="ki-duotone ki-microphone fs-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
              onClick={toggleVideo}
              title="Toggle Video"
            >
              <i className="ki-duotone ki-video fs-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={leaveRoom}
              title="Leave Room"
            >
              <i className="ki-duotone ki-phone-disconnected fs-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
          </div>
        </div>
      )}

      {/* Member List */}
      {isConnected && members.size > 0 && (
        <div className="mt-3 p-3 bg-light rounded">
          <h6 className="mb-2">Participants ({members.size})</h6>
          <div className="d-flex flex-wrap gap-2">
            {Array.from(members.values()).map(member => (
              <div key={member.id} className="badge bg-secondary">
                {member.name || 'Guest'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SignalWireVideoRoomCDN