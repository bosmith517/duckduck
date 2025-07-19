import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'
import { Video } from '@signalwire/js'

interface EstimateSession {
  id: string
  trade_type: string
  room_id: string
  room_url: string
  status: string
  metadata: any
}

export const CustomerVideoEstimatePortal: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<EstimateSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [capturedIssues, setCapturedIssues] = useState<any[]>([])
  const [aiStatus, setAiStatus] = useState<'waiting' | 'ready' | 'analyzing'>('waiting')
  
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)

  // Inspection steps guide
  const inspectionSteps = [
    { 
      title: 'Welcome', 
      description: 'Meet Alex, your AI estimator',
      icon: 'ki-user-tick'
    },
    { 
      title: 'Show Overview', 
      description: 'Pan your camera around the general area',
      icon: 'ki-scan-barcode'
    },
    { 
      title: 'Focus on Issues', 
      description: 'Show specific problems or damage',
      icon: 'ki-magnifier'
    },
    { 
      title: 'Additional Areas', 
      description: 'Show any other areas of concern',
      icon: 'ki-picture'
    },
    { 
      title: 'Complete', 
      description: 'Review and finish your estimate',
      icon: 'ki-check-circle'
    }
  ]

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

      if (error) throw error
      
      if (!data) {
        showToast.error('Session not found')
        navigate('/')
        return
      }

      if (data.status === 'completed') {
        showToast.info('This session has already been completed')
        navigate('/')
        return
      }

      setSession(data)
    } catch (error) {
      console.error('Error loading session:', error)
      showToast.error('Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  const startVideoSession = async () => {
    if (!session) return

    try {
      setIsConnecting(true)

      // Create room and token using our working REST API approach
      const roomName = `customer_${session.id}_${Date.now()}`
      
      // Use the working SignalWire REST API pattern
      const { data: roomData, error: roomError } = await supabase.functions.invoke('create-signalwire-room', {
        body: {
          room_name: roomName,
          customer_name: session.metadata?.customer_info?.name || 'Customer',
          session_id: session.id
        }
      })

      if (roomError) throw roomError

      // Initialize SignalWire room using our proven approach
      const roomSession = new Video.RoomSession({
        token: roomData.token,
        rootElement: videoContainerRef.current,
        logLevel: 'debug' // Keep debug logging for troubleshooting
      })

      roomSessionRef.current = roomSession

      // Set up event listeners using our working pattern
      roomSession.on('room.joined', (params: any) => {
        console.log('🎉 Customer joined room successfully:', params)
        setIsConnected(true)
        setIsConnecting(false)
        setCurrentStep(1)
        setAiStatus('ready')
        showToast.success('Connected! Alex will guide you through the inspection.')
      })

      roomSession.on('member.joined', (e: any) => {
        console.log('Member joined:', e.member.name)
        if (e.member.name.includes('Alex') || e.member.name.includes('AI')) {
          setAiStatus('ready')
          showToast.info('Alex has joined the session')
        }
      })

      roomSession.on('room.left', (params: any) => {
        console.log('Left room')
        setIsConnected(false)
        if (params?.error) {
          console.error('Room left with error:', params.error)
        }
      })

      // @ts-ignore - deprecated event
      roomSession.on('error', (error: any) => {
        console.error('Room session error:', error)
        // Don't immediately show error - let the room try to recover
        if (error.message?.includes('setRemoteDescription') || error.message?.includes('wrong state')) {
          console.log('Ignoring SDP renegotiation error - this is expected')
          return
        }
        showToast.error(`Connection error: ${error.message}`)
      })

      // Join the room using our proven approach
      console.log('Joining room with customer-optimized settings...')
      await roomSession.join()

      // Subscribe to AI analysis updates via real-time
      const channel = supabase
        .channel(`session-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'vision_results',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            console.log('New vision result:', payload)
            handleVisionResult(payload.new)
          }
        )
        .subscribe()

    } catch (error: any) {
      console.error('Error starting video session:', error)
      setIsConnecting(false)
      
      if (error.name === 'NotAllowedError') {
        showToast.error('Camera/microphone access denied. Please allow access and try again.')
      } else if (error.message?.includes('Invalid arguments')) {
        showToast.error('Room setup error. Please contact support.')
      } else {
        showToast.error('Failed to start video session. This may take up to 45 seconds to connect.')
      }
    }
  }

  const handleVisionResult = (result: any) => {
    setAiStatus('analyzing')
    
    // Add to captured issues if it's an issue
    if (result.analysis_type === 'issue_detected') {
      setCapturedIssues(prev => [...prev, {
        id: result.id,
        timestamp: result.timestamp,
        frame_url: result.frame_url,
        description: result.description,
        severity: result.metadata?.severity || 'moderate',
        location: result.metadata?.location || 'Unknown'
      }])
      
      showToast.info(`Issue detected: ${result.description}`)
    }

    // Progress through steps based on AI feedback
    if (result.metadata?.next_step) {
      const nextStepIndex = inspectionSteps.findIndex(s => 
        s.title.toLowerCase().includes(result.metadata.next_step.toLowerCase())
      )
      if (nextStepIndex > currentStep) {
        setCurrentStep(nextStepIndex)
      }
    }

    setTimeout(() => setAiStatus('ready'), 2000)
  }

  const endSession = async () => {
    try {
      // Leave the room
      if (roomSessionRef.current) {
        await roomSessionRef.current.leave()
      }

      // Update session status
      await supabase
        .from('video_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      showToast.success('Inspection completed! You will receive your detailed estimate within 24 hours.')
      navigate('/customer-portal/thank-you')
    } catch (error) {
      console.error('Error ending session:', error)
      showToast.error('Failed to end session properly')
    }
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-center">
          <h3>Session Not Found</h3>
          <p>Please check your link and try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <div className="bg-white shadow-sm mb-4">
        <div className="container-fluid py-3">
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">
              <i className={`ki-duotone ki-${session.trade_type.toLowerCase()} fs-2 text-primary me-2`}>
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              {session.trade_type} Video Estimate
            </h4>
            {isConnected && (
              <button
                className="btn btn-danger btn-sm"
                onClick={endSession}
              >
                End Session
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container-fluid">
        <div className="row g-4">
          {/* Main Video Area */}
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-body p-0">
                {!isConnected ? (
                  <div className="text-center py-10">
                    <i className="ki-duotone ki-video-camera fs-5x text-primary mb-5">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <h3>Ready to Start Your Video Estimate?</h3>
                    <p className="text-muted mb-5">
                      Our AI assistant Alex will guide you through showing the areas that need service.
                    </p>
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={startVideoSession}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <i className="ki-duotone ki-play fs-3 me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Start Video Estimate
                        </>
                      )}
                    </button>
                    
                    <div className="mt-6">
                      <h5>Tips for Best Results:</h5>
                      <ul className="text-start text-muted">
                        <li>Use your phone's rear camera for better quality</li>
                        <li>Ensure good lighting in the areas you're showing</li>
                        <li>Move slowly and steadily when panning</li>
                        <li>Get close-up shots of specific issues</li>
                        <li>Follow Alex's verbal instructions</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div 
                    ref={videoContainerRef} 
                    className="video-container position-relative"
                    style={{ minHeight: '500px', backgroundColor: '#000' }}
                  >
                    {/* AI Status Overlay */}
                    <div className="position-absolute top-0 start-0 m-3">
                      <div className={`badge badge-lg ${
                        aiStatus === 'ready' ? 'badge-success' : 
                        aiStatus === 'analyzing' ? 'badge-warning' : 
                        'badge-secondary'
                      }`}>
                        {aiStatus === 'ready' && '🟢 Alex is watching'}
                        {aiStatus === 'analyzing' && '🔍 Analyzing...'}
                        {aiStatus === 'waiting' && '⏳ Connecting to Alex...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Captured Issues */}
            {capturedIssues.length > 0 && (
              <div className="card shadow-sm mt-4">
                <div className="card-header">
                  <h5 className="card-title mb-0">Issues Detected ({capturedIssues.length})</h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {capturedIssues.map((issue, index) => (
                      <div key={issue.id} className="col-md-6">
                        <div className="d-flex align-items-start">
                          <div className="symbol symbol-50px me-3">
                            <img src={issue.frame_url} alt={`Issue ${index + 1}`} className="rounded" />
                          </div>
                          <div className="flex-grow-1">
                            <h6 className="mb-1">{issue.location}</h6>
                            <p className="text-muted small mb-1">{issue.description}</p>
                            <span className={`badge badge-sm ${
                              issue.severity === 'critical' ? 'badge-danger' :
                              issue.severity === 'major' ? 'badge-warning' :
                              'badge-info'
                            }`}>
                              {issue.severity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Sidebar */}
          <div className="col-lg-4">
            <div className="card shadow-sm">
              <div className="card-header">
                <h5 className="card-title mb-0">Inspection Progress</h5>
              </div>
              <div className="card-body">
                <div className="timeline">
                  {inspectionSteps.map((step, index) => (
                    <div key={index} className={`timeline-item ${index <= currentStep ? 'active' : ''}`}>
                      <div className="timeline-line"></div>
                      <div className="timeline-icon">
                        <i className={`ki-duotone ${step.icon} fs-2 ${
                          index < currentStep ? 'text-success' :
                          index === currentStep ? 'text-primary' :
                          'text-gray-400'
                        }`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                      <div className="timeline-content">
                        <h6 className={`fw-bold ${
                          index <= currentStep ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {step.title}
                        </h6>
                        <p className="text-muted small mb-0">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Assistant Card */}
            <div className="card shadow-sm mt-4">
              <div className="card-body text-center">
                <div className="symbol symbol-100px symbol-circle mb-4">
                  <div className="symbol-label bg-light-primary">
                    <i className="ki-duotone ki-user-tick fs-2x text-primary">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </div>
                </div>
                <h5>Meet Alex</h5>
                <p className="text-muted">
                  Your AI estimation assistant is analyzing everything you show in real-time to create an accurate estimate.
                </p>
                <div className="d-flex justify-content-center gap-4 mt-4">
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-primary">{capturedIssues.length}</div>
                    <div className="text-muted small">Issues Found</div>
                  </div>
                  <div className="text-center">
                    <div className="fs-2 fw-bold text-success">
                      {Math.round((currentStep / (inspectionSteps.length - 1)) * 100)}%
                    </div>
                    <div className="text-muted small">Complete</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .timeline {
          position: relative;
          padding-left: 30px;
        }
        
        .timeline-item {
          position: relative;
          padding-bottom: 30px;
        }
        
        .timeline-item:last-child {
          padding-bottom: 0;
        }
        
        .timeline-line {
          position: absolute;
          left: -20px;
          top: 30px;
          bottom: 0;
          width: 2px;
          background: #e4e6ef;
        }
        
        .timeline-item:last-child .timeline-line {
          display: none;
        }
        
        .timeline-item.active .timeline-line {
          background: #3B82F6;
        }
        
        .timeline-icon {
          position: absolute;
          left: -30px;
          top: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: white;
          border: 2px solid #e4e6ef;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .timeline-item.active .timeline-icon {
          border-color: #3B82F6;
        }
        
        .video-container video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </div>
  )
}