import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { VideoSession } from '../video-estimating/VideoEstimatingHub'
import { SignalWireVideoRoom } from '../../components/video/SignalWireVideoRoom'
import { SimpleSignalWireRoom } from '../../components/video/SimpleSignalWireRoom'

const VideoEstimatePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string>('')
  const [roomSession, setRoomSession] = useState<any>(null)
  
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

  const handleRoomJoined = (session: any) => {
    console.log('Room joined successfully')
    setRoomSession(session)
    
    // Check if AI is already in the room
    // The AI script should have been executed during room creation
  }

  const handleMemberJoined = (member: any) => {
    console.log('Member joined:', member)
    const memberName = member.name || ''
    
    // Check if this is the AI estimator
    if (memberName.includes('AI') || memberName.includes('Estimator') || 
        memberName.includes('Alex') || memberName === '+19999999999' ||
        member.id?.includes('ai') || member.id?.includes('script')) {
      console.log('AI Estimator has joined the session')
      setAiStatus('AI estimator Alex is now connected! Say hello and they will guide you through the inspection.')
      
      // Play a sound to indicate AI joined
      try {
        const audio = new Audio('/sounds/ai-joined.mp3')
        audio.play().catch(() => {})
      } catch {}
    }
  }

  const handleMemberLeft = (member: any) => {
    console.log('Member left:', member)
    const memberName = member.name || ''
    
    if (memberName.includes('AI') || memberName.includes('Estimator') || memberName.includes('Alex')) {
      setAiStatus('AI estimator has left the session')
    }
  }

  const handleError = (error: any) => {
    console.error('Video room error:', error)
    setError(`Video error: ${error.message || 'Connection failed'}`)
  }
  
  const handleAddAI = async () => {
    if (!session) return
    
    try {
      console.log('Manually adding AI to room:', session.room_id)
      const { data: aiResult } = await supabase.functions.invoke('add-ai-to-video-room', {
        body: {
          room_name: session.room_id,
          session_id: session.id,
          trade_type: session.trade_type
        }
      })
      
      if (aiResult?.success) {
        setAiStatus('AI estimator has been invited to the room')
      } else {
        setAiStatus(`Failed to add AI: ${aiResult?.error || 'Unknown error'}`)
      }
    } catch (error: any) {
      console.error('Error adding AI:', error)
      setAiStatus(`Error: ${error.message}`)
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
            <h3 className='mb-0'>Video Estimate Session</h3>
            <span className='text-muted'>
              {session?.trade_type} Inspection
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
      
      {/* Video Room - Using Simple Component for Testing */}
      <div className='flex-grow-1 position-relative'>
        <SimpleSignalWireRoom
          token={swToken}
          onRoomJoined={() => {
            console.log('Room joined successfully')
            setAiStatus('Connected to room. Waiting for AI estimator...')
          }}
          onMemberJoined={handleMemberJoined}
          onError={handleError}
        />
        
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
              {aiStatus.includes('connected') && (
                <div className='mt-2'>
                  <small className='text-muted'>
                    Tips: Use your rear camera for best results. Ensure good lighting. Show problem areas clearly.
                  </small>
                </div>
              )}
              {!aiStatus.includes('connected') && !aiStatus.includes('invited') && (
                <div className='mt-2'>
                  <button 
                    className='btn btn-sm btn-primary'
                    onClick={handleAddAI}
                  >
                    Add AI Estimator to Room
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