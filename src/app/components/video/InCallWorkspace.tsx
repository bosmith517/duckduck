import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface MeetingData {
  id: string
  title: string
  agenda: AgendaItem[]
  participants: Participant[]
  notes: Note[]
  files: MeetingFile[]
  transcript: TranscriptEntry[]
  recording_url?: string
  status: 'scheduled' | 'in_progress' | 'completed'
}

interface AgendaItem {
  id: string
  title: string
  duration: number
  description?: string
  status: 'upcoming' | 'current' | 'completed'
  startTime?: Date
  remainingTime?: number
}

interface Participant {
  id: string
  name: string
  email: string
  role: string
  isMuted: boolean
  isCameraOff: boolean
  isPresenting: boolean
  isSpeaking: boolean
}

interface Note {
  id: string
  content: string
  isPrivate: boolean
  author: string
  timestamp: Date
}

interface ActionItem {
  id: string
  content: string
  assignee?: string
  completed: boolean
  createdAt: Date
}

interface MeetingFile {
  id: string
  name: string
  url: string
  type: string
  size: number
}

interface TranscriptEntry {
  id: string
  speaker: string
  text: string
  timestamp: Date
  confidence?: number
}

export const InCallWorkspace: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { user, userProfile } = useSupabaseAuth()
  const videoGridRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'notes' | 'files' | 'ai'>('notes')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [layoutView, setLayoutView] = useState<'grid' | 'speaker' | 'presentation'>('grid')
  
  const [notes, setNotes] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [isPrivateNotes, setIsPrivateNotes] = useState(false)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [newActionItem, setNewActionItem] = useState('')
  
  const [currentAgendaIndex, setCurrentAgendaIndex] = useState(0)
  const [agendaTimer, setAgendaTimer] = useState<number>(0)
  
  const [annotationMode, setAnnotationMode] = useState<'pen' | 'highlighter' | 'arrow' | null>(null)
  const [annotationColor, setAnnotationColor] = useState('#17E1D1')
  
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())

  useEffect(() => {
    if (meetingId) {
      loadMeetingData()
      initializeMedia()
      startAgendaTimer()
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [meetingId])

  const loadMeetingData = async () => {
    try {
      const { data, error } = await supabase
        .from('video_meetings')
        .select('*')
        .eq('id', meetingId)
        .single()

      if (error) throw error

      if (data) {
        setMeeting({
          ...data,
          agenda: data.agenda || [],
          participants: data.participants || [],
          notes: data.notes || [],
          files: data.files || [],
          transcript: data.transcript || []
        })
        
        // Update meeting status to in_progress
        await supabase
          .from('video_meetings')
          .update({ status: 'in_progress' })
          .eq('id', meetingId)
      }
    } catch (error) {
      console.error('Error loading meeting:', error)
      showToast.error('Failed to load meeting data')
    } finally {
      setLoading(false)
    }
  }

  const initializeMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      setStream(mediaStream)
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error('Error accessing media:', error)
      showToast.error('Unable to access camera and microphone')
    }
  }

  const startAgendaTimer = () => {
    if (!meeting?.agenda || meeting.agenda.length === 0) return

    const currentItem = meeting.agenda[currentAgendaIndex]
    if (!currentItem) return

    setAgendaTimer(currentItem.duration * 60) // Convert minutes to seconds

    const interval = setInterval(() => {
      setAgendaTimer(prev => {
        if (prev <= 1) {
          // Timer expired - flash amber and move to next item
          flashTimerExpired()
          moveToNextAgendaItem()
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }

  const flashTimerExpired = () => {
    // Flash animation for timer expiry
    const timerElement = document.getElementById('agenda-timer')
    if (timerElement) {
      timerElement.classList.add('timer-flash')
      setTimeout(() => {
        timerElement.classList.remove('timer-flash')
      }, 3000)
    }
    showToast.warning('Agenda time expired')
  }

  const moveToNextAgendaItem = () => {
    if (meeting?.agenda && currentAgendaIndex < meeting.agenda.length - 1) {
      setCurrentAgendaIndex(prev => prev + 1)
      startAgendaTimer()
    }
  }

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = isMuted
        setIsMuted(!isMuted)
      }
    }
  }

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = isCameraOff
        setIsCameraOff(!isCameraOff)
      }
    }
  }

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      
      setIsPresenting(true)
      setLayoutView('presentation')
      
      // Handle when user stops sharing
      screenStream.getVideoTracks()[0].onended = () => {
        setIsPresenting(false)
        setLayoutView('grid')
      }
    } catch (error) {
      console.error('Error starting screen share:', error)
      showToast.error('Failed to start screen sharing')
    }
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
    showToast.info(isRecording ? 'Recording stopped' : 'Recording started')
  }

  const leaveMeeting = () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
      navigate(`/video-meeting/${meetingId}/summary`)
    }
  }

  const saveNote = async () => {
    if (!notes.trim()) return

    const newNote: Note = {
      id: Date.now().toString(),
      content: notes,
      isPrivate: isPrivateNotes,
      author: `${userProfile?.first_name} ${userProfile?.last_name}` || 'You',
      timestamp: new Date()
    }

    // In real implementation, save to Supabase
    if (meeting) {
      setMeeting(prev => prev ? { ...prev, notes: [...prev.notes, newNote] } : null)
    }
    
    setNotes('')
    showToast.success('Note saved')
  }

  const addActionItem = () => {
    if (!newActionItem.trim()) return

    const actionItem: ActionItem = {
      id: Date.now().toString(),
      content: newActionItem,
      completed: false,
      createdAt: new Date()
    }

    setActionItems(prev => [...prev, actionItem])
    setNewActionItem('')
  }

  const toggleActionItem = (id: string) => {
    setActionItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#121417' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-4" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="text-white">Joining meeting...</h4>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex" style={{ height: '100vh', backgroundColor: '#121417' }}>
      {/* Left Sidebar - Agenda & Timer */}
      <div className="bg-dark border-end border-secondary" style={{ width: '320px', overflowY: 'auto' }}>
        <div className="p-4 border-bottom border-secondary">
          <h5 className="text-white fw-bold mb-0">Meeting Agenda</h5>
        </div>
        
        <div className="p-4">
          {meeting?.agenda?.map((item, index) => (
            <div 
              key={item.id}
              className={`card mb-3 ${index === currentAgendaIndex ? 'border-warning' : 'border-secondary'} bg-dark`}
            >
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="text-white fw-bold mb-0">{item.title}</h6>
                  <div className="badge badge-circle badge-primary">
                    {index + 1}
                  </div>
                </div>
                
                {item.description && (
                  <p className="text-muted fs-7 mb-2">{item.description}</p>
                )}
                
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-muted fs-7">{item.duration} min</span>
                  
                  {index === currentAgendaIndex && (
                    <div className="d-flex align-items-center">
                      <span 
                        id="agenda-timer"
                        className="badge badge-warning fw-bold fs-6 font-monospace"
                        style={{ minWidth: '60px' }}
                      >
                        {formatTime(agendaTimer)}
                      </span>
                    </div>
                  )}
                </div>
                
                {index === currentAgendaIndex && (
                  <div className="progress mt-2" style={{ height: '2px' }}>
                    <div 
                      className="progress-bar bg-warning" 
                      style={{ 
                        width: `${100 - (agendaTimer / (item.duration * 60)) * 100}%`,
                        transition: 'width 1s linear'
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Central Stage */}
      <div className="flex-grow-1 d-flex flex-column">
        {/* Video Grid */}
        <div className="flex-grow-1 position-relative">
          {isPresenting && (
            /* Annotation Toolbar */
            <div className="position-absolute top-0 start-50 translate-middle-x mt-4 z-3">
              <div className="bg-dark bg-opacity-75 rounded-pill p-2 d-flex align-items-center gap-2">
                <button 
                  className={`btn btn-sm ${annotationMode === 'pen' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAnnotationMode(annotationMode === 'pen' ? null : 'pen')}
                >
                  <i className="ki-duotone ki-pencil fs-5"></i>
                </button>
                <button 
                  className={`btn btn-sm ${annotationMode === 'highlighter' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAnnotationMode(annotationMode === 'highlighter' ? null : 'highlighter')}
                >
                  <i className="ki-duotone ki-highlight fs-5"></i>
                </button>
                <button 
                  className={`btn btn-sm ${annotationMode === 'arrow' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAnnotationMode(annotationMode === 'arrow' ? null : 'arrow')}
                >
                  <i className="ki-duotone ki-arrow-right fs-5"></i>
                </button>
                
                <div className="vr mx-2"></div>
                
                <input 
                  type="color" 
                  className="form-control form-control-color form-control-sm"
                  value={annotationColor}
                  onChange={(e) => setAnnotationColor(e.target.value)}
                />
                
                <button className="btn btn-sm btn-warning">
                  <i className="ki-duotone ki-undo fs-5"></i>
                </button>
                <button className="btn btn-sm btn-danger">
                  <i className="ki-duotone ki-trash fs-5"></i>
                </button>
              </div>
            </div>
          )}

          {/* Video Grid Container */}
          <div 
            ref={videoGridRef}
            className="h-100 p-4 d-flex align-items-center justify-content-center"
          >
            {layoutView === 'presentation' ? (
              /* Screen Share Layout */
              <div className="h-100 w-100">
                <div className="bg-secondary rounded h-100 d-flex align-items-center justify-content-center mb-3">
                  <div className="text-center text-white">
                    <i className="ki-duotone ki-screen fs-5x mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <h4>Screen Share Active</h4>
                  </div>
                </div>
                
                {/* Participant Videos Strip */}
                <div className="d-flex gap-2 mt-3" style={{ height: '120px' }}>
                  <video 
                    ref={localVideoRef}
                    autoPlay 
                    muted 
                    playsInline
                    className="bg-secondary rounded flex-shrink-0"
                    style={{ width: '160px', height: '120px', objectFit: 'cover' }}
                  />
                  {/* Add remote participant videos here */}
                </div>
              </div>
            ) : (
              /* Grid Layout */
              <div className="row g-3 w-100">
                <div className="col-lg-6">
                  <div className="position-relative">
                    <video 
                      ref={localVideoRef}
                      autoPlay 
                      muted 
                      playsInline
                      className="w-100 bg-secondary rounded"
                      style={{ aspectRatio: '16/9', objectFit: 'cover' }}
                    />
                    <div className="position-absolute bottom-0 start-0 end-0 p-3">
                      <div className="d-flex align-items-center justify-content-between">
                        <span className="badge bg-dark bg-opacity-75 text-white">
                          You {isMuted && '(Muted)'}
                        </span>
                        {!isMuted && (
                          <div className="border border-2 border-primary rounded" style={{ width: '3px', height: '20px' }}>
                            <div className="bg-primary h-100 w-100 rounded"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Placeholder for remote participants */}
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="col-lg-6">
                    <div className="bg-secondary rounded d-flex align-items-center justify-content-center" style={{ aspectRatio: '16/9' }}>
                      <div className="text-center text-white">
                        <i className="ki-duotone ki-user fs-3x mb-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>Waiting for participant...</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Global Utilities */}
          <div className="position-absolute bottom-0 start-50 translate-middle-x mb-4">
            <div className="bg-dark bg-opacity-90 rounded-pill p-3 d-flex align-items-center gap-3">
              <button 
                className={`btn btn-circle ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleMute}
              >
                <i className={`ki-duotone ${isMuted ? 'ki-microphone-slash' : 'ki-microphone'} fs-3`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
              </button>
              
              <button 
                className={`btn btn-circle ${isCameraOff ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleCamera}
              >
                <i className={`ki-duotone ${isCameraOff ? 'ki-eye-slash' : 'ki-eye'} fs-3`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
              </button>
              
              <button 
                className={`btn btn-circle ${isPresenting ? 'btn-primary' : 'btn-secondary'}`}
                onClick={startScreenShare}
              >
                <i className="ki-duotone ki-screen fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
              
              <button 
                className={`btn btn-circle ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleRecording}
              >
                <i className="ki-duotone ki-record-circle fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
              
              <select 
                className="form-select form-select-sm bg-secondary border-0 text-white"
                value={layoutView}
                onChange={(e) => setLayoutView(e.target.value as any)}
              >
                <option value="grid">Grid View</option>
                <option value="speaker">Speaker View</option>
                <option value="presentation">Presentation</option>
              </select>
              
              <div className="vr mx-2"></div>
              
              <button 
                className="btn btn-danger btn-circle"
                onClick={leaveMeeting}
              >
                <i className="ki-duotone ki-entrance-left fs-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Collaboration Tabs */}
      <div className="bg-dark border-start border-secondary" style={{ width: '360px' }}>
        {/* Tab Navigation */}
        <div className="d-flex border-bottom border-secondary">
          <button 
            className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'notes' ? 'btn-primary' : 'btn-dark text-muted'}`}
            onClick={() => setActiveTab('notes')}
          >
            <i className="ki-duotone ki-note fs-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <button 
            className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'files' ? 'btn-primary' : 'btn-dark text-muted'}`}
            onClick={() => setActiveTab('files')}
          >
            <i className="ki-duotone ki-file fs-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <button 
            className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'ai' ? 'btn-primary' : 'btn-dark text-muted'}`}
            onClick={() => setActiveTab('ai')}
          >
            <i className="ki-duotone ki-abstract-26 fs-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4" style={{ height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
          {activeTab === 'notes' && (
            <div>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="text-white fw-bold mb-0">Meeting Notes</h6>
                <div className="form-check form-switch">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    checked={isPrivateNotes}
                    onChange={(e) => setIsPrivateNotes(e.target.checked)}
                  />
                  <label className="form-check-label text-white fs-7">
                    Private
                  </label>
                </div>
              </div>

              <textarea
                className="form-control bg-secondary border-0 text-white mb-3"
                rows={6}
                placeholder="Take notes during the meeting..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <button 
                className="btn btn-primary btn-sm w-100 mb-4"
                onClick={saveNote}
                disabled={!notes.trim()}
              >
                Save Note
              </button>

              {/* Action Items */}
              <div className="mb-4">
                <h6 className="text-white fw-bold mb-3">Action Items</h6>
                
                <div className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control bg-secondary border-0 text-white"
                    placeholder="Add action item..."
                    value={newActionItem}
                    onChange={(e) => setNewActionItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addActionItem()}
                  />
                  <button 
                    className="btn btn-primary"
                    onClick={addActionItem}
                    disabled={!newActionItem.trim()}
                  >
                    <i className="ki-duotone ki-plus fs-4"></i>
                  </button>
                </div>

                <div className="space-y-2">
                  {actionItems.map((item) => (
                    <div key={item.id} className="d-flex align-items-start bg-secondary rounded p-2">
                      <input
                        type="checkbox"
                        className="form-check-input me-2 mt-1"
                        checked={item.completed}
                        onChange={() => toggleActionItem(item.id)}
                      />
                      <span className={`flex-grow-1 text-white fs-7 ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}>
                        {item.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Saved Notes */}
              <div>
                <h6 className="text-white fw-bold mb-3">Saved Notes</h6>
                <div className="space-y-2">
                  {meeting?.notes?.map((note) => (
                    <div key={note.id} className="bg-secondary rounded p-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="text-primary fs-7 fw-semibold">{note.author}</span>
                        <div className="d-flex align-items-center gap-2">
                          {note.isPrivate && (
                            <i className="ki-duotone ki-lock fs-7 text-warning">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          )}
                          <span className="text-muted fs-8">
                            {note.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-white fs-7 mb-0">{note.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              <h6 className="text-white fw-bold mb-4">Meeting Files</h6>
              
              {meeting?.files && meeting.files.length > 0 ? (
                <div className="space-y-2">
                  {meeting.files.map((file) => (
                    <div key={file.id} className="bg-secondary rounded p-3 hover-bg-primary cursor-pointer">
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-file-text fs-2 text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="flex-grow-1">
                          <div className="text-white fw-semibold">{file.name}</div>
                          <div className="text-muted fs-7">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <button className="btn btn-sm btn-primary">
                          <i className="ki-duotone ki-down fs-4"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="ki-duotone ki-file fs-5x text-muted mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <p className="text-muted">No files shared</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <h6 className="text-white fw-bold mb-4">AI Assistant</h6>
              
              {/* Live Transcript */}
              <div className="bg-secondary rounded p-3 mb-4" style={{ height: '300px', overflowY: 'auto' }}>
                <div className="text-center text-muted py-4">
                  <i className="ki-duotone ki-microphone fs-3x mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <p>Live transcription will appear here...</p>
                </div>
                
                {meeting?.transcript?.map((entry) => (
                  <div key={entry.id} className="mb-2">
                    <div className="d-flex align-items-center mb-1">
                      <span className="text-primary fw-semibold fs-7">{entry.speaker}</span>
                      <span className="text-muted fs-8 ms-2">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-white fs-7 mb-0">{entry.text}</p>
                  </div>
                ))}
              </div>

              <button className="btn btn-warning w-100">
                <i className="ki-duotone ki-abstract-26 fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Generate Summary
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        .timer-flash {
          animation: flash 0.5s ease-in-out 3;
        }
        
        @keyframes flash {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .hover-scale:hover {
          transform: scale(1.02);
          transition: transform 0.2s ease;
        }
        
        .btn-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  )
}

export default InCallWorkspace
