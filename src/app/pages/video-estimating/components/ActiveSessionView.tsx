import React, {useState, useEffect, useRef} from 'react'
import {VideoSession} from '../VideoEstimatingHub'
import {supabase} from '../../../../supabaseClient'
import {showToast} from '../../../utils/toast'
import {VisionResultsPanel} from './VisionResultsPanel'
import {GuidedPromptsPanel} from './GuidedPromptsPanel'
import {Video} from '@signalwire/js'                 // ✅ static import only

interface ActiveSessionViewProps {
  session: VideoSession
  onEnd: () => void
}

export const ActiveSessionView: React.FC<ActiveSessionViewProps> = ({
  session,
  onEnd
}) => {
  const [isConnected, setIsConnected] = useState(false)
  const [visionResults, setVisionResults] = useState<any[]>([])
  const [currentPrompt, setCurrentPrompt] = useState<string>('')
  const [capturedFrames, setCapturedFrames] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [useMockMode, setUseMockMode] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  console.log('ActiveSessionView version: 2024-01-13-v11-CLEAN-FINAL')  // ✅

  useEffect(() => {
    initializeSession()
    return () => {
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current)
      if ((window as any).localStream) {
        (window as any).localStream.getTracks().forEach((t: MediaStreamTrack) => t.stop())
        delete (window as any).localStream
      }
      if ((window as any).currentRoomSession) {
        try { (window as any).currentRoomSession.leave() } catch {}
        delete (window as any).currentRoomSession
      }
    }
  }, [session])

  const initializeSession = async () => {
    try {
      if (useMockMode) {
        await new Promise(r => setTimeout(r, 1500))
        setIsConnected(true)
        await updateSessionStatus('active')
        startVisionProcessing()
        showToast.success('Connected to video session (Development Mode)')
      } else {
        const {data: tokenData, error: tokenError} = await supabase
          .functions.invoke('generate-room-token', {
            body: {
              room_id: session.room_id,
              user_name: 'Estimator',
              permissions: [
                'room.self.audio_mute',
                'room.self.audio_unmute',
                'room.self.video_mute',
                'room.self.video_unmute'
              ]
            }
          })

        if (tokenError) throw tokenError
        if (!tokenData?.token) throw new Error('No token received from server')

        await initializeSignalWire(tokenData.token)
      }
    } catch (error) {
      console.error('Error initializing session:', error)
      showToast.error('Failed to connect to video session')
    }
  }

  const initializeSignalWire = async (token: string) => {
    try {
      console.log('Requesting media permissions.')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 1280}, height: {ideal: 720}},
        audio: {echoCancellation: true, noiseSuppression: true}
      })
      ;(window as any).localStream = stream

      console.log('Creating RoomSession')
      const roomSession = new Video.RoomSession({
        token,
        rootElement: videoContainerRef.current
      })

      ;(window as any).currentRoomSession = roomSession

      roomSession.on('room.joined', async () => {
        setIsConnected(true)
        await updateSessionStatus('active')
        showToast.success('Connected to video session')
      })

      roomSession.on('room.left', (params: any) => {
        setIsConnected(false)
        if (params?.error) {
          showToast.error(params.error.message || 'Video error')
        }
      })

      await roomSession.join()
    } catch (mediaError: any) {
      console.error('Media/SignalWire error:', mediaError)
      
      // Handle media errors gracefully
      if (mediaError.name === 'NotFoundError') {
        showToast.warning('No camera/microphone found. Continuing in viewer mode.')
        console.log('Continuing without media stream...')
        
        // Continue with SignalWire connection without media
        try {
          console.log('Creating RoomSession without media')
          const roomSession = new Video.RoomSession({
            token,
            rootElement: videoContainerRef.current,
            audio: false,
            video: false
          })

          ;(window as any).currentRoomSession = roomSession

          roomSession.on('room.joined', async () => {
            setIsConnected(true)
            await updateSessionStatus('active')
            showToast.success('Connected to video session (viewer mode)')
          })

          roomSession.on('room.left', (params: any) => {
            setIsConnected(false)
            if (params?.error) {
              showToast.error(params.error.message || 'Video error')
            }
          })

          await roomSession.join()
        } catch (roomError: any) {
          console.error('Room connection error:', roomError)
          showToast.error('Failed to connect to video session')
        }
      } else {
        showToast.error(mediaError.message || 'SignalWire error')
      }
    }
  }

  const startVisionProcessing = () => {
    // Mock vision processing for development
    const frameInterval = setInterval(async () => {
      if (!isProcessing && isConnected) {
        setIsProcessing(true)
        
        try {
          // Simulate frame capture and processing
          const mockFrame = `/api/placeholder/640/480?text=Frame+${Date.now()}`
          
          // Add to captured frames
          setCapturedFrames(prev => [...prev.slice(-3), mockFrame])
          
          // Simulate AI detection (30% chance of finding something)
          if (Math.random() > 0.7) {
            const mockResult = {
              id: `result_${Date.now()}`,
              timestamp: new Date().toISOString(),
              objects: getMockDetections(session.trade_type),
              trade_insights: getMockTradeInsights(session.trade_type)
            }
            
            setVisionResults(prev => [...prev, mockResult])
            
            // Update prompt occasionally
            if (Math.random() > 0.5) {
              setCurrentPrompt(getNextPrompt(session.trade_type))
            }
          }
        } catch (error) {
          console.error('Vision processing error:', error)
        } finally {
          setIsProcessing(false)
        }
      }
    }, 2000) // Slower for mock mode

    processingIntervalRef.current = frameInterval
  }

  const getMockDetections = (tradeType: string) => {
    const detections: any = {
      ROOFING: [
        { type: 'missing_shingles', confidence: 0.85, attributes: { location: 'north_slope', severity: 'moderate' } },
        { type: 'moss_growth', confidence: 0.92, attributes: { location: 'shaded_area', severity: 'minor' } }
      ],
      PLUMBING: [
        { type: 'leak_stain', confidence: 0.78, attributes: { location: 'under_sink', severity: 'minor' } },
        { type: 'corrosion', confidence: 0.88, attributes: { location: 'shut_off_valve', severity: 'moderate' } }
      ],
      HVAC: [
        { type: 'dirty_filter', confidence: 0.95, attributes: { location: 'return_vent', severity: 'minor' } },
        { type: 'rust', confidence: 0.82, attributes: { location: 'outdoor_unit', severity: 'moderate' } }
      ],
      ELECTRICAL: [
        { type: 'outdated_outlet', confidence: 0.90, attributes: { location: 'kitchen', severity: 'minor' } },
        { type: 'missing_gfci', confidence: 0.94, attributes: { location: 'bathroom', severity: 'major' } }
      ]
    }
    
    return detections[tradeType] || []
  }

  const getMockTradeInsights = (tradeType: string) => {
    const insights: any = {
      ROOFING: [
        { category: 'Structural Damage', finding: 'Missing shingles on north slope require immediate attention', severity: 'warning' as const },
        { category: 'Maintenance', finding: 'Moss growth indicates poor drainage', severity: 'info' as const }
      ],
      PLUMBING: [
        { category: 'Water Damage', finding: 'Water stains under sink suggest slow leak', severity: 'warning' as const },
        { category: 'Equipment Age', finding: 'Shut-off valve corrosion indicates replacement needed', severity: 'critical' as const }
      ],
      HVAC: [
        { category: 'Efficiency', finding: 'Dirty filter reducing system efficiency by ~20%', severity: 'warning' as const },
        { category: 'Equipment Condition', finding: 'Surface rust on outdoor unit - monitor for progression', severity: 'info' as const }
      ],
      ELECTRICAL: [
        { category: 'Code Compliance', finding: 'Kitchen outlets not GFCI protected', severity: 'critical' as const },
        { category: 'Safety', finding: 'Bathroom missing GFCI protection near water sources', severity: 'critical' as const }
      ]
    }
    
    // Return 1-2 insights randomly
    const tradeInsights = insights[tradeType] || []
    const numInsights = Math.floor(Math.random() * 2) + 1
    return tradeInsights.slice(0, numInsights)
  }
  
  const getNextPrompt = (tradeType: string) => {
    const prompts: any = {
      ROOFING: [
        'Can you show me the gutters and downspouts?',
        'Please show the attic access if available',
        'Let\'s look at the chimney flashing'
      ],
      PLUMBING: [
        'Can you show me the water heater?',
        'Please check under all sinks for leaks',
        'Show me the main water shut-off valve'
      ],
      HVAC: [
        'Please show the thermostat settings',
        'Can you access the air filter?',
        'Show me the outdoor unit clearance'
      ],
      ELECTRICAL: [
        'Please show the electrical panel',
        'Check if outlets near water have GFCI',
        'Show any exposed wiring areas'
      ]
    }
    
    const tradePrompts = prompts[tradeType] || ['Please show the area of concern']
    return tradePrompts[Math.floor(Math.random() * tradePrompts.length)]
  }

  const updateSessionStatus = async (status: string) => {
    try {
      await supabase
        .from('video_sessions')
        .update({
          status,
          started_at: status === 'active' ? new Date().toISOString() : undefined,
          ended_at: status === 'completed' ? new Date().toISOString() : undefined
        })
        .eq('id', session.id)
    } catch (error) {
      console.error('Error updating session status:', error)
    }
  }

  const handleEndSession = async () => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
    }
    
    // Generate estimate if we have vision results
    if (visionResults.length > 0) {
      await generateEstimate()
    }
    
    await updateSessionStatus('completed')
    onEnd()
  }

  const generateEstimate = async () => {
    try {
      showToast.loading('Generating estimate from vision analysis...')
      
      const { data, error } = await supabase
        .functions.invoke('generate-video-estimate', {
          body: {
            session_id: session.id,
            vision_results: visionResults,
            captured_frames: capturedFrames,
            trade_type: session.trade_type
          }
        })

      if (error) throw error
      
      showToast.success('Estimate generated successfully!')
    } catch (error) {
      console.error('Error generating estimate:', error)
      showToast.error('Failed to generate estimate')
    }
  }

  const handleManualCapture = () => {
    // Mock manual capture
    const mockFrame = `/api/placeholder/640/480?text=Manual+Capture+${Date.now()}`
    setCapturedFrames(prev => [...prev.slice(-3), mockFrame])
    showToast.success('Frame captured')
    
    // Force a detection on manual capture
    const mockResult = {
      id: `manual_${Date.now()}`,
      timestamp: new Date().toISOString(),
      objects: getMockDetections(session.trade_type),
      trade_insights: getMockTradeInsights(session.trade_type)
    }
    setVisionResults(prev => [...prev, mockResult])
    setCurrentPrompt('Great! Now let\'s look at another angle.')
  }

  // Mock video element
  const MockVideoDisplay = () => (
    <div className='h-100 w-100 d-flex align-items-center justify-content-center bg-dark'>
      <div className='text-center text-white'>
        <div className='mb-4'>
          <i className='ki-duotone ki-camera fs-5x'>
            <span className='path1'></span>
            <span className='path2'></span>
          </i>
        </div>
        <h3>Mock Video Stream</h3>
        <p className='text-muted'>Development Mode - SignalWire integration pending</p>
        <div className='mt-4'>
          <span className='badge badge-light-success'>Session Active</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className='d-flex flex-column h-100'>
      {/* Header */}
      <div className='bg-white border-bottom px-5 py-3'>
        <div className='d-flex justify-content-between align-items-center'>
          <div>
            <h3 className='mb-0'>Video Estimating Session</h3>
            <span className='text-muted'>
              Trade: {session.trade_type} • AI Agent: Server-side SWML
            </span>
          </div>
          <div className='d-flex gap-2 align-items-center'>
            <span className='badge badge-light-info me-2'>v11-CLEAN-FINAL</span>
            <div className='form-check form-switch form-check-custom form-check-solid'>
              <input
                className='form-check-input'
                type='checkbox'
                id='mockModeToggle'
                checked={useMockMode}
                onChange={(e) => {
                  setUseMockMode(e.target.checked)
                  if (isConnected) {
                    window.location.reload() // Restart session with new mode
                  }
                }}
              />
              <label className='form-check-label' htmlFor='mockModeToggle'>
                Mock Mode
              </label>
            </div>
            <button
              className='btn btn-light-primary btn-sm'
              onClick={handleManualCapture}
              disabled={!isConnected}
            >
              <i className='ki-duotone ki-camera fs-6 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              Capture Frame
            </button>
            <button
              className='btn btn-danger btn-sm'
              onClick={handleEndSession}
            >
              <i className='ki-duotone ki-cross-circle fs-6 me-1'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='flex-grow-1 d-flex'>
        {/* Video Container */}
        <div className='flex-grow-1 bg-dark position-relative'>
          <div
            ref={videoContainerRef}
            className='h-100 w-100'
            style={{ minHeight: '500px' }}
          >
            {isConnected ? (
              useMockMode ? <MockVideoDisplay /> : null // SignalWire SDK renders its own UI
            ) : (
              <div className='h-100 w-100 d-flex align-items-center justify-content-center'>
                <div className='text-center text-white'>
                  <div className='spinner-border text-light mb-3' role='status'>
                    <span className='visually-hidden'>Connecting...</span>
                  </div>
                  <div>Connecting to video session...</div>
                </div>
              </div>
            )}
          </div>

          {/* Current Prompt Overlay */}
          {currentPrompt && isConnected && (
            <div className='position-absolute bottom-0 start-0 end-0 p-4'>
              <div className='bg-white bg-opacity-90 rounded p-3 shadow'>
                <h5 className='mb-2'>Next Step:</h5>
                <p className='mb-0'>{currentPrompt}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className='w-350px bg-light border-start d-flex flex-column'>
          {/* Guided Prompts */}
          <GuidedPromptsPanel
            tradeType={session.trade_type}
            currentPrompt={currentPrompt}
            onPromptSelect={setCurrentPrompt}
          />

          {/* Vision Results */}
          <VisionResultsPanel
            results={visionResults}
            capturedFrames={capturedFrames}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className='bg-white border-top px-5 py-2'>
        <div className='d-flex justify-content-between align-items-center'>
          <div className='d-flex align-items-center gap-3'>
            <span className={`badge badge-${isConnected ? 'success' : 'warning'}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
            <span className='text-muted'>
              Frames Captured: {capturedFrames.length}
            </span>
            <span className='text-muted'>
              Objects Detected: {visionResults.reduce((acc, r) => acc + (r.objects?.length || 0), 0)}
            </span>
          </div>
          {isProcessing && (
            <span className='text-primary'>
              <i className='ki-duotone ki-loading fs-6 me-2'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
              Processing frame...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}