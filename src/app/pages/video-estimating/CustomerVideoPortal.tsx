import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
// Using any type for SignalWire RoomSession until proper types are available
declare const RoomSession: any
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface SessionData {
  id: string
  trade_type: string
  status: string
  room_id: string
  scheduled_at: string
  notes?: string
}

const CustomerVideoPortal: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [session, setSession] = useState<SessionData | null>(null)
  const [roomSession, setRoomSession] = useState<any | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentPrompt, setCurrentPrompt] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [showNameForm, setShowNameForm] = useState(true)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        console.error('Session not found:', error)
        showToast.error('Video session not found')
        return
      }

      setSession(data)
    } catch (error) {
      console.error('Error loading session:', error)
      showToast.error('Failed to load video session')
    }
  }

  const joinSession = async () => {
    if (!token || !session || !customerName.trim()) {
      showToast.error('Please enter your name to join')
      return
    }

    try {
      setIsConnecting(true)

      // Initialize SignalWire room with customer token
      const room = new RoomSession({
        token: token,
        rootElement: videoContainerRef.current,
        userName: customerName,
        iceServers: []
      })

      // Set up event handlers
      room.on('room.started', () => {
        setIsConnected(true)
        setIsConnecting(false)
        showToast.success('Connected! Your contractor will guide you through the process.')
        
        // Update session status
        updateSessionStatus('active')
      })

      room.on('room.ended', () => {
        setIsConnected(false)
        showToast.info('Video session ended')
      })

      room.on('member.joined', (e: any) => {
        if (e.member.name !== customerName) {
          showToast.info(`${e.member.name} joined the session`)
        }
      })

      room.on('member.left', (e: any) => {
        if (e.member.name !== customerName) {
          showToast.info(`${e.member.name} left the session`)
        }
      })

      // Listen for prompts from the estimator
      room.on('layout.changed', (e: any) => {
        if (e.layout?.prompt) {
          setCurrentPrompt(e.layout.prompt)
        }
      })

      // Join the room
      await room.join()
      setRoomSession(room)
      setShowNameForm(false)
    } catch (error) {
      console.error('Error joining session:', error)
      showToast.error('Failed to connect to video session')
      setIsConnecting(false)
    }
  }

  const updateSessionStatus = async (status: string) => {
    try {
      await supabase
        .from('video_sessions')
        .update({
          status,
          started_at: status === 'active' ? new Date().toISOString() : undefined
        })
        .eq('id', sessionId)
    } catch (error) {
      console.error('Error updating session status:', error)
    }
  }

  const leaveSession = async () => {
    if (roomSession) {
      await roomSession.leave()
      setRoomSession(null)
      setIsConnected(false)
    }
  }

  const getTradeInstructions = (tradeType: string) => {
    const instructions: Record<string, string> = {
      'ROOFING': 'We\'ll be looking at your roof condition, materials, and any areas of concern. Please be prepared to go outside safely.',
      'PLUMBING': 'We\'ll examine your plumbing issue and related fixtures. Please have the affected area accessible.',
      'HVAC': 'We\'ll check your heating and cooling system components. Please ensure access to your thermostat and outdoor unit.',
      'ELECTRICAL': 'We\'ll assess your electrical issue and panel. Please ensure the area is well-lit and accessible.'
    }
    return instructions[tradeType] || 'We\'ll guide you through showing us the areas that need attention.'
  }

  if (!session) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-light'>
        <div className='text-center'>
          <div className='spinner-border text-primary mb-3' role='status'>
            <span className='visually-hidden'>Loading...</span>
          </div>
          <div>Loading video session...</div>
        </div>
      </div>
    )
  }

  if (showNameForm && !isConnected) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-light'>
        <div className='card w-100 max-w-md mx-3'>
          <div className='card-body p-8'>
            <div className='text-center mb-6'>
              <h1 className='h3 mb-2'>Video Estimate Session</h1>
              <p className='text-muted'>
                {session.trade_type} - Scheduled for {new Date(session.scheduled_at).toLocaleString()}
              </p>
            </div>

            <div className='alert alert-info mb-6'>
              <div className='d-flex align-items-start'>
                <i className='ki-duotone ki-information fs-2 me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <div>
                  <strong>What to expect:</strong><br />
                  {getTradeInstructions(session.trade_type)}
                </div>
              </div>
            </div>

            <div className='mb-6'>
              <label className='form-label fw-bold'>Your Name</label>
              <input
                type='text'
                className='form-control form-control-lg'
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder='Enter your name'
                onKeyPress={(e) => e.key === 'Enter' && joinSession()}
                autoFocus
              />
            </div>

            <button
              className='btn btn-primary btn-lg w-100'
              onClick={joinSession}
              disabled={isConnecting || !customerName.trim()}
            >
              {isConnecting ? (
                <>
                  <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                  Connecting...
                </>
              ) : (
                <>
                  <i className='ki-duotone ki-video fs-2 me-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Join Video Session
                </>
              )}
            </button>

            {session.notes && (
              <div className='mt-6 p-4 bg-light rounded'>
                <h6 className='mb-2'>Session Notes:</h6>
                <p className='text-muted mb-0'>{session.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-vh-100 d-flex flex-column bg-dark'>
      {/* Header */}
      <div className='bg-white border-bottom px-4 py-3'>
        <div className='d-flex justify-content-between align-items-center'>
          <div>
            <h4 className='mb-0'>Video Estimate - {session.trade_type}</h4>
            <span className='text-muted'>Connected as {customerName}</span>
          </div>
          <button
            className='btn btn-danger'
            onClick={leaveSession}
          >
            <i className='ki-duotone ki-cross-circle fs-2 me-1'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            Leave Session
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className='flex-grow-1 position-relative'>
        <div
          ref={videoContainerRef}
          className='h-100 w-100'
          style={{ minHeight: '500px' }}
        />
        
        {!isConnected && isConnecting && (
          <div className='position-absolute top-50 start-50 translate-middle text-center'>
            <div className='spinner-border text-light mb-3' role='status'>
              <span className='visually-hidden'>Connecting...</span>
            </div>
            <div className='text-light'>Connecting to video session...</div>
          </div>
        )}

        {/* Current Prompt Overlay */}
        {currentPrompt && isConnected && (
          <div className='position-absolute bottom-0 start-0 end-0 p-4'>
            <div className='bg-white bg-opacity-95 rounded-lg p-4 shadow-lg mx-auto' style={{ maxWidth: '600px' }}>
              <div className='d-flex align-items-start'>
                <i className='ki-duotone ki-message-text-2 fs-1 me-3 text-primary'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <div>
                  <h5 className='mb-2 text-primary'>Instructions:</h5>
                  <p className='mb-0 fs-5'>{currentPrompt}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className='bg-white border-top px-4 py-2'>
        <div className='d-flex justify-content-between align-items-center'>
          <div className='d-flex align-items-center gap-3'>
            <span className={`badge badge-${isConnected ? 'success' : 'warning'}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
            <span className='text-muted'>
              Session: {session.id.slice(-8)}
            </span>
          </div>
          
          <div className='d-flex align-items-center gap-2'>
            <i className='ki-duotone ki-shield-tick fs-2 text-success'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
            <span className='text-muted small'>Secure Connection</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerVideoPortal