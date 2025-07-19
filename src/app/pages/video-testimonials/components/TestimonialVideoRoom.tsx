import React, { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../../supabaseClient'

// Declare SignalWire globally (loaded via CDN)
declare global {
  interface Window {
    SignalWire: any
  }
}

interface TestimonialVideoRoomProps {
  testimonialId: string
  customerName: string
  jobTitle: string
  onRecordingComplete?: (videoUrl: string) => void
  onError?: (error: any) => void
  maxDuration?: number // in seconds
}

export const TestimonialVideoRoom: React.FC<TestimonialVideoRoomProps> = ({
  testimonialId,
  customerName,
  jobTitle,
  onRecordingComplete,
  onError,
  maxDuration = 180 // 3 minutes default
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const recordingRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const scriptLoadedRef = useRef(false)
  
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [roomToken, setRoomToken] = useState<string | null>(null)

  // Load SignalWire SDK
  useEffect(() => {
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script')
      script.src = 'https://cdn.signalwire.com/@signalwire/js'
      script.async = true
      script.onload = () => {
        console.log('SignalWire SDK loaded')
        scriptLoadedRef.current = true
        // If we already have a token, initialize the room
        if (roomToken) {
          initializeVideoRoom()
        }
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

  // Get room token on mount
  useEffect(() => {
    getRoomToken()
  }, [testimonialId])

  const getRoomToken = async () => {
    try {
      setIsConnecting(true)
      setError(null)

      // Get video room token from Supabase
      const { data, error } = await supabase.functions.invoke('get-testimonial-room-token', {
        body: { 
          testimonialId,
          roomName: `testimonial-${testimonialId}`,
          userName: customerName
        }
      })

      if (error) throw error
      
      setRoomToken(data.token)
      
      // If SDK is already loaded, initialize room
      if (scriptLoadedRef.current) {
        initializeVideoRoom()
      }
      
    } catch (err: any) {
      console.error('Error getting room token:', err)
      setError('Failed to get video room access')
      setIsConnecting(false)
      onError?.(err)
    }
  }

  const initializeVideoRoom = async () => {
    if (!window.SignalWire || !roomToken || !videoContainerRef.current) {
      console.error('Missing requirements for video room', {
        sdk: !!window.SignalWire,
        token: !!roomToken,
        container: !!videoContainerRef.current
      })
      return
    }

    try {
      console.log('Initializing video room...')
      
      // Create room session using browser SDK
      const roomSession = new window.SignalWire.Video.RoomSession({
        token: roomToken,
        rootElement: videoContainerRef.current
      })

      // Set up event handlers
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

      roomSession.on('member.joined', (e: any) => {
        console.log(`${e.member.name} joined`)
      })

      roomSession.on('member.left', (e: any) => {
        console.log(`${e.member.name} left`)
      })

      roomSessionRef.current = roomSession

      // Join the room
      console.log('Joining room...')
      await roomSession.join()
      console.log('Successfully joined room')

    } catch (err: any) {
      console.error('Error joining room:', err)
      setIsConnecting(false)
      setError(err.message || 'Could not join video session')
      onError?.(err)
    }
  }

  // Start recording
  const startRecording = useCallback(async () => {
    if (!roomSessionRef.current || isRecording) return
    
    try {
      console.log('Starting recording...')
      
      // Call Supabase function to start recording
      const { data, error } = await supabase.functions.invoke('start-testimonial-recording', {
        body: { 
          testimonialId,
          roomSessionId: roomSessionRef.current.id || `testimonial-${testimonialId}`
        }
      })

      if (error) throw error
      
      recordingRef.current = data.recordingId
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
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
  }, [isRecording, testimonialId, maxDuration])

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!isRecording || !recordingRef.current) return
    
    try {
      console.log('Stopping recording...')
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // Call Supabase function to stop recording
      const { data, error } = await supabase.functions.invoke('stop-testimonial-recording', {
        body: { 
          recordingId: recordingRef.current,
          testimonialId
        }
      })

      if (error) throw error
      
      setIsRecording(false)
      recordingRef.current = null
      
      // Video URL will be available after processing
      if (data.videoUrl) {
        onRecordingComplete?.(data.videoUrl)
      }
      
    } catch (err) {
      console.error('Error stopping recording:', err)
      setError('Failed to stop recording')
    }
  }, [isRecording, testimonialId])

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

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Cleanup on unmount
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

  // Submit testimonial
  const submitTestimonial = async () => {
    setIsSubmitting(true)
    try {
      // Stop recording if still active
      if (isRecording) {
        await stopRecording()
      }
      
      // Leave room
      if (roomSessionRef.current) {
        await roomSessionRef.current.leave()
      }
      
      // Mark testimonial as complete
      const { error } = await supabase.functions.invoke('complete-testimonial', {
        body: { testimonialId }
      })
      
      if (error) throw error
      
      // Redirect to thank you page
      window.location.href = `/testimonial/thank-you?id=${testimonialId}`
      
    } catch (err) {
      console.error('Error submitting testimonial:', err)
      setError('Failed to submit testimonial')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="testimonial-video-room">
      {/* Header */}
      <div className="card mb-4">
        <div className="card-body">
          <h3 className="card-title">Record Your Video Testimonial</h3>
          <p className="text-muted mb-0">
            Hi {customerName}! Please share your experience with our {jobTitle} service.
          </p>
        </div>
      </div>

      {/* Video Container */}
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
            {/* Loading State */}
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
                      getRoomToken()
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Recording Indicator */}
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
                  disabled={isSubmitting}
                >
                  <i className="ki-duotone ki-video-add fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    onClick={stopRecording}
                    disabled={isSubmitting}
                  >
                    <i className="ki-duotone ki-stop fs-1 me-2">
                      <span className="path1"></span>
                    </i>
                    Stop Recording
                  </button>
                  
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    onClick={submitTestimonial}
                    disabled={isSubmitting || recordingTime < 5}
                  >
                    <i className="ki-duotone ki-check fs-1 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Submit Testimonial
                  </button>
                </>
              )}
            </div>

            {/* Media Controls */}
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

      {/* Instructions */}
      <div className="card mt-4">
        <div className="card-body">
          <h5 className="card-title">Recording Tips</h5>
          <ul className="mb-0">
            <li>Make sure you're in a well-lit area</li>
            <li>Speak clearly and naturally</li>
            <li>Share specific details about your experience</li>
            <li>Keep your testimonial under {maxDuration / 60} minutes</li>
            <li>You can re-record if you're not satisfied</li>
          </ul>
        </div>
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

export default TestimonialVideoRoom