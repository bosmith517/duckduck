import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as SignalWire from '@signalwire/js'
import { supabase } from '../../../supabaseClient'

interface SignalWireVideoRoomProps {
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

export const SignalWireVideoRoom: React.FC<SignalWireVideoRoomProps> = ({
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
  const actualRoomIdRef = useRef<string | null>(null)
  const actualRoomSessionIdRef = useRef<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<Map<string, any>>(new Map())

  // Generate a test token if none provided
  const generateTestToken = async () => {
    try {
      console.log('Generating test token...')
      const { data, error } = await supabase.functions.invoke('generate-signalwire-token', {
        body: { 
          clientIdentity: `test-user-${Date.now()}`,
          room_name: `test-room-${Date.now()}`
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

  // Create SignalWire container element
  useEffect(() => {
    if (!containerRef.current) return

    // Create a dedicated div for SignalWire that React won't touch
    const signalWireContainer = document.createElement('div')
    signalWireContainer.id = `signalwire-container-${Date.now()}`
    signalWireContainer.style.width = '100%'
    signalWireContainer.style.height = '100%'
    signalWireContainer.style.position = 'absolute'
    signalWireContainer.style.top = '0'
    signalWireContainer.style.left = '0'
    
    // Append to our ref container
    containerRef.current.appendChild(signalWireContainer)

    // Store reference for room session
    ;(containerRef.current as any)._signalWireContainer = signalWireContainer

    // Cleanup
    return () => {
      if (containerRef.current && signalWireContainer.parentNode) {
        containerRef.current.removeChild(signalWireContainer)
      }
    }
  }, [])

  const joinRoom = async (tokenToUse: string) => {
    if (!containerRef.current) {
      console.error('Missing container')
      return
    }

    const signalWireContainer = (containerRef.current as any)._signalWireContainer
    if (!signalWireContainer) {
      console.error('SignalWire container not initialized')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      console.log('Creating SignalWire room session...')
      
      // Extract ICE servers from token
      let iceServers: any[] = []
      try {
        const payload = JSON.parse(atob(tokenToUse.split('.')[1]))
        console.log('Token payload:', payload)
        const ice_servers = payload?.video?.ice_servers || payload?.ice_servers || payload?.s?.ice_servers || []
        console.log('ICE servers found:', ice_servers.length)
        
        // Filter out any ICE servers with overly long usernames
        iceServers = (ice_servers || []).filter((server: any) => {
          if (!server.username) return true
          return server.username.length <= 256
        })
        
        // Add fallback STUN server
        if (iceServers.length === 0) {
          iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
          console.log('No ICE servers in token, using fallback STUN')
        }
      } catch (e) {
        console.log('Could not parse token for ICE servers, using defaults')
        iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
      }
      
      // Create room session - use the isolated container
      // Note: Don't pass iceServers if we're using defaults, let SignalWire handle it
      const roomSessionConfig: any = {
        token: tokenToUse,
        rootElement: signalWireContainer // Use the isolated container
      }
      
      // Only add iceServers if we found them in the token
      if (iceServers.length > 0 && !iceServers[0].urls.includes('google.com')) {
        roomSessionConfig.iceServers = iceServers
        console.log('Using ICE servers from token')
      } else {
        console.log('Letting SignalWire handle ICE server configuration')
      }
      
      // Request permissions first to avoid delays
      // This "pre-warms" the browser's media permissions, so when SignalWire needs them, they're already available
      if (enableAudio || enableVideo) {
        try {
          console.log('Pre-requesting media permissions to avoid delays...')
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
          // Stop the stream immediately - we just needed to trigger permissions
          stream.getTracks().forEach(track => track.stop())
          console.log('Media permissions pre-warmed successfully')
        } catch (err) {
          console.error('Failed to pre-request media permissions:', err)
          // Continue anyway - SignalWire will handle permissions
        }
      }
      
      const roomSession = new SignalWire.Video.RoomSession(roomSessionConfig)
      
      console.log('Room session created, setting up event handlers...')

      // Set up event handlers
      roomSession.on('room.joined', (params) => {
        console.log('Room joined:', params)
        setIsConnected(true)
        setIsConnecting(false)
        
        // Extract the actual room ID from the event or roomSession
        const actualRoomId = (params as any).room_id || (params.room as any)?.id || roomSession.roomId
        const actualRoomSessionId = params.room_session?.id || roomSession.id
        
        console.log('Extracted room details:', { 
          actualRoomId, 
          actualRoomSessionId,
          fromParams: (params as any).room_id,
          fromRoom: (params.room as any)?.id,
          fromSession: roomSession.roomId
        })
        
        if (params.room && 'members' in params.room) {
          const memberMap = new Map()
          Object.entries(params.room.members).forEach(([id, member]) => {
            memberMap.set(id, member)
          })
          setMembers(memberMap)
        }
        
        // Pass the room session to the callback
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

      roomSession.on('member.joined', (e) => {
        console.log(`${e.member.name} joined the room.`)
        // Don't update members here if they're already in the list from room.joined/room.updated
        setMembers(prev => {
          if (prev.has(e.member.id)) {
            console.log(`Member ${e.member.id} already in list, skipping duplicate`)
            return prev
          }
          const newMap = new Map(prev)
          newMap.set(e.member.id, e.member)
          return newMap
        })
        onMemberJoined?.(e.member)
      })

      roomSession.on('member.left', (e) => {
        console.log(`${e.member.name} left the room.`)
        setMembers(prev => {
          const newMap = new Map(prev)
          newMap.delete(e.member.id)
          return newMap
        })
        onMemberLeft?.(e.member)
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
        
        // Store the actual room ID from layout change event
        if (params.room_id && !actualRoomIdRef.current) {
          actualRoomIdRef.current = params.room_id
          actualRoomSessionIdRef.current = params.room_session_id
          
          console.log('Captured actual room IDs from layout change:', {
            room_id: params.room_id,
            room_session_id: params.room_session_id
          })
          
          // No need to call onRoomJoined again here
        }
      })

      roomSession.on('room.left', () => {
        console.log('Room left')
        setIsConnected(false)
      })

      // Store room session reference
      roomSessionRef.current = roomSession

      // Join the room with audio/video options like the testimonial component
      console.log('Joining room with audio/video options...')
      await roomSession.join({
        audio: enableAudio,
        video: enableVideo
      })
      console.log('Successfully joined room')

    } catch (err: any) {
      console.error('Error joining room:', err)
      setIsConnecting(false)
      
      // Handle specific error codes
      if (err.code === '102') {
        setError('Connection timed out. The video session may have expired. Please refresh the page.')
      } else {
        setError(err.message || 'Could not join video session.')
      }
      
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

  // Join with provided token
  useEffect(() => {
    if (providedToken && containerRef.current && !isConnecting && !isConnected) {
      // Wait a bit for the container to be ready
      setTimeout(() => {
        joinRoom(providedToken)
      }, 100)
    }
  }, [providedToken])

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
      {!providedToken && (
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

      {/* Video Container - Isolated from React */}
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
        {/* Loading State - Use absolute positioning to avoid DOM conflicts */}
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

        {/* Error State - Use absolute positioning to avoid DOM conflicts */}
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

      {/* Controls - Outside the video container */}
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

      {/* Member List - Outside the video container */}
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

export default SignalWireVideoRoom