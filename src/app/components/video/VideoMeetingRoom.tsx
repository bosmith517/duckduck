import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface VideoMeetingRoomProps {
  meetingId: string
}

interface AgendaItem {
  id: string
  text: string
  completed: boolean
}

interface ActionItem {
  id: string
  text: string
  assignee?: string
  completed: boolean
}

interface Annotation {
  id: string
  x: number
  y: number
  text?: string
  type: 'arrow' | 'circle' | 'text'
  color: string
}

export const VideoMeetingRoom: React.FC<VideoMeetingRoomProps> = ({ meetingId }) => {
  const navigate = useNavigate()
  const [roomSession, setRoomSession] = useState<any>(null)
  const [isHost, setIsHost] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showNotes, setShowNotes] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const videoContainerRef = useRef<HTMLDivElement>(null)
  
  // Meeting data
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { id: '1', text: 'Review current HVAC system photos', completed: false },
    { id: '2', text: 'Discuss replacement options', completed: false },
    { id: '3', text: 'Go over estimate details', completed: false },
    { id: '4', text: 'Schedule installation date', completed: false }
  ])
  const [currentAgendaItem, setCurrentAgendaItem] = useState(0)
  const [notes, setNotes] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [transcript, setTranscript] = useState<string[]>([])
  const [aiSummary, setAiSummary] = useState('')

  // Canvas for annotations
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isAnnotating, setIsAnnotating] = useState(false)
  const [annotationTool, setAnnotationTool] = useState<'arrow' | 'circle' | 'text'>('arrow')
  const [annotationColor, setAnnotationColor] = useState('#FF0000')

  // Initialize SignalWire Video Room
  useEffect(() => {
    initializeVideoRoom()
    return () => {
      if (roomSession) {
        roomSession.leave()
      }
    }
  }, [])

  const initializeVideoRoom = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get SignalWire video token
      const { data: tokenData, error } = await supabase.functions.invoke('generate-signalwire-token', {
        body: { 
          roomName: meetingId,
          userName: user.email?.split('@')[0] || 'Guest',
          isHost: isHost
        }
      })

      if (error || !tokenData?.token) {
        throw new Error('Failed to get video token')
      }

      // Initialize SignalWire Video SDK
      const { Video } = await import('@signalwire/js')
      
      const roomSessionObj = new Video.RoomSession({
        token: tokenData.token,
        rootElement: videoContainerRef.current || undefined,
        audio: true,
        video: true,
      })

      // Set up event handlers
      roomSessionObj.on('room.joined', () => {
        console.log('Joined room')
        showToast.success('Connected to video room')
      })

      roomSessionObj.on('member.joined', (e: any) => {
        console.log('Member joined:', e.member)
        showToast.info(`${e.member.name} joined the meeting`)
        updateParticipants()
      })

      roomSessionObj.on('member.left', (e: any) => {
        console.log('Member left:', e.member)
        showToast.info(`${e.member.name} left the meeting`)
        updateParticipants()
      })

      roomSessionObj.on('room.updated', updateParticipants)

      // Join the room
      await roomSessionObj.join()
      setRoomSession(roomSessionObj)

    } catch (error: any) {
      console.error('Failed to initialize video room:', error)
      showToast.error(error.message || 'Failed to connect to video room')
    }
  }

  const updateParticipants = () => {
    if (!roomSession) return
    const members = roomSession.members || []
    setParticipants(members)
  }

  const toggleMute = async () => {
    if (!roomSession) return
    
    try {
      if (isMuted) {
        await roomSession.audioUnmute()
        setIsMuted(false)
      } else {
        await roomSession.audioMute()
        setIsMuted(true)
      }
    } catch (error) {
      console.error('Failed to toggle mute:', error)
    }
  }

  const toggleVideo = async () => {
    if (!roomSession) return
    
    try {
      if (isVideoOff) {
        await roomSession.videoUnmute()
        setIsVideoOff(false)
      } else {
        await roomSession.videoMute()
        setIsVideoOff(true)
      }
    } catch (error) {
      console.error('Failed to toggle video:', error)
    }
  }

  const toggleScreenShare = async () => {
    if (!roomSession) return
    
    try {
      if (isScreenSharing) {
        await roomSession.stopScreenShare()
        setIsScreenSharing(false)
      } else {
        await roomSession.startScreenShare()
        setIsScreenSharing(true)
        setIsAnnotating(true)
      }
    } catch (error) {
      showToast.error('Failed to toggle screen share')
    }
  }

  const toggleRecording = async () => {
    if (!roomSession) return
    
    try {
      if (isRecording) {
        // SignalWire recording API
        const { error } = await supabase.functions.invoke('control-room-recording', {
          body: {
            roomId: meetingId,
            action: 'stop'
          }
        })
        if (!error) {
          setIsRecording(false)
          showToast.info('Recording stopped')
        }
      } else {
        const { error } = await supabase.functions.invoke('control-room-recording', {
          body: {
            roomId: meetingId,
            action: 'start'
          }
        })
        if (!error) {
          setIsRecording(true)
          showToast.success('Recording started')
        }
      }
    } catch (error) {
      showToast.error('Failed to toggle recording')
    }
  }

  const focusAgendaItem = (index: number) => {
    setCurrentAgendaItem(index)
    // Broadcast to other participants via SignalWire
    if (roomSession) {
      roomSession.sendMessage({
        type: 'agenda-focus',
        index
      })
    }
  }

  const toggleAgendaItem = (id: string) => {
    setAgenda(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  const addActionItem = () => {
    const text = prompt('Enter action item:')
    if (text) {
      const newItem: ActionItem = {
        id: Date.now().toString(),
        text,
        completed: false
      }
      setActionItems(prev => [...prev, newItem])
    }
  }

  const generateAISummary = async () => {
    setShowAI(true)
    // Simulate AI processing
    setTimeout(() => {
      setAiSummary(`
**Meeting Summary - ${new Date().toLocaleString()}**

**Key Discussion Points:**
• Reviewed current HVAC system - 15 years old, showing signs of wear
• Discussed 3 replacement options: Standard, High-efficiency, and Smart system
• Client prefers high-efficiency option with smart thermostat integration
• Estimate of $8,500 includes all materials and labor

**Decisions Made:**
• Selected Carrier Infinity 20 SEER system
• Installation scheduled for next Tuesday at 8 AM
• 10-year warranty included

**Action Items:**
• Mike to send detailed equipment specifications by EOD
• Client to clear access path to attic before installation
• Schedule follow-up call for Friday to confirm preparations

**Next Steps:**
• Installation team arrival Tuesday 8 AM
• Estimated completion by 5 PM same day
• Post-installation walkthrough and system training
      `.trim())
    }, 2000)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAnnotating || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      x,
      y,
      type: annotationTool,
      color: annotationColor
    }
    
    if (annotationTool === 'text') {
      const text = prompt('Enter annotation text:')
      if (text) {
        newAnnotation.text = text
      }
    }
    
    setAnnotations(prev => [...prev, newAnnotation])
    drawAnnotations()
  }

  const drawAnnotations = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    
    // Draw each annotation
    annotations.forEach(ann => {
      ctx.strokeStyle = ann.color
      ctx.fillStyle = ann.color
      ctx.lineWidth = 2
      
      switch (ann.type) {
        case 'arrow':
          // Draw arrow
          ctx.beginPath()
          ctx.moveTo(ann.x - 20, ann.y - 20)
          ctx.lineTo(ann.x, ann.y)
          ctx.stroke()
          // Arrowhead
          ctx.beginPath()
          ctx.moveTo(ann.x, ann.y)
          ctx.lineTo(ann.x - 8, ann.y - 8)
          ctx.lineTo(ann.x - 8, ann.y + 8)
          ctx.closePath()
          ctx.fill()
          break
          
        case 'circle':
          ctx.beginPath()
          ctx.arc(ann.x, ann.y, 20, 0, 2 * Math.PI)
          ctx.stroke()
          break
          
        case 'text':
          if (ann.text) {
            ctx.font = '16px Arial'
            ctx.fillText(ann.text, ann.x, ann.y)
          }
          break
      }
    })
  }

  const endMeeting = async () => {
    if (roomSession) {
      await roomSession.leave()
    }
    navigate(`/video-meeting/${meetingId}/summary`)
  }

  // Mock transcript updates
  useEffect(() => {
    const interval = setInterval(() => {
      const speakers = ['Mike Rodriguez', 'John Smith']
      const phrases = [
        'The current system is about 15 years old',
        'I recommend the high-efficiency option',
        'The smart thermostat will save you money',
        'Installation should take about 8 hours',
        'We include a 10-year warranty',
        'The total estimate is $8,500'
      ]
      
      const newLine = `[${new Date().toLocaleTimeString()}] ${speakers[Math.floor(Math.random() * speakers.length)]}: ${phrases[Math.floor(Math.random() * phrases.length)]}`
      setTranscript(prev => [...prev, newLine].slice(-10))
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    drawAnnotations()
  }, [annotations])

  return (
    <div className="d-flex flex-column vh-100 bg-dark">
      {/* Header */}
      <div className="bg-dark border-bottom border-gray-800 px-4 py-3">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <img src="/assets/media/logos/tradeworks-logo.png" alt="TradeWorks Pro" className="h-30px me-3" />
            <h5 className="text-white mb-0">HVAC System Review & Estimate</h5>
            {isRecording && (
              <span className="badge badge-light-danger ms-3">
                <i className="ki-duotone ki-video fs-7 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Recording
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-dark">
              <i className="ki-duotone ki-user fs-4"></i>
            </button>
            <button 
              className="btn btn-sm btn-danger"
              onClick={endMeeting}
            >
              End Meeting
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex">
        {/* Video Area */}
        <div className="flex-grow-1 position-relative bg-black">
          {/* SignalWire Video Container */}
          <div ref={videoContainerRef} className="w-100 h-100" />
          
          {!roomSession && (
            <div className="position-absolute top-50 start-50 translate-middle text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Connecting...</span>
              </div>
              <p className="text-gray-400">Connecting to video room...</p>
            </div>
          )}

          {/* Annotation Canvas Overlay */}
          {isScreenSharing && isAnnotating && (
            <canvas
              ref={canvasRef}
              className="position-absolute top-0 start-0 w-100 h-100"
              style={{ pointerEvents: isAnnotating ? 'auto' : 'none', zIndex: 10 }}
              onClick={handleCanvasClick}
            />
          )}

          {/* Annotation Tools */}
          {isScreenSharing && (
            <div className="position-absolute top-0 start-50 translate-middle-x mt-3 bg-dark rounded p-2 d-flex gap-2" style={{ zIndex: 20 }}>
              <button 
                className={`btn btn-sm ${annotationTool === 'arrow' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnnotationTool('arrow')}
              >
                ↗
              </button>
              <button 
                className={`btn btn-sm ${annotationTool === 'circle' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnnotationTool('circle')}
              >
                ○
              </button>
              <button 
                className={`btn btn-sm ${annotationTool === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnnotationTool('text')}
              >
                T
              </button>
              <input
                type="color"
                value={annotationColor}
                onChange={(e) => setAnnotationColor(e.target.value)}
                className="btn btn-sm"
                style={{ width: '40px', height: '30px', padding: '2px' }}
              />
              <button 
                className="btn btn-sm btn-danger"
                onClick={() => setAnnotations([])}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="bg-dark border-start border-gray-800" style={{ width: '400px' }}>
          {/* Tab Navigation */}
          <div className="nav nav-tabs nav-line-tabs nav-line-tabs-2x border-transparent fs-6 px-4 pt-3">
            <a 
              className={`nav-link text-gray-400 ${showNotes ? 'active text-white' : ''}`}
              onClick={() => { setShowNotes(true); setShowChat(false); setShowAI(false) }}
              style={{ cursor: 'pointer' }}
            >
              <i className="ki-duotone ki-notepad fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Workspace
            </a>
            <a 
              className={`nav-link text-gray-400 ${showChat ? 'active text-white' : ''}`}
              onClick={() => { setShowNotes(false); setShowChat(true); setShowAI(false) }}
              style={{ cursor: 'pointer' }}
            >
              <i className="ki-duotone ki-message-text fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Chat
            </a>
            <a 
              className={`nav-link text-gray-400 ${showAI ? 'active text-white' : ''}`}
              onClick={() => { setShowNotes(false); setShowChat(false); setShowAI(true) }}
              style={{ cursor: 'pointer' }}
            >
              <i className="ki-duotone ki-technology fs-4 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              AI Assistant
            </a>
          </div>

          {/* Tab Content */}
          <div className="p-4 overflow-auto" style={{ height: 'calc(100% - 60px)' }}>
            {/* Workspace Tab */}
            {showNotes && (
              <div>
                {/* Agenda */}
                <div className="mb-6">
                  <h6 className="text-white mb-3">Meeting Agenda</h6>
                  {agenda.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`d-flex align-items-center p-3 mb-2 rounded cursor-pointer ${
                        index === currentAgendaItem ? 'bg-primary bg-opacity-25' : 'bg-gray-800'
                      }`}
                      onClick={() => focusAgendaItem(index)}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input me-3"
                        checked={item.completed}
                        onChange={() => toggleAgendaItem(item.id)}
                      />
                      <span className={`text-${item.completed ? 'gray-500' : 'gray-300'} ${
                        item.completed ? 'text-decoration-line-through' : ''
                      }`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <h6 className="text-white mb-3">Meeting Notes</h6>
                  <textarea
                    className="form-control bg-gray-800 text-gray-300 border-gray-700"
                    rows={6}
                    placeholder="Type your notes here..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Action Items */}
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-white mb-0">Action Items</h6>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={addActionItem}
                    >
                      + Add
                    </button>
                  </div>
                  {actionItems.length > 0 ? (
                    actionItems.map(item => (
                      <div key={item.id} className="d-flex align-items-center bg-gray-800 p-3 rounded mb-2">
                        <input
                          type="checkbox"
                          className="form-check-input me-3"
                          checked={item.completed}
                          onChange={() => {
                            setActionItems(prev => prev.map(ai => 
                              ai.id === item.id ? { ...ai, completed: !ai.completed } : ai
                            ))
                          }}
                        />
                        <span className="text-gray-300 flex-grow-1">{item.text}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-3">No action items yet</p>
                  )}
                </div>
              </div>
            )}

            {/* Chat Tab */}
            {showChat && (
              <div className="text-center py-10">
                <p className="text-gray-400">Chat functionality coming soon</p>
              </div>
            )}

            {/* AI Tab */}
            {showAI && (
              <div>
                <div className="mb-6">
                  <h6 className="text-white mb-3">Live Transcript</h6>
                  <div className="bg-gray-800 rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {transcript.length > 0 ? (
                      transcript.map((line, index) => (
                        <p key={index} className="text-gray-400 mb-1 fs-7">{line}</p>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center">Transcript will appear here...</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="text-white mb-0">AI Summary</h6>
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={generateAISummary}
                    >
                      Generate Summary
                    </button>
                  </div>
                  {aiSummary ? (
                    <div className="bg-gray-800 rounded p-3">
                      <pre className="text-gray-300 mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                        {aiSummary}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-3">Click to generate AI summary</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-dark border-top border-gray-800 px-4 py-3">
        <div className="d-flex justify-content-center align-items-center gap-2">
          <button 
            className={`btn btn-sm ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleMute}
          >
            <i className={`ki-duotone ki-${isMuted ? 'microphone-slash' : 'microphone'} fs-4`}>
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <button 
            className={`btn btn-sm ${isVideoOff ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleVideo}
          >
            <i className={`ki-duotone ki-${isVideoOff ? 'video-slash' : 'video'} fs-4`}>
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <button 
            className={`btn btn-sm ${isScreenSharing ? 'btn-success' : 'btn-secondary'}`}
            onClick={toggleScreenShare}
          >
            <i className="ki-duotone ki-screen-rotation fs-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          {isHost && (
            <button 
              className={`btn btn-sm ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleRecording}
            >
              <i className="ki-duotone ki-video fs-4">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoMeetingRoom