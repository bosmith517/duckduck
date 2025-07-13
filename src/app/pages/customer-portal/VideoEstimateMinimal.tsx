import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as SignalWire from '@signalwire/js'

const VideoEstimateMinimal: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  const videoRef = React.useRef<HTMLDivElement>(null)
  
  const swToken = searchParams.get('sw_token')
  
  useEffect(() => {
    if (!swToken || swToken === 'null' || !videoRef.current) {
      setError('Missing video token')
      return
    }
    
    let roomSession: any = null
    
    const connect = async () => {
      try {
        setStatus('Creating room session...')
        
        // Create minimal room session
        roomSession = new SignalWire.Video.RoomSession({
          token: swToken,
          rootElement: videoRef.current
        })
        
        // Set up basic handlers
        roomSession.on('room.joined', (e: any) => {
          console.log('✅ Joined room:', e)
          setStatus('Connected to room')
        })
        
        roomSession.on('member.joined', (e: any) => {
          console.log('👤 Member joined:', e.member.name)
          if (e.member.name?.includes('Alex') || e.member.name?.includes('Estimator')) {
            setStatus('AI Estimator has joined!')
          }
        })
        
        roomSession.on('room.left', (e: any) => {
          console.log('❌ Left room:', e)
          setStatus('Disconnected')
        })
        
        // Join with media
        setStatus('Joining room...')
        await roomSession.join({
          audio: true,
          video: true
        })
        
      } catch (err: any) {
        console.error('Connection error:', err)
        setError(err.message || 'Failed to connect')
      }
    }
    
    connect()
    
    // Cleanup
    return () => {
      if (roomSession) {
        roomSession.leave().catch(console.error)
      }
    }
  }, [swToken])
  
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: '#000',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '20px', backgroundColor: '#333' }}>
        <h2>Video Estimate - Minimal Test</h2>
        <p>Status: {status}</p>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      </div>
      
      <div 
        ref={videoRef}
        style={{
          flex: 1,
          width: '100%',
          position: 'relative'
        }}
      />
    </div>
  )
}

export default VideoEstimateMinimal