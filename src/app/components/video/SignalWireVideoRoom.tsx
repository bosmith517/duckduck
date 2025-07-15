import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as SignalWire from '@signalwire/js'

interface SignalWireVideoRoomProps {
  token: string
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

const MAX_ATTEMPTS = 3

export const SignalWireVideoRoom: React.FC<SignalWireVideoRoomProps> = ({
  token,
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
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<SignalWire.Video.RoomSession>()
  const previewRef = useRef<HTMLVideoElement>()
  const [connecting, setConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(enableAudio)
  const [videoEnabled, setVideoEnabled] = useState(enableVideo)
  const [currentLayout, setCurrentLayout] = useState(layout)
  const [members, setMembers] = useState<Map<string, any>>(new Map())
  const [uiError, setUiError] = useState<string | null>(null)

  // Check for HTTPS requirement
  useEffect(() => {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setUiError('Video calls require a secure connection (HTTPS)')
    }
  }, [])

  // Error handler function
  const bail = (message: string) => {
    console.error(`[SignalWire] ${message}`)
    setUiError(message)
    setConnecting(false)
    onError?.({ message })
  }

  // Join with retry logic for "connection pool not initialized"
  const joinWithRetry = async (room: SignalWire.Video.RoomSession, attempt = 1): Promise<void> => {
    try {
      // Fixed constraints to avoid renegotiation storm
      await room.join({
        audio: audioEnabled,
        video: videoEnabled ? { width: 640, height: 480, frameRate: 24 } : false
      })
    } catch (err: any) {
      if (/pool not initialized/i.test(err.message) && attempt < MAX_ATTEMPTS) {
        console.warn(`SignalWire retry #${attempt + 1}`)
        await new Promise(r => setTimeout(r, 1500 * attempt))
        return joinWithRetry(room, attempt + 1)
      }
      throw err
    }
  }

  // Main room setup effect
  useEffect(() => {
    // Prerequisites
    if (!token || !videoContainerRef.current) return
    // Already running
    if (roomSessionRef.current) return

    setConnecting(true)
    setUiError(null)

    console.log('=== SignalWire Video Room Setup ===')
    console.log('Token:', token ? 'Present' : 'Missing')
    console.log('Container:', videoContainerRef.current ? 'Ready' : 'Not ready')

    const room = new SignalWire.Video.RoomSession({
      token,
      rootElement: videoContainerRef.current,
      // Leave iceServers blank - JWT already carries the right TURN list
      // Uncomment next line if users sit behind UDP-blocked firewalls:
      // iceTransportPolicy: 'relay',
      layout: currentLayout
    })

    roomSessionRef.current = room

    // Event handlers
    const handleJoined = (params: any) => {
      console.log('Room joined:', params)
      setConnecting(false)
      setIsConnected(true)
      
      // Update members list
      if (params.room && 'members' in params.room) {
        const memberMap = new Map()
        Object.entries(params.room.members).forEach(([id, member]) => {
          memberMap.set(id, member)
        })
        setMembers(memberMap)
      }

      onRoomJoined?.(room)
    }

    const handleLeft = (params: any) => {
      console.log('Room left:', params)
      setIsConnected(false)
      if (params.error?.message) {
        setUiError(params.error.message)
      } else {
        setUiError('Disconnected from room')
      }
    }

    const handleMemberJoined = (params: any) => {
      console.log('Member joined:', params.member)
      setMembers(prev => {
        const newMap = new Map(prev)
        newMap.set(params.member.id, params.member)
        return newMap
      })
      onMemberJoined?.(params.member)
    }

    const handleMemberLeft = (params: any) => {
      console.log('Member left:', params.member)
      setMembers(prev => {
        const newMap = new Map(prev)
        newMap.delete(params.member.id)
        return newMap
      })
      onMemberLeft?.(params.member)
    }

    // Set up event listeners
    room.on('room.joined', handleJoined)
    room.on('room.left', handleLeft)
    room.on('member.joined', handleMemberJoined)
    room.on('member.left', handleMemberLeft)
    room.on('room.updated', (params) => {
      if (params.room && 'members' in params.room) {
        const memberMap = new Map()
        Object.entries(params.room.members).forEach(([id, member]) => {
          memberMap.set(id, member)
        })
        setMembers(memberMap)
      }
    })
    room.on('member.updated', (params) => {
      setMembers(prev => {
        const newMap = new Map(prev)
        newMap.set(params.member.id, params.member)
        return newMap
      })
    })
    room.on('layout.changed', (params) => {
      console.log('Layout changed:', params)
      setCurrentLayout(params.layout as any)
    })
    room.on('room.failed', (err) => bail(`room.failed - ${err.message}`))
    room.on('room.error', (err) => bail(`room.error - ${err.message}`))

    // Join the room asynchronously
    ;(async () => {
      try {
        await joinWithRetry(room)
        console.log('✅ Successfully joined room')
      } catch (err: any) {
        bail(`join() threw - ${err.message}`)
      }
    })()

    // Rock-solid cleanup
    return () => {
      setConnecting(false)
      room.off() // Remove ALL listeners
      if (room.state !== 'left') {
        room.leave().catch(() => {})
      }
      roomSessionRef.current = undefined
    }
  }, [token]) // Only rerun when JWT changes

  // Preview video setup (outside React-controlled container)
  useEffect(() => {
    if (!enableVideo) return

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        const vid = document.createElement('video')
        vid.srcObject = stream
        vid.autoplay = true
        vid.muted = true
        vid.playsInline = true
        vid.style.width = '200px'
        vid.style.height = '150px'
        vid.style.objectFit = 'cover'
        vid.style.borderRadius = '8px'
        vid.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
        
        const previewRoot = document.getElementById('preview-root')
        if (previewRoot) {
          previewRoot.appendChild(vid)
          previewRef.current = vid
        }
        
        // Hide preview when connected
        if (isConnected && vid) {
          vid.style.display = 'none'
        }
      } catch (err) {
        console.warn('Preview video failed:', err)
      }
    })()

    return () => {
      // Clean up preview
      if (previewRef.current) {
        const stream = previewRef.current.srcObject as MediaStream
        stream?.getTracks().forEach(track => track.stop())
        previewRef.current.remove()
      }
    }
  }, [enableVideo])

  // Hide/show preview based on connection state
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.style.display = isConnected ? 'none' : 'block'
    }
  }, [isConnected])

  // Retry connection
  const retryConnection = useCallback(() => {
    // Force component remount by clearing error and letting parent re-render
    setUiError(null)
    window.location.reload() // Simple but effective for now
  }, [])

  // Toggle audio (with delay to avoid renegotiation storm)
  const toggleAudio = useCallback(async () => {
    if (!roomSessionRef.current || !isConnected) return
    
    // Delay to avoid renegotiation issues
    setTimeout(async () => {
      try {
        if (audioEnabled) {
          await roomSessionRef.current!.audioMute()
        } else {
          await roomSessionRef.current!.audioUnmute()
        }
        setAudioEnabled(!audioEnabled)
      } catch (err) {
        console.error('Error toggling audio:', err)
      }
    }, 100)
  }, [audioEnabled, isConnected])

  // Toggle video (with delay to avoid renegotiation storm)
  const toggleVideo = useCallback(async () => {
    if (!roomSessionRef.current || !isConnected) return
    
    // Delay to avoid renegotiation issues
    setTimeout(async () => {
      try {
        if (videoEnabled) {
          await roomSessionRef.current!.videoMute()
        } else {
          await roomSessionRef.current!.videoUnmute()
        }
        setVideoEnabled(!videoEnabled)
      } catch (err) {
        console.error('Error toggling video:', err)
      }
    }, 100)
  }, [videoEnabled, isConnected])

  // Change layout (with delay to avoid renegotiation storm)
  const changeLayout = useCallback(async (newLayout: string) => {
    if (!roomSessionRef.current || !isConnected) return
    
    // Delay layout changes for 3 seconds after join
    setTimeout(async () => {
      try {
        await roomSessionRef.current!.setLayout({ name: newLayout })
        setCurrentLayout(newLayout as any)
      } catch (err) {
        console.error('Error changing layout:', err)
      }
    }, 3000)
  }, [isConnected])

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!roomSessionRef.current) return
    
    try {
      await roomSessionRef.current.leave()
      setIsConnected(false)
    } catch (err) {
      console.error('Error leaving room:', err)
    }
  }, [])

  // Enable debug mode in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Enable SignalWire debug logging
      localStorage.setItem('DEBUG', 'signalwire:*')
    }
  }, [])

  return (
    <>
      {/* Preview root - outside React-controlled container */}
      <div 
        id="preview-root" 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9,
          display: isConnected ? 'none' : 'block'
        }}
      />

      <div className={`signalwire-video-room ${className}`}>
        {/* Video Container */}
        <div 
          ref={videoContainerRef}
          className="video-container"
          style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
            backgroundColor: '#000',
            position: 'relative'
          }}
        >
          {/* Connecting spinner */}
          {connecting && !isConnected && (
            <div className="position-absolute top-50 start-50 translate-middle text-center text-white">
              <div className="spinner-border text-light mb-3" role="status">
                <span className="visually-hidden">Connecting...</span>
              </div>
              <div className="mb-2">Connecting to video room...</div>
              <small className="text-muted">Establishing secure connection...</small>
            </div>
          )}
          
          {/* Error display with retry option */}
          {uiError && !connecting && (
            <div className="position-absolute top-50 start-50 translate-middle text-center" style={{ zIndex: 10 }}>
              <div className="alert alert-danger" role="alert">
                <h5 className="alert-heading">Connection Error</h5>
                <p>{uiError}</p>
                <hr />
                <button 
                  className="btn btn-outline-danger btn-sm" 
                  onClick={retryConnection}
                >
                  <i className="ki-duotone ki-refresh fs-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Reconnect
                </button>
              </div>
            </div>
          )}
          
          {/* Connected placeholder */}
          {isConnected && (
            <div className="position-absolute top-50 start-50 translate-middle text-center text-white" 
                 style={{ zIndex: -1 }}>
              <div className="text-muted">
                <i className="ki-duotone ki-video fs-5x mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div>Video session active</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {isConnected && (
          <div className="video-controls position-absolute bottom-0 start-50 translate-middle-x p-3">
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn ${audioEnabled ? 'btn-primary' : 'btn-danger'}`}
                onClick={toggleAudio}
                title={audioEnabled ? 'Mute' : 'Unmute'}
              >
                <i className={`ki-duotone ki-${audioEnabled ? 'microphone' : 'microphone-slash'} fs-2`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
              
              <button
                type="button"
                className={`btn ${videoEnabled ? 'btn-primary' : 'btn-danger'}`}
                onClick={toggleVideo}
                title={videoEnabled ? 'Stop Video' : 'Start Video'}
              >
                <i className={`ki-duotone ki-${videoEnabled ? 'video' : 'video-slash'} fs-2`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>

              <div className="dropdown">
                <button
                  className="btn btn-secondary dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="Change Layout"
                >
                  <i className="ki-duotone ki-grid fs-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
                <ul className="dropdown-menu">
                  <li><a className="dropdown-item" onClick={() => changeLayout('grid')}>Grid</a></li>
                  <li><a className="dropdown-item" onClick={() => changeLayout('highlight')}>Highlight</a></li>
                  <li><a className="dropdown-item" onClick={() => changeLayout('grid-responsive')}>Grid Responsive</a></li>
                </ul>
              </div>

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
          <div className="members-list position-absolute top-0 end-0 p-3 bg-dark bg-opacity-75 text-white rounded m-3" style={{ maxWidth: '200px' }}>
            <h6 className="mb-2">Participants ({members.size})</h6>
            {Array.from(members.values()).map(member => (
              <div key={member.id} className="d-flex align-items-center mb-1">
                <i className={`ki-duotone ki-${member.audio_muted ? 'microphone-slash' : 'microphone'} fs-4 me-2`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <small>{member.name || 'Guest'}</small>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}