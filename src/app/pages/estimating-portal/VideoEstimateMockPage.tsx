import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { VideoSession } from '../video-estimating/VideoEstimatingHub'

const VideoEstimateMockPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const sessionId = searchParams.get('session')
  const token = searchParams.get('token')
  
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
      
      // Verify session exists and token matches
      const { data, error: sessionError } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()
        
      if (sessionError || !data) {
        throw new Error('Session not found')
      }
      
      // Basic token validation (room_id encoded in base64)
      const expectedToken = btoa(data.room_id)
      if (token !== expectedToken) {
        throw new Error('Invalid session token')
      }
      
      if (data.status === 'completed') {
        throw new Error('This session has already ended')
      }
      
      setSession(data)
      
      // Simulate connection after 2 seconds
      setTimeout(() => {
        setIsConnected(true)
      }, 2000)
      
    } catch (err: any) {
      console.error('Error loading session:', err)
      setError(err.message || 'Failed to load session')
    } finally {
      setLoading(false)
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
            <h3 className='mb-0'>Video Estimate Session (Mock)</h3>
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
      
      {/* Mock Video Container */}
      <div className='position-relative' style={{ height: 'calc(100vh - 70px)' }}>
        {isConnected ? (
          <div className='h-100 d-flex align-items-center justify-content-center bg-dark text-white'>
            <div className='text-center'>
              <div className='mb-4'>
                <i className='ki-duotone ki-camera fs-5x'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
              </div>
              <h3>Mock Video Stream Active</h3>
              <p className='text-muted'>
                This is a mock session for testing without SignalWire
              </p>
              <div className='mt-4'>
                <button className='btn btn-light-primary me-2'>
                  <i className='ki-duotone ki-microphone fs-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Mute
                </button>
                <button className='btn btn-light-primary'>
                  <i className='ki-duotone ki-video-camera fs-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Stop Video
                </button>
              </div>
            </div>
          </div>
        ) : (
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
              Please have good lighting and point your camera at the areas as directed.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoEstimateMockPage