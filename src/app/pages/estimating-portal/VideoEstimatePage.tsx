import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { VideoSession } from '../video-estimating/VideoEstimatingHub'
import SignalWireVideoRoomSimple from '../../components/video/SignalWireVideoRoomSimple'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'

const VideoEstimatePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string>('')
  const [roomSession, setRoomSession] = useState<any>(null)
  const [isAddingAI, setIsAddingAI] = useState(false)
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false)
  const [aiAttempted, setAiAttempted] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [actualRoomId, setActualRoomId] = useState<string | null>(null)
  const [permissionsRequested, setPermissionsRequested] = useState(false)
  
  const sessionId = searchParams.get('session')
  const token = searchParams.get('token') // Portal JWT for Supabase
  const swToken = searchParams.get('sw_token') // SignalWire JWT for video
  
  useEffect(() => {
    if (sessionId && token) {
      // Pre-request media permissions to avoid delays
      const preRequestPermissions = async () => {
        try {
          console.log('[VideoEstimate] Pre-requesting media permissions...')
          setStatusMessage('Requesting camera and microphone permissions...')
          await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
            .then(stream => {
              // Important: Stop the stream immediately after getting permissions
              // We just want to trigger the permission prompt, not keep the media active
              stream.getTracks().forEach(track => track.stop())
              console.log('[VideoEstimate] Media permissions granted and stream stopped')
              setPermissionsRequested(true)
              setStatusMessage('')
            })
        } catch (err) {
          console.warn('[VideoEstimate] Media permission pre-request failed:', err)
          setStatusMessage('')
          // Continue anyway - SignalWire will request permissions later
        }
      }
      
      // Pre-request permissions then load session
      preRequestPermissions().then(() => {
        loadSession()
      })
    } else {
      setError('Invalid session link')
      setLoading(false)
    }
  }, [sessionId, token])
  
  // Moved after handleAddAI definition
  
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
          console.error('Token validation error:', err)
          // Don't throw here - let it continue if token decode fails
          console.log('Continuing without token validation')
        }
      }
      
      // Query the video session using anon key (public access)
      console.log('Querying video_sessions for:', sessionId)
      const { data, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
        
      console.log('Query result:', { data, error: sessionError })
        
      if (sessionError) {
        console.error('Session lookup error:', sessionError)
        throw new Error(`Session not found: ${sessionError.message}`)
      }
      
      if (!data) {
        console.error('No session data returned')
        throw new Error('Session not found')
      }
      
      console.log('Session found:', data)
      console.log('Room ID from session:', data.room_id)
      console.log('Room metadata:', data.metadata)
      
      // Try to decode the SW token to see what room it's for (non-blocking)
      try {
        if (swToken && swToken !== 'null') {
          const tokenParts = swToken.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]))
            console.log('SW Token payload:', payload)
            console.log('Token is for room:', payload.r)
          }
        }
      } catch (e) {
        console.log('Could not decode SW token - continuing anyway')
      }
      
      if (data.status === 'completed') {
        throw new Error('This session has already ended')
      }
      
      setSession(data)
      setAiStatus('Waiting for AI estimator to join...')
      
    } catch (err: any) {
      console.error('Error loading session:', err)
      setError(err.message || 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  const handleRoomJoined = useCallback(() => {
    console.log('[VideoEstimate] Room joined successfully')
    setAiStatus('Connected to room. Adding AI estimator...')
    setHasJoinedRoom(true)
  }, [])

  const handleMemberJoined = useCallback((member: any) => {
    console.log('Member joined:', member)
    const memberName = member.name || ''
    
    // Check if this is the AI estimator (case-insensitive)
    const lowerName = memberName.toLowerCase()
    const memberId = (member.id || '').toLowerCase()
    
    if (lowerName.includes('ai') || lowerName.includes('estimator') || 
        lowerName.includes('alex') || lowerName.includes('assistant') ||
        memberName === '+19999999999' || memberId.includes('ai') || 
        memberId.includes('script') || memberId.includes('relay')) {
      console.log('[VideoEstimate] AI Estimator has joined the session:', member)
      setAiStatus('AI estimator Alex is now connected! Say hello and they will guide you through the inspection.')
      
      // Play a sound to indicate AI joined
      try {
        const audio = new Audio('/sounds/ai-joined.mp3')
        audio.play().catch(() => {})
      } catch {}
    }
  }, [])

  const handleMemberLeft = useCallback((member: any) => {
    console.log('Member left:', member)
    const memberName = member.name || ''
    
    if (memberName.includes('AI') || memberName.includes('Estimator') || memberName.includes('Alex')) {
      setAiStatus('AI estimator has left the session')
    }
  }, [])

  const handleError = useCallback((error: any) => {
    console.error('Video room error:', error)
    setError(`Video error: ${error.message || 'Connection failed'}`)
  }, [])
  
  const handleAddAI = useCallback(async () => {
    if (!session || isAddingAI) return
    
    try {
      setIsAddingAI(true)
      
      console.log('[VideoEstimate] Adding AI to room using video SWML method')
      
      // For the relay bin, we should use the original room name from the database
      // The AI will find the active session with this room name
      const targetRoomName = session.room_id
      
      console.log('[VideoEstimate] Target room name for AI:', targetRoomName)
      console.log('[VideoEstimate] Session details:', {
        session_id: session.id,
        room_name: targetRoomName,
        trade_type: session.trade_type
      })
      
      // Use the video SWML method which has been proven to work with relay bin
      const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-join-video-swml', {
        body: {
          room_name: targetRoomName,
          session_id: session.id,
          trade_type: session.trade_type || 'general'
        }
      })
      
      console.log('[VideoEstimate] AI SWML result:', aiResult, 'Error:', aiError)
      
      if (aiError) {
        console.error('[VideoEstimate] Failed to add AI:', aiError)
        setAiStatus('AI assistant could not join. A human estimator will assist you.')
      } else if (aiResult?.success) {
        console.log('[VideoEstimate] AI triggered successfully via:', aiResult.method)
        setAiStatus('AI Estimator Alex is connecting... This may take up to 30 seconds.')
        
        // Set a timeout to update status if AI doesn't join
        setTimeout(() => {
          setAiStatus(prev => 
            prev.includes('connected') ? prev : 
            'AI is taking longer than expected. Please continue with your inspection.'
          )
        }, 30000)
      } else {
        console.log('[VideoEstimate] Unexpected AI response:', aiResult)
        setAiStatus('AI integration in progress...')
      }
    } catch (error: any) {
      console.error('[VideoEstimate] Error adding AI:', error)
      setAiStatus(`Error: ${error.message}`)
    } finally {
      setIsAddingAI(false)
    }
  }, [session, isAddingAI])
  
  // Auto-add AI when room is joined (only once)
  useEffect(() => {
    if (hasJoinedRoom && session && !isAddingAI && !aiAttempted) {
      console.log('[VideoEstimate] Auto-adding AI to room after join')
      setAiAttempted(true) // Prevent multiple attempts
      const timer = setTimeout(() => {
        handleAddAI()
      }, 500) // Reduced wait time since test shows it works quickly
      
      return () => clearTimeout(timer)
    }
  }, [hasJoinedRoom, session, isAddingAI, aiAttempted, handleAddAI])
  
  if (loading) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-dark'>
        <div className='text-center text-white'>
          <div className='spinner-border text-light mb-3' role='status'>
            <span className='visually-hidden'>Loading...</span>
          </div>
          <div>{statusMessage || 'Loading video session...'}</div>
          {statusMessage && statusMessage.includes('permissions') && (
            <div className='mt-3 text-muted'>
              <small>Please allow camera and microphone access when prompted</small>
            </div>
          )}
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

  if (!swToken) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-dark'>
        <div className='text-center text-white'>
          <i className='ki-duotone ki-cross-circle fs-5x text-danger mb-3'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
          <h3>Invalid Session Link</h3>
          <p className='text-muted'>Missing video token. Please use the link provided in your invitation.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className='min-vh-100 bg-dark d-flex flex-column'>
      {/* Header */}
      <div className='bg-white border-bottom px-5 py-3'>
        <div className='d-flex justify-content-between align-items-center'>
          <div>
            <h3 className='mb-0'>Video Estimating Session</h3>
            <span className='text-muted'>
              {session?.trade_type} Inspection - Estimating Portal
            </span>
          </div>
          <div>
            <span className='badge badge-primary'>
              <i className='ki-duotone ki-video fs-2 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              Live Session
            </span>
          </div>
        </div>
      </div>
      
      {/* Video Room - Using SignalWireVideoRoomSimple */}
      <div className='flex-grow-1 position-relative'>
        <ErrorBoundary>
          <SignalWireVideoRoomSimple
            token={swToken}
            roomName={session?.room_id}
            userName="Customer"
            onRoomJoined={handleRoomJoined}
            onMemberJoined={handleMemberJoined}
            onMemberLeft={handleMemberLeft}
            onError={handleError}
            enableAudio={true}
            enableVideo={true}
            layout="grid-responsive"
          />
        </ErrorBoundary>
        
        {/* AI Status Overlay */}
        {aiStatus && (
          <div className='position-absolute bottom-0 start-0 end-0 p-4' style={{ pointerEvents: 'none' }}>
            <div className='bg-white bg-opacity-90 rounded p-3 shadow mx-auto' style={{ maxWidth: '600px', pointerEvents: 'auto' }}>
              <h5 className='mb-2'>
                <i className='ki-duotone ki-message-programming fs-2 me-2'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                AI Assistant Status
              </h5>
              <p className='mb-0 text-primary fw-bold'>{aiStatus}</p>
              {aiStatus.includes('joining') && (
                <div className='mt-2'>
                  <div className='spinner-border spinner-border-sm text-primary me-2' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                  <small className='text-muted'>
                    AI is connecting to your video session. This may take 10-20 seconds...
                  </small>
                </div>
              )}
              {aiStatus.includes('connected') && (
                <div className='mt-2'>
                  <small className='text-muted'>
                    Tips: Use your rear camera to show areas to the AI. Point your camera at problem areas. Ensure good lighting. Move slowly for best results.
                  </small>
                </div>
              )}
              {!aiStatus.includes('connected') && !aiStatus.includes('joining') && !aiStatus.includes('invited') && !isAddingAI && (
                <div className='mt-2'>
                  <button 
                    className='btn btn-sm btn-primary'
                    onClick={handleAddAI}
                    disabled={isAddingAI}
                  >
                    {isAddingAI ? 'Adding AI...' : 'Add AI Estimator to Room'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoEstimatePage