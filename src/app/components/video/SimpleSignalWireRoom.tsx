import React, { useEffect, useRef, useState } from 'react'
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

  useEffect(() => {
    if (!token || token === 'null' || !videoContainerRef.current) {
      console.log('Waiting for valid token and container...', { token: !!token, tokenValue: token, container: !!videoContainerRef.current })
      if (token === 'null') {
        setError('No video token available. SignalWire may not be configured.')
      }
      return
    }

    const initializeRoom = async () => {
      console.log('=== Simple SignalWire Room Init ===')
      console.log('Token present:', !!token)
      console.log('Container ready:', !!videoContainerRef.current)
      console.log('Protocol:', window.location.protocol)
      
      try {
        setIsConnecting(true)
        setError(null)

        // Create room session with updated SDK pattern
        console.log('Creating room session...')
        const roomSession = new SignalWire.Video.RoomSession({
          token: token,
          rootElement: videoContainerRef.current
          // Don't set audio/video here - deprecated
        })

        roomSessionRef.current = roomSession

        // Simple event handlers
        roomSession.on('room.joined', (params) => {
          console.log('✅ Room joined:', params)
          setIsConnected(true)
          setIsConnecting(false)
          onRoomJoined?.()
          
          // Log room details
          if (params.room) {
            console.log('Room name:', params.room.name)
            console.log('Room ID:', (params.room as any).id || 'N/A')
            console.log('Members:', Object.keys('members' in params.room ? params.room.members : {}).length)
          }
        })

        roomSession.on('member.joined', (params) => {
          console.log('👤 Member joined:', params.member.name || params.member.id)
          onMemberJoined?.(params.member)
        })

        roomSession.on('member.left', (params) => {
          console.log('👤 Member left:', params.member.name || params.member.id)
        })

        roomSession.on('room.left', (params) => {
          console.log('❌ Room left:', params)
          setIsConnected(false)
          if (params && 'error' in params && params.error) {
            const errorMsg = (params.error as any).message || 'Connection lost'
            setError(errorMsg)
            onError?.(params.error)
          }
        })

        // Join the room with audio/video parameters
        console.log('Joining room with audio/video...')
        await roomSession.join({
          audio: true,
          video: true
        })
        console.log('✅ Join request sent')

      } catch (err: any) {
        console.error('❌ Failed to initialize room:', err)
        setError(err.message || 'Failed to join room')
        onError?.(err)
        setIsConnecting(false)
      }
    }

    initializeRoom()

    // Cleanup
    return () => {
      if (roomSessionRef.current) {
        console.log('Leaving room...')
        roomSessionRef.current.leave().catch(console.error)
      }
    }
  }, [token, onError, onRoomJoined, onMemberJoined])

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
            color: 'white'
          }}>
            <div>Connecting to video room...</div>
          </div>
        )}
        
        {error && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px'
          }}>
            Error: {error}
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