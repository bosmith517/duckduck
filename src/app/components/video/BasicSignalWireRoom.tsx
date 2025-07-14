import React, { useEffect, useRef, useState } from 'react'
import * as SignalWire from '@signalwire/js'

interface BasicSignalWireRoomProps {
  token: string
}

export const BasicSignalWireRoom: React.FC<BasicSignalWireRoomProps> = ({ token }) => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (!token || token === 'null' || !videoContainerRef.current) {
      setError('Invalid token or container')
      return
    }
    
    const connect = async () => {
      try {
        setStatus('Creating room session...')
        
        // Most basic configuration - let SignalWire handle everything
        const roomSession = new SignalWire.Video.RoomSession({
          token: token,
          rootElement: videoContainerRef.current
        })
        
        roomSession.on('room.joined', () => {
          console.log('✅ BASIC: Room joined successfully')
          setStatus('Connected!')
        })
        
        roomSession.on('room.left', (params) => {
          console.log('❌ BASIC: Room left', params)
          setStatus('Disconnected')
        })
        
        setStatus('Joining room...')
        await roomSession.join()
        
      } catch (err: any) {
        console.error('❌ BASIC: Error:', err)
        setError(err.message)
        setStatus('Failed to connect')
      }
    }
    
    connect()
  }, [token])
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div 
        ref={videoContainerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          backgroundColor: '#000'
        }}
      />
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <div>Status: {status}</div>
        {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      </div>
    </div>
  )
}