import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as SignalWire from '@signalwire/js'

interface SimpleSignalWireRoomProps {
  token: string
  onError?: (error: any) => void
  onRoomJoined?: () => void
  onMemberJoined?: (member: any) => void
}

export const SimpleSignalWireRoom: React.FC<SimpleSignalWireRoomProps> = ({
  token,
  onError,
  onRoomJoined,
  onMemberJoined
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isInitializingRef = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const isConnectedRef = useRef(false)
  const isMountedRef = useRef(true)
  
  // Store callbacks in refs to avoid stale closures
  const onErrorRef = useRef(onError)
  const onRoomJoinedRef = useRef(onRoomJoined)
  const onMemberJoinedRef = useRef(onMemberJoined)
  
  useEffect(() => {
    onErrorRef.current = onError
    onRoomJoinedRef.current = onRoomJoined
    onMemberJoinedRef.current = onMemberJoined
  }, [onError, onRoomJoined, onMemberJoined])

  useEffect(() => {
    console.log('=== SimpleSignalWireRoom Effect Running ===')
    console.log('Token changed to:', token?.substring(0, 20) + '...')
    isMountedRef.current = true
    
    if (!token || token === 'null' || !videoContainerRef.current) {
      console.log('Waiting for valid token and container...', { token: !!token, tokenValue: token, container: !!videoContainerRef.current })
      if (token === 'null') {
        setError('No video token available. SignalWire may not be configured.')
      }
      return
    }

    const initializeRoom = async () => {
      // Prevent multiple simultaneous initializations
      if (isInitializingRef.current || isConnectedRef.current) {
        console.log('Already initializing or connected, skipping...')
        return
      }
      
      isInitializingRef.current = true
      
      console.log('=== Simple SignalWire Room Init ===')
      console.log('Token present:', !!token)
      console.log('Container ready:', !!videoContainerRef.current)
      console.log('Protocol:', window.location.protocol)
      
      try {
        setIsConnecting(true)
        setError(null)
        
        // Don't pre-request permissions - let SignalWire handle it
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

        // Create room session - let SignalWire handle ICE configuration
        console.log('Creating room session...')
        const roomSession = new SignalWire.Video.RoomSession({
          token: token,
          rootElement: videoContainerRef.current
        })

        roomSessionRef.current = roomSession

        // Monitor connection progress
        const startTime = Date.now()
        console.log('⏱️ Connection started at:', new Date().toISOString())

        // Simple event handlers
        roomSession.on('room.joined', (params) => {
          const connectionTime = Date.now() - startTime
          console.log(`✅ Room joined in ${connectionTime}ms (${(connectionTime / 1000).toFixed(1)}s)`)
          console.log('Room details:', params)
          
          if (isMountedRef.current) {
            setIsConnected(true)
            isConnectedRef.current = true
            setIsConnecting(false)
            onRoomJoinedRef.current?.()
            
            // Log room details
            if (params.room) {
              console.log('Room name:', params.room.name)
              console.log('Room ID:', (params.room as any).id || 'N/A')
              console.log('Members:', Object.keys('members' in params.room ? params.room.members : {}).length)
            }
          }
        })

        roomSession.on('member.joined', (params) => {
          console.log('👤 Member joined:', params.member.name || params.member.id)
          onMemberJoinedRef.current?.(params.member)
        })

        roomSession.on('member.left', (params) => {
          console.log('👤 Member left:', params.member.name || params.member.id)
        })

        roomSession.on('room.left', (params) => {
          console.log('❌ Room left:', params)
          // Only update state if we were actually connected
          if (isConnectedRef.current) {
            setIsConnected(false)
            isConnectedRef.current = false
          }
          if (params && 'error' in params && params.error) {
            const errorMsg = (params.error as any).message || 'Connection lost'
            setError(errorMsg)
            onErrorRef.current?.(params.error)
          }
        })

        // Add timeout handler - increase to 30 seconds
        const joinTimeout = setTimeout(() => {
          if (!isConnectedRef.current && isConnecting) {
            console.error('Join timeout - connection taking too long')
            setError('Connection is taking longer than expected. Please check your network.')
            setIsConnecting(false)
          }
        }, 30000) // 30 second timeout

        // Join the room with audio/video parameters
        console.log('Joining room with audio/video...')
        
        try {
          const joinStart = Date.now()
          await roomSession.join({
            audio: true,
            video: isMobile ? {
              facingMode: { exact: 'environment' } // Use rear camera on mobile for inspections
            } : true
          })
          const joinTime = Date.now() - joinStart
          console.log(`✅ Join request completed in ${joinTime}ms`)
          clearTimeout(joinTimeout)
        } catch (joinErr) {
          clearTimeout(joinTimeout)
          throw joinErr
        }

      } catch (err: any) {
        console.error('❌ Failed to initialize room:', err)
        
        // Handle specific error types
        let errorMessage = err.message || 'Failed to join room'
        let canRetry = false
        
        if (err.name === 'NotReadableError' || errorMessage.includes('Device in use')) {
          errorMessage = 'Camera or microphone is in use by another application. Please close other video apps or browser tabs and try again.'
          canRetry = true
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera and microphone access denied. Please allow access and refresh the page.'
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera or microphone found. Please connect a device and try again.'
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera settings not supported. Please try using a different camera.'
        } else if (errorMessage.includes('wrong state')) {
          errorMessage = 'Connection error. Please refresh the page and try again.'
          console.error('WebRTC state error - this is a SignalWire SDK issue')
        }
        
        setError(errorMessage)
        onErrorRef.current?.(err)
        setIsConnecting(false)
        
        // Auto-retry for device in use errors
        if (canRetry && retryCount < 3) {
          console.log(`Device in use - will retry in 3 seconds (attempt ${retryCount + 1}/3)`)
          setTimeout(() => {
            setRetryCount(prev => prev + 1)
            setError(null)
            initializeRoom()
          }, 3000)
        }
      } finally {
        isInitializingRef.current = false
      }
    }

    initializeRoom()

    // Cleanup
    return () => {
      console.log('=== Cleanup started ===')
      console.log('isConnectedRef.current:', isConnectedRef.current)
      console.log('roomSessionRef.current exists:', !!roomSessionRef.current)
      
      isMountedRef.current = false
      
      if (roomSessionRef.current) {
        if (isConnectedRef.current) {
          console.log('Leaving room...')
          try {
            roomSessionRef.current.leave()
          } catch (err: any) {
            console.log('Error leaving room:', err.message)
          }
        }
        roomSessionRef.current = null
      }
      
      isInitializingRef.current = false
      isConnectedRef.current = false
    }
  }, [token]) // Only reinitialize when token changes

  return (
    <div className="simple-signalwire-room" style={{ width: '100%', height: '100%' }}>
      <div 
        ref={videoContainerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          backgroundColor: '#000',
          position: 'relative'
        }}
      >
        {isConnecting && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: 'white',
            zIndex: 10
          }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTop: '3px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
            </div>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>Connecting to video room...</div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>Setting up secure connection...</div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        
        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '20px',
            borderRadius: '10px',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
            <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Connection Issue</div>
            <div style={{ marginBottom: '15px' }}>{error}</div>
            {error.includes('in use') && (
              <>
                <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '10px' }}>
                  Tip: Check if you have other video calls open in browser tabs or apps like Zoom, Teams, or Skype.
                </div>
                {retryCount > 0 && retryCount < 3 && (
                  <div style={{ fontSize: '14px', color: '#ffc107' }}>
                    Retrying automatically... (Attempt {retryCount}/3)
                  </div>
                )}
              </>
            )}
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Refresh Page
            </button>
          </div>
        )}
      </div>
      
      {isConnected && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 255, 0, 0.8)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '5px'
        }}>
          Connected
        </div>
      )}
    </div>
  )
}