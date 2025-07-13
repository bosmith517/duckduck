import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { VideoSession } from '../video-estimating/VideoEstimatingHub'
import * as SignalWire from '@signalwire/js'

const VideoEstimatePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  
  const sessionId = searchParams.get('session')
  const token = searchParams.get('token') // Portal JWT for Supabase
  const swToken = searchParams.get('sw_token') // SignalWire JWT for video
  
  useEffect(() => {
    if (sessionId && token) {
      loadSession()
    } else {
      setError('Invalid session link')
      setLoading(false)
    }
  }, [sessionId, token])
  
  const loadSession = async () => {
    try {
      setLoading(true)
      
      console.log('Looking up session:', sessionId)
      console.log('Portal token (first 50 chars):', token?.substring(0, 50))
      
      // Decode the token to validate it
      if (token) {
        try {
          const tokenData = JSON.parse(atob(token))
          console.log('Token data:', tokenData)
          
          // Check if token is expired
          if (new Date(tokenData.expires) < new Date()) {
            throw new Error('Session link has expired')
          }
          
          // Validate session matches
          if (tokenData.session_id !== sessionId) {
            throw new Error('Invalid session link')
          }
        } catch (err) {
          console.error('Invalid token:', err)
          throw new Error('Invalid session link')
        }
      }
      
      // Query the video session using anon key (public access)
      // Security is based on knowing both session ID and room ID from the token
      const { data, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
        
      if (sessionError) {
        console.error('Session lookup error:', sessionError)
        throw new Error(`Session not found: ${sessionError.message}`)
      }
      
      if (!data) {
        console.error('No session data returned')
        throw new Error('Session not found')
      }
      
      console.log('Session found:', data)
      
      // No need to validate token - it's a real JWT that we'll use directly for SignalWire
      
      if (data.status === 'completed') {
        throw new Error('This session has already ended')
      }
      
      setSession(data)
      
      // Connect to video room
      await connectToRoom(data)
      
    } catch (err: any) {
      console.error('Error loading session:', err)
      setError(err.message || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }
  
  const connectToRoom = async (sessionData: VideoSession) => {
    try {
      // Use the SignalWire token for video connection
      console.log('Using SignalWire token from URL for customer connection')
      
      if (!swToken) {
        throw new Error('No SignalWire token provided')
      }
      
      // Initialize SignalWire with the SignalWire JWT
      await initializeSignalWire(swToken)
      
    } catch (err: any) {
      console.error('Error connecting to room:', err)
      setError('Failed to connect to video session: ' + (err.message || 'Unknown error'))
    }
  }
  
  const initializeSignalWire = async (roomToken: string) => {
    try {
      // Check if we're in a secure context
      const isSecureContext = window.isSecureContext
      const protocol = window.location.protocol
      const hostname = window.location.hostname
      
      console.log('Security context:', { isSecureContext, protocol, hostname })
      
      if (!isSecureContext && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        console.warn('Not in secure context - media devices will not work')
        setError('⚠️ This page must be accessed over HTTPS for video/audio to work. Currently using ' + protocol + '//' + hostname)
      }
      
      // Request camera and microphone permissions first
      console.log('Requesting media permissions...')
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Request permissions with specific constraints
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }, 
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            }
          })
          console.log('Media permissions granted');
          // Keep the stream for SignalWire to use
          (window as any).localStream = stream
        } catch (mediaError: any) {
          console.error('Media permission error:', mediaError)
          
          // Provide specific error messages but don't stop the connection
          if (mediaError.name === 'NotAllowedError') {
            setError('Camera/microphone access was denied. The video session will continue but you won\'t be visible.')
          } else if (mediaError.name === 'NotFoundError') {
            setError('No camera or microphone found. The video session will continue in audio-only mode.')
          } else if (mediaError.name === 'NotReadableError') {
            setError('Camera/microphone is already in use. The video session will continue but may have limited functionality.')
          } else {
            setError(`Media error: ${mediaError.message}. Continuing without media.`)
          }
        }
      } else {
        console.error('navigator.mediaDevices is not available')
        if (!isSecureContext) {
          setError('⚠️ Camera/microphone access requires HTTPS. Please use a secure connection.')
        } else {
          setError('⚠️ Your browser does not support camera/microphone access.')
        }
      }
      
      // Continue without media stream - try to connect anyway
      console.log('Continuing with SignalWire connection...')
      
      // SignalWire SDK is now statically imported
      console.log('SignalWire SDK available:', !!SignalWire.Video)
      
      const roomSession = new SignalWire.Video.RoomSession({
        token: roomToken,
        rootElement: videoContainerRef.current,
        audio: false, // Start with audio/video disabled
        video: false,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      })
      
      roomSession.on('room.joined', async () => {
        console.log('Customer joined room')
        setIsConnected(true)
        
        // Try to enable media after joining if we have a secure context
        if (window.isSecureContext && navigator.mediaDevices) {
          try {
            console.log('Attempting to enable media after joining...')
            await roomSession.audioMute()
            await roomSession.videoMute()
            // Then unmute to trigger media request
            await roomSession.audioUnmute()
            await roomSession.videoUnmute()
          } catch (err) {
            console.log('Could not enable media:', err)
          }
        }
      })
      
      roomSession.on('room.left', (params: any) => {
        console.log('Customer left room')
        setIsConnected(false)
        if (params?.error) {
          console.error('SignalWire error:', params.error)
          setError('Video connection error: ' + (params.error.message || 'Unknown error'))
        }
      })
      
      await roomSession.join()
      
    } catch (err: any) {
      console.error('Error initializing SignalWire:', err)
      setError('Failed to initialize video: ' + (err.message || 'Unknown error'))
    }
  }
  
  if (loading) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-dark'>
        <div className='text-center text-white'>
          <div className='spinner-border text-light mb-3' role='status'>
            <span className='visually-hidden'>Loading...</span>
          </div>
          <div>Loading video session...</div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-dark'>
        <div className='text-center text-white'>
          <i className='ki-duotone ki-cross-circle fs-5x text-danger mb-3'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
          <h3>Unable to Join Session</h3>
          <p className='text-muted'>{error}</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className='min-vh-100 bg-dark'>
      {/* Header */}
      <div className='bg-white border-bottom px-5 py-3'>
        <div className='d-flex justify-content-between align-items-center'>
          <div>
            <h3 className='mb-0'>Video Estimate Session</h3>
            <span className='text-muted'>
              {session?.trade_type} Inspection
            </span>
          </div>
          <div>
            <span className={`badge badge-${isConnected ? 'success' : 'warning'}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Video Container */}
      <div 
        ref={videoContainerRef}
        className='position-relative'
        style={{ height: 'calc(100vh - 70px)' }}
      >
        {!isConnected && (
          <div className='position-absolute top-50 start-50 translate-middle text-center text-white'>
            <div className='spinner-border text-light mb-3' role='status'>
              <span className='visually-hidden'>Connecting...</span>
            </div>
            <div>Connecting to video session...</div>
          </div>
        )}
      </div>
      
      {/* Instructions Overlay */}
      {isConnected && (
        <div className='position-fixed bottom-0 start-0 end-0 p-4'>
          <div className='bg-white bg-opacity-90 rounded p-3 shadow mx-auto' style={{ maxWidth: '600px' }}>
            <h5 className='mb-2'>Video Estimate Instructions</h5>
            <p className='mb-0'>
              Our technician will guide you through showing the areas that need inspection. 
              Please have good lighting and a stable internet connection.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoEstimatePage