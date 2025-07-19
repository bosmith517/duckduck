import React, { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../../supabaseClient'

// Declare SignalWire globally (loaded via CDN)
declare global {
  interface Window {
    SignalWire: any
  }
}

interface TestimonialVideoRoomCleanProps {
  testimonialId: string
  customerName: string
  jobTitle: string
  onRecordingComplete?: (videoUrl: string) => void
  onError?: (error: any) => void
  maxDuration?: number // in seconds
}

// This component ONLY uses the browser SDK for video display
// Recording control is handled server-side via edge functions
export const TestimonialVideoRoomClean: React.FC<TestimonialVideoRoomCleanProps> = ({
  testimonialId,
  customerName,
  jobTitle,
  onRecordingComplete,
  onError,
  maxDuration = 180 // 3 minutes default
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)
  
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Load SignalWire SDK from CDN
  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script')
      script.src = 'https://cdn.signalwire.com/@signalwire/js'
      script.async = true
      script.onload = () => {
        const sdkLoadTime = performance.now()
        console.log('✅ SignalWire Browser SDK loaded')
        scriptLoadedRef.current = true
        // Initialize room after SDK loads
        initializeRoom()
      }
      script.onerror = () => {
        console.error('Failed to load SignalWire SDK')
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

  const initializeRoom = async () => {
    const startTime = performance.now()
    console.log('🚀 Starting video initialization...', new Date().toISOString())
    
    try {
      setIsConnecting(true)
      setError(null)

      // Get room token from backend
      const tokenStartTime = performance.now()
      console.log('📡 Fetching token from edge function...')
      
      const { data, error } = await supabase.functions.invoke('create-video-token', {
        body: { 
          room_name: `testimonial-${testimonialId}`,
          user_name: customerName
        }
      })
      
      const tokenTime = performance.now() - tokenStartTime
      console.log(`✅ Token received in ${tokenTime.toFixed(0)}ms`)

      if (error) {
        console.error('Edge function error:', error)
        
        // Try to read the error response body
        if (error.context?.body) {
          try {
            const bodyText = await error.context.body.text()
            console.error('Error response:', bodyText)
            const errorData = JSON.parse(bodyText)
            throw new Error(errorData.error || errorData.message || 'Edge function error')
          } catch (e) {
            console.error('Could not parse error response')
          }
        }
        throw error
      }
      
      console.log('Edge function response:', data)
      
      if (!data?.token) throw new Error('No token received')
      
      // Join room with token
      await joinVideoRoom(data.token)
      
      const totalTime = performance.now() - startTime
      console.log(`🎉 Video initialization complete in ${totalTime.toFixed(0)}ms (${(totalTime/1000).toFixed(1)}s)`)
      
    } catch (err: any) {
      console.error('Error initializing room:', err)
      setError(err.message || 'Failed to initialize video room')
      setIsConnecting(false)
      onError?.(err)
      
      const failTime = performance.now() - startTime
      console.log(`❌ Video initialization failed after ${failTime.toFixed(0)}ms`)
    }
  }

  const joinVideoRoom = async (token: string) => {
    if (!window.SignalWire || !videoContainerRef.current) {
      console.error('SignalWire SDK or container not ready')
      return
    }

    try {
      // Request permissions first to avoid delays
      const permStartTime = performance.now()
      console.log('🎤 Requesting media permissions...')
      
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        console.log(`✅ Media permissions granted in ${(performance.now() - permStartTime).toFixed(0)}ms`)
      } catch (permError) {
        console.error('Media permission error:', permError)
        // Continue anyway - SignalWire will handle permissions
      }
      
      const roomStartTime = performance.now()
      console.log('🔧 Creating room session...')
      
      // Create room session with browser SDK
      const roomSession = new window.SignalWire.Video.RoomSession({
        token: token,
        rootElement: videoContainerRef.current
      })
      
      console.log(`✅ Room session created in ${(performance.now() - roomStartTime).toFixed(0)}ms`)

      // Event handlers
      roomSession.on('room.joined', (params: any) => {
        console.log('Room joined:', params)
        setIsConnected(true)
        setIsConnecting(false)
      })

      roomSession.on('room.left', () => {
        console.log('Room left')
        setIsConnected(false)
        setIsRecording(false)
      })

      roomSessionRef.current = roomSession

      // Join the room
      const joinStartTime = performance.now()
      console.log('🚪 Joining room...')
      await roomSession.join({
        audio: true,
        video: true
      })
      
      const joinTime = performance.now() - joinStartTime
      console.log(`✅ Room joined in ${joinTime.toFixed(0)}ms`)
      
    } catch (err: any) {
      console.error('Error joining room:', err)
      setIsConnecting(false)
      setError(err.message || 'Could not join video room')
      onError?.(err)
    }
  }

  // Start recording via server-side function
  const startRecording = useCallback(async () => {
    if (!isConnected || isRecording) return
    
    try {
      console.log('Requesting server to start recording...')
      
      const { data, error } = await supabase.functions.invoke('start-recording-v2', {
        body: { 
          testimonialId,
          roomName: `testimonial-${testimonialId}`
        }
      })

      if (error) throw error
      
      setIsRecording(true)
      setRecordingTime(0)
      
      // Local timer for UI
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= maxDuration) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
      
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to start recording')
    }
  }, [isConnected, isRecording, testimonialId, maxDuration])

  // Stop recording via server-side function
  const stopRecording = useCallback(async () => {
    if (!isRecording) return
    
    try {
      console.log('Requesting server to stop recording...')
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      const { data, error } = await supabase.functions.invoke('stop-recording-v2', {
        body: { 
          testimonialId,
          roomName: `testimonial-${testimonialId}`
        }
      })

      if (error) throw error
      
      setIsRecording(false)
      
      if (data.videoUrl) {
        onRecordingComplete?.(data.videoUrl)
      }
      
    } catch (err) {
      console.error('Error stopping recording:', err)
      setError('Failed to stop recording')
    }
  }, [isRecording, testimonialId])

  // Media controls using browser SDK
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (roomSessionRef.current) {
        try {
          roomSessionRef.current.leave()
        } catch (error) {
          console.log('Room cleanup error:', error)
        }
      }
    }
  }, [])

  return (
    <div className="testimonial-video-room">
      <div className="card mb-4">
        <div className="card-body">
          <h3 className="card-title">Record Your Video Testimonial</h3>
          <p className="text-muted mb-0">
            Hi {customerName}! Please share your experience with our {jobTitle} service.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div 
            ref={videoContainerRef}
            className="video-container"
            style={{
              width: '100%',
              height: '500px',
              backgroundColor: '#000',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Loading */}
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

            {/* Error */}
            {error && !isConnecting && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: '20px',
                borderRadius: '10px',
                maxWidth: '400px'
              }}>
                <div className="alert alert-danger mb-0">
                  <h5>Connection Error</h5>
                  <p>{error}</p>
                  <button 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      setError(null)
                      initializeRoom()
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 0, 0, 0.9)',
                padding: '10px 20px',
                borderRadius: '20px',
                color: 'white',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  animation: 'pulse 1s infinite'
                }} />
                REC {formatTime(recordingTime)}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        {isConnected && (
          <div className="card-footer">
            <div className="d-flex justify-content-center gap-3 mb-3">
              {!isRecording ? (
                <button
                  type="button"
                  className="btn btn-danger btn-lg"
                  onClick={startRecording}
                >
                  <i className="ki-duotone ki-video-add fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={stopRecording}
                >
                  <i className="ki-duotone ki-stop fs-1 me-2">
                    <span className="path1"></span>
                  </i>
                  Stop Recording
                </button>
              )}
            </div>

            <div className="d-flex justify-content-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={toggleAudio}
                title="Toggle Audio"
              >
                <i className="ki-duotone ki-microphone fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
              
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={toggleVideo}
                title="Toggle Video"
              >
                <i className="ki-duotone ki-video fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
            </div>
            
            {isRecording && recordingTime < 5 && (
              <p className="text-muted text-center mt-3 mb-0">
                Please record at least 5 seconds
              </p>
            )}
            
            {isRecording && (
              <div className="progress mt-3" style={{ height: '5px' }}>
                <div 
                  className="progress-bar bg-danger" 
                  role="progressbar" 
                  style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default TestimonialVideoRoomClean