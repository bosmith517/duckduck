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
  const roomSessionRef = useRef<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(enableAudio)
  const [videoEnabled, setVideoEnabled] = useState(enableVideo)
  const [currentLayout, setCurrentLayout] = useState(layout)
  const [members, setMembers] = useState<Map<string, any>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const isInitializingRef = useRef(false)
  const isMountedRef = useRef(true)

  // Initialize room session
  const initializeRoom = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current || roomSessionRef.current) {
      console.log('Already initializing or initialized, skipping...')
      return
    }
    
    isInitializingRef.current = true
    
    console.log('=== SignalWire Video Room Initialization ===')
    console.log('Token:', token ? 'Present' : 'Missing')
    console.log('Container:', videoContainerRef.current ? 'Ready' : 'Not ready')
    console.log('User Agent:', navigator.userAgent)
    console.log('Is Mobile:', /iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    
    if (!videoContainerRef.current || !token) {
      console.error('Missing video container or token')
      setError('Missing required video configuration')
      isInitializingRef.current = false
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      // Request media permissions first
      console.log('Requesting media permissions...')
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const constraints = {
        audio: enableAudio,
        video: enableVideo ? {
          width: { min: 320, ideal: 640, max: 1280 },
          height: { min: 240, ideal: 480, max: 720 },
          facingMode: isMobile ? { exact: 'environment' } : { ideal: 'user' } // Rear camera on mobile for inspections
        } : false
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        console.log('Got local media stream:', stream)
        setLocalStream(stream)
        
        // Create preview video outside React's managed DOM
        const previewContainer = document.getElementById('local-preview-container')
        if (enableVideo && stream && previewContainer && !document.getElementById('local-preview')) {
          const video = document.createElement('video')
          video.srcObject = stream
          video.autoplay = true
          video.muted = true
          video.playsInline = true
          video.id = 'local-preview'
          video.style.width = '100%'
          video.style.height = '100%'
          video.style.objectFit = 'cover'
          previewContainer.appendChild(video)
        }
      } catch (mediaError: any) {
        console.error('Media access error:', mediaError)
        setError(`Camera/Microphone access denied: ${mediaError?.message || 'Unknown error'}`)
        // Continue anyway - user might join audio-only
      }

      console.log('Creating RoomSession with token:', token.substring(0, 50) + '...')
      console.log('SignalWire SDK available:', !!SignalWire?.Video?.RoomSession)
      
      // Set the video container size explicitly for mobile
      if (videoContainerRef.current && isMobile) {
        videoContainerRef.current.style.width = '100%'
        videoContainerRef.current.style.height = '100%'
        videoContainerRef.current.style.minHeight = '400px'
      }
      
      const roomSessionConfig = {
        token: token,
        rootElement: videoContainerRef.current,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.signalwire.com:3478' }
        ],
        layout: currentLayout
      }
      
      console.log('Room session config:', roomSessionConfig)
      
      const roomSession = new SignalWire.Video.RoomSession(roomSessionConfig)

      roomSessionRef.current = roomSession

      // Set up event handlers
      roomSession.on('room.joined', (params) => {
        console.log('Room joined:', params)
        if (isMountedRef.current) {
          setIsConnected(true)
          setIsConnecting(false)
          isInitializingRef.current = false
        }
        
        // Hide preview container when room is joined
        const previewContainer = document.getElementById('local-preview-container')
        if (previewContainer) {
          previewContainer.style.display = 'none'
        }

        // Update members list
        if (params.room && 'members' in params.room) {
          const memberMap = new Map()
          Object.entries(params.room.members).forEach(([id, member]) => {
            memberMap.set(id, member)
          })
          setMembers(memberMap)
        }

        onRoomJoined?.(roomSession)
      })

      roomSession.on('room.updated', (params) => {
        console.log('Room updated:', params)
        if (params.room && 'members' in params.room) {
          const memberMap = new Map()
          Object.entries(params.room.members).forEach(([id, member]) => {
            memberMap.set(id, member)
          })
          setMembers(memberMap)
        }
      })

      roomSession.on('member.joined', (params) => {
        console.log('Member joined:', params.member)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.set(params.member.id, params.member)
          return newMap
        })
        onMemberJoined?.(params.member)
      })

      roomSession.on('member.left', (params) => {
        console.log('Member left:', params.member)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.delete(params.member.id)
          return newMap
        })
        onMemberLeft?.(params.member)
      })

      roomSession.on('member.updated', (params) => {
        console.log('Member updated:', params.member)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.set(params.member.id, params.member)
          return newMap
        })
      })

      roomSession.on('layout.changed', (params) => {
        console.log('Layout changed:', params)
        setCurrentLayout(params.layout as any)
      })

      roomSession.on('room.left', (params) => {
        console.log('Room left:', params)
        setIsConnected(false)
        if (params && 'error' in params && params.error) {
          const errorMsg = (params.error as any).message || 'Connection lost'
          setError(errorMsg)
          onError?.(params.error)
        }
      })

      roomSession.on('media.connected', () => {
        console.log('Media connected')
      })

      roomSession.on('media.disconnected', () => {
        console.log('Media disconnected')
      })

      roomSession.on('track', (event) => {
        console.log('Track received:', event)
      })

      roomSession.on('stream.started', (event) => {
        console.log('Stream started:', event)
      })

      roomSession.on('stream.ended', (event) => {
        console.log('Stream ended:', event)
      })

      // Join the room directly - SignalWire SDK handles initialization internally
      console.log('Joining room with audio/video settings...')
      
      try {
        await roomSession.join({
          audio: audioEnabled,
          video: videoEnabled
        })
        console.log('✅ Join call completed successfully')
      } catch (joinError: any) {
        console.error('❌ Join failed:', joinError)
        throw joinError
      }

    } catch (err: any) {
      console.error('Error initializing room:', err)
      setError(err.message || 'Failed to join room')
      onError?.(err)
      setIsConnecting(false)
      isInitializingRef.current = false
    }
  }, [token, enableAudio, enableVideo, currentLayout, onRoomJoined, onMemberJoined, onMemberLeft, onError])

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!roomSessionRef.current) return
    
    try {
      if (audioEnabled) {
        await roomSessionRef.current.audioMute()
      } else {
        await roomSessionRef.current.audioUnmute()
      }
      setAudioEnabled(!audioEnabled)
    } catch (err) {
      console.error('Error toggling audio:', err)
    }
  }, [audioEnabled])

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!roomSessionRef.current) return
    
    try {
      if (videoEnabled) {
        await roomSessionRef.current.videoMute()
      } else {
        await roomSessionRef.current.videoUnmute()
      }
      setVideoEnabled(!videoEnabled)
    } catch (err) {
      console.error('Error toggling video:', err)
    }
  }, [videoEnabled])

  // Change layout
  const changeLayout = useCallback(async (newLayout: string) => {
    if (!roomSessionRef.current) return
    
    try {
      await roomSessionRef.current.setLayout({ name: newLayout })
      setCurrentLayout(newLayout as any)
    } catch (err) {
      console.error('Error changing layout:', err)
    }
  }, [])

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

  // Initialize on mount
  useEffect(() => {
    isMountedRef.current = true
    
    // Small delay to ensure DOM is ready
    const initTimeout = setTimeout(() => {
      if (token && videoContainerRef.current && !isInitializingRef.current) {
        initializeRoom()
      }
    }, 100)

    return () => {
      isMountedRef.current = false
      isInitializingRef.current = false
      clearTimeout(initTimeout)
      
      // Only try to leave if we have a session AND we know it's connected
      if (roomSessionRef.current && isConnected) {
        const session = roomSessionRef.current
        // Wrap in try-catch to prevent any errors during cleanup
        try {
          if (typeof session.leave === 'function') {
            session.leave().catch(() => {
              // Silently ignore leave errors on cleanup
            })
          }
        } catch (err) {
          // Ignore all errors during cleanup
        }
      }
      
      // Clear the ref
      roomSessionRef.current = null
      
      // Clean up preview video
      const preview = document.getElementById('local-preview')
      if (preview && preview.parentNode) {
        try {
          preview.parentNode.removeChild(preview)
        } catch (e) {
          // Ignore removal errors
        }
      }
      
      // Clean up local media
      if (localStream) {
        localStream.getTracks().forEach(track => {
          try {
            track.stop()
          } catch (e) {
            // Ignore track stop errors
          }
        })
      }
    }
  }, [token]) // Only depend on token, not initializeRoom

  return (
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
        {/* Local preview container - outside React's management */}
        <div 
          id="local-preview-container" 
          style={{ 
            width: '100%', 
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
        {isConnecting && !isConnected && (
          <div className="position-absolute top-50 start-50 translate-middle text-center text-white">
            <div className="spinner-border text-light mb-3" role="status">
              <span className="visually-hidden">Connecting...</span>
            </div>
            <div className="mb-2">Connecting to video room...</div>
            <small className="text-muted">This may take a few seconds</small>
            {error && (
              <div className="alert alert-danger mt-3">{error}</div>
            )}
          </div>
        )}
        
        {/* Show placeholder when connected but video not yet visible */}
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
  )
}