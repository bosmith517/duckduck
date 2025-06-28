import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface MeetingData {
  id: string
  title: string
  scheduled_time: string
  duration?: number
  status: 'completed'
  host_id: string
  participants: Participant[]
  recording_url?: string
  files: MeetingFile[]
  ai_summary?: AISummary
  transcript: TranscriptEntry[]
  action_items: ActionItem[]
}

interface Participant {
  id: string
  name: string
  email: string
  role: string
  joinTime?: string
  leaveTime?: string
  duration?: number
}

interface MeetingFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  uploaded_at: string
}

interface AISummary {
  key_points: string[]
  decisions_made: string[]
  next_steps: string[]
  attendee_engagement: Record<string, number>
  topics_discussed: string[]
  meeting_sentiment: 'positive' | 'neutral' | 'negative'
}

interface TranscriptEntry {
  id: string
  speaker: string
  text: string
  timestamp: string
  duration: number
}

interface ActionItem {
  id: string
  content: string
  assignee?: Participant
  due_date?: string
  status: 'unassigned' | 'in_progress' | 'completed'
  created_at: string
  priority: 'low' | 'medium' | 'high'
}

export const PostCallSummary: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { user, userProfile } = useSupabaseAuth()

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'summary' | 'recording' | 'files' | 'actions' | 'transcript'>('summary')
  const [transcriptSearch, setTranscriptSearch] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [draggedActionId, setDraggedActionId] = useState<string | null>(null)

  useEffect(() => {
    if (meetingId) {
      loadMeetingData()
    }
  }, [meetingId])

  const loadMeetingData = async () => {
    try {
      const { data, error } = await supabase
        .from('video_meetings')
        .select(`
          *,
          host:users!video_meetings_host_id_fkey(first_name, last_name, avatar_url)
        `)
        .eq('id', meetingId)
        .single()

      if (error) throw error

      if (data) {
        setMeeting({
          ...data,
          participants: data.participants || [],
          files: data.files || [],
          transcript: data.transcript || [],
          action_items: data.action_items || []
        })
      }
    } catch (error) {
      console.error('Error loading meeting:', error)
      showToast.error('Failed to load meeting data')
      navigate('/communications/video')
    } finally {
      setLoading(false)
    }
  }

  const shareMeeting = async () => {
    if (!shareEmail.trim()) {
      showToast.error('Please enter an email address')
      return
    }

    try {
      const { error } = await supabase.functions.invoke('share-meeting-summary', {
        body: {
          meetingId,
          recipientEmail: shareEmail,
          meetingTitle: meeting?.title,
          sharedBy: `${userProfile?.first_name} ${userProfile?.last_name}`
        }
      })

      if (error) throw error

      showToast.success(`Meeting summary shared with ${shareEmail}`)
      setShareEmail('')
      setShowShareModal(false)
    } catch (error) {
      console.error('Error sharing meeting:', error)
      showToast.error('Failed to share meeting summary')
    }
  }

  const updateActionItemStatus = async (itemId: string, newStatus: ActionItem['status']) => {
    try {
      const { error } = await supabase
        .from('action_items')
        .update({ status: newStatus })
        .eq('id', itemId)

      if (error) throw error

      setMeeting(prev => prev ? {
        ...prev,
        action_items: prev.action_items.map(item =>
          item.id === itemId ? { ...item, status: newStatus } : item
        )
      } : null)

      showToast.success('Action item updated')
    } catch (error) {
      console.error('Error updating action item:', error)
      showToast.error('Failed to update action item')
    }
  }

  const assignActionItem = async (itemId: string, assigneeId: string) => {
    try {
      const assignee = meeting?.participants.find(p => p.id === assigneeId)
      if (!assignee) return

      const { error } = await supabase
        .from('action_items')
        .update({ 
          assignee_id: assigneeId,
          status: 'in_progress'
        })
        .eq('id', itemId)

      if (error) throw error

      setMeeting(prev => prev ? {
        ...prev,
        action_items: prev.action_items.map(item =>
          item.id === itemId ? { 
            ...item, 
            assignee: assignee,
            status: 'in_progress' as const
          } : item
        )
      } : null)

      showToast.success('Action item assigned')
    } catch (error) {
      console.error('Error assigning action item:', error)
      showToast.error('Failed to assign action item')
    }
  }

  const handleDragStart = (e: React.DragEvent, actionId: string) => {
    setDraggedActionId(actionId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, newStatus: ActionItem['status']) => {
    e.preventDefault()
    if (draggedActionId) {
      updateActionItemStatus(draggedActionId, newStatus)
      setDraggedActionId(null)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const filteredTranscript = meeting?.transcript.filter(entry =>
    entry.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
    entry.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-4" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="text-muted">Loading meeting summary...</h4>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="text-center py-10">
        <i className="ki-duotone ki-information fs-5x text-muted mb-4">
          <span className="path1"></span>
          <span className="path2"></span>
          <span className="path3"></span>
        </i>
        <h3 className="text-muted">Meeting summary not found</h3>
        <button 
          className="btn btn-primary mt-4"
          onClick={() => navigate('/communications/video')}
        >
          Back to Video Meetings
        </button>
      </div>
    )
  }

  return (
    <div className="container-fluid py-6">
      {/* Header Bar */}
      <div className="d-flex align-items-center justify-content-between mb-6">
        <div className="d-flex align-items-center">
          <button 
            className="btn btn-icon btn-light me-3"
            onClick={() => navigate('/communications/video')}
          >
            <i className="ki-duotone ki-arrow-left fs-1">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
          <div>
            <div className="d-flex align-items-center mb-1">
              <h1 className="fs-2x fw-bold text-dark me-3">{meeting.title}</h1>
              <span className="badge badge-success fs-7 fw-bold">Completed</span>
            </div>
            <div className="text-muted fs-6">
              {new Date(meeting.scheduled_time).toLocaleString()} • 
              {meeting.duration && ` ${formatDuration(meeting.duration)} • `}
              {meeting.participants.length} participants
            </div>
          </div>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowShareModal(true)}
        >
          <i className="ki-duotone ki-send fs-3 me-2">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          Share Summary
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="d-flex border-bottom mb-6">
        {[
          { id: 'summary', label: 'AI Summary', icon: 'abstract-26' },
          { id: 'recording', label: 'Recording & Assets', icon: 'video' },
          { id: 'actions', label: 'Action Items', icon: 'check-circle' },
          { id: 'transcript', label: 'Full Transcript', icon: 'text' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn btn-flex flex-center py-3 px-4 ${
              activeSection === tab.id ? 'btn-active-light-primary border-bottom border-2 border-primary' : 'btn-light'
            }`}
            onClick={() => setActiveSection(tab.id as any)}
          >
            <i className={`ki-duotone ki-${tab.icon} fs-3 me-2`}>
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      {activeSection === 'summary' && meeting.ai_summary && (
        <div className="row g-6">
          <div className="col-xl-8">
            {/* AI Summary Card */}
            <div className="card shadow-sm mb-6">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="ki-duotone ki-abstract-26 fs-1 text-primary me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  AI-Generated Summary
                </h3>
              </div>
              <div className="card-body">
                <div className="row g-4">
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-3">Key Points Discussed</h5>
                    <ul className="list-unstyled">
                      {meeting.ai_summary.key_points.map((point, index) => (
                        <li key={index} className="d-flex align-items-start mb-2">
                          <i className="ki-duotone ki-check-circle fs-5 text-success me-2 mt-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-3">Decisions Made</h5>
                    <ul className="list-unstyled">
                      {meeting.ai_summary.decisions_made.map((decision, index) => (
                        <li key={index} className="d-flex align-items-start mb-2">
                          <i className="ki-duotone ki-arrow-right fs-5 text-primary me-2 mt-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span>{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-3">Next Steps</h5>
                    <ul className="list-unstyled">
                      {meeting.ai_summary.next_steps.map((step, index) => (
                        <li key={index} className="d-flex align-items-start mb-2">
                          <i className="ki-duotone ki-arrow-up-right fs-5 text-warning me-2 mt-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="col-md-6">
                    <h5 className="fw-bold text-dark mb-3">Topics Covered</h5>
                    <div className="d-flex flex-wrap gap-2">
                      {meeting.ai_summary.topics_discussed.map((topic, index) => (
                        <span key={index} className="badge badge-light-primary">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-4">
            {/* Meeting Metrics */}
            <div className="card shadow-sm mb-6">
              <div className="card-header">
                <h4 className="card-title">Meeting Metrics</h4>
              </div>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-4">
                  <span className="fw-semibold text-gray-600">Overall Sentiment</span>
                  <span className={`badge ${
                    meeting.ai_summary.meeting_sentiment === 'positive' ? 'badge-success' :
                    meeting.ai_summary.meeting_sentiment === 'negative' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {meeting.ai_summary.meeting_sentiment}
                  </span>
                </div>
                
                <div className="mb-4">
                  <h6 className="fw-bold text-dark mb-3">Participant Engagement</h6>
                  {Object.entries(meeting.ai_summary.attendee_engagement).map(([name, engagement]) => (
                    <div key={name} className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fs-7">{name}</span>
                      <div className="d-flex align-items-center">
                        <div className="progress me-2" style={{ width: '60px', height: '4px' }}>
                          <div 
                            className="progress-bar bg-primary" 
                            style={{ width: `${engagement}%` }}
                          ></div>
                        </div>
                        <span className="fs-8 text-muted">{engagement}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Participants Summary */}
            <div className="card shadow-sm">
              <div className="card-header">
                <h4 className="card-title">Participants</h4>
              </div>
              <div className="card-body p-0">
                {meeting.participants.map((participant) => (
                  <div key={participant.id} className="d-flex align-items-center p-4 border-bottom">
                    <div className="symbol symbol-40px me-3">
                      <div className="symbol-label bg-light-primary">
                        <span className="fs-6 fw-bold text-primary">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold text-dark">{participant.name}</div>
                      <div className="text-muted fs-7">{participant.role}</div>
                    </div>
                    {participant.duration && (
                      <div className="text-end">
                        <div className="fw-semibold text-dark">{formatDuration(participant.duration)}</div>
                        <div className="text-muted fs-8">Duration</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'recording' && (
        <div className="row g-6">
          <div className="col-md-6">
            {/* Recording Card */}
            <div className="card shadow-sm h-100">
              <div className="card-header">
                <h4 className="card-title">Meeting Recording</h4>
              </div>
              <div className="card-body text-center">
                {meeting.recording_url ? (
                  <div>
                    <div className="bg-dark rounded mb-4" style={{ aspectRatio: '16/9' }}>
                      <video 
                        controls 
                        className="w-100 h-100 rounded"
                        poster="/assets/media/misc/video-poster.jpg"
                      >
                        <source src={meeting.recording_url} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <button className="btn btn-primary">
                      <i className="ki-duotone ki-download fs-3 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Download Recording
                    </button>
                  </div>
                ) : (
                  <div className="py-10">
                    <i className="ki-duotone ki-video fs-5x text-muted mb-4">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <h5 className="text-muted">No recording available</h5>
                    <p className="text-muted">This meeting was not recorded</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            {/* Files Card */}
            <div className="card shadow-sm h-100">
              <div className="card-header">
                <h4 className="card-title">Meeting Files</h4>
              </div>
              <div className="card-body">
                {meeting.files && meeting.files.length > 0 ? (
                  <div className="space-y-3">
                    {meeting.files.map((file) => (
                      <div key={file.id} className="d-flex align-items-center p-3 bg-light rounded hover-bg-light-primary cursor-pointer">
                        <i className="ki-duotone ki-file-text fs-2x text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-dark">{file.name}</div>
                          <div className="text-muted fs-7">
                            {formatFileSize(file.size)} • 
                            {new Date(file.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button className="btn btn-sm btn-light-primary">
                          <i className="ki-duotone ki-download fs-4">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <i className="ki-duotone ki-file fs-5x text-muted mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <p className="text-muted">No files were shared during this meeting</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'actions' && (
        <div>
          <div className="row g-4">
            {(['unassigned', 'in_progress', 'completed'] as const).map((status) => (
              <div key={status} className="col-lg-4">
                <div 
                  className="card shadow-sm h-100"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  <div className="card-header">
                    <h5 className="card-title text-capitalize">
                      {status.replace('_', ' ')}
                      <span className="badge badge-light ms-2">
                        {meeting.action_items.filter(item => item.status === status).length}
                      </span>
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="space-y-3">
                      {meeting.action_items
                        .filter(item => item.status === status)
                        .map((item) => (
                          <div 
                            key={item.id}
                            className="card bg-light border-0 cursor-move"
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                          >
                            <div className="card-body p-3">
                              <div className="d-flex align-items-start justify-content-between mb-2">
                                <p className="mb-0 flex-grow-1">{item.content}</p>
                                <span className={`badge badge-${
                                  item.priority === 'high' ? 'danger' :
                                  item.priority === 'medium' ? 'warning' : 'secondary'
                                }`}>
                                  {item.priority}
                                </span>
                              </div>
                              
                              {item.assignee && (
                                <div className="d-flex align-items-center mb-2">
                                  <div className="symbol symbol-25px me-2">
                                    <div className="symbol-label bg-primary">
                                      <span className="fs-8 fw-bold text-white">
                                        {item.assignee.name.split(' ').map(n => n[0]).join('')}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="fs-7 text-muted">{item.assignee.name}</span>
                                </div>
                              )}
                              
                              <div className="d-flex align-items-center justify-content-between">
                                <span className="fs-8 text-muted">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </span>
                                {status === 'unassigned' && (
                                  <select 
                                    className="form-select form-select-sm w-auto"
                                    onChange={(e) => e.target.value && assignActionItem(item.id, e.target.value)}
                                    defaultValue=""
                                  >
                                    <option value="">Assign to...</option>
                                    {meeting.participants.map((participant) => (
                                      <option key={participant.id} value={participant.id}>
                                        {participant.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSection === 'transcript' && (
        <div className="card shadow-sm">
          <div className="card-header">
            <div className="d-flex align-items-center justify-content-between">
              <h4 className="card-title">Full Transcript</h4>
              <div className="d-flex align-items-center">
                <div className="position-relative me-3">
                  <i className="ki-duotone ki-magnifier fs-3 position-absolute ms-3 top-50 translate-middle-y text-gray-500">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <input
                    type="text"
                    className="form-control form-control-sm ps-10"
                    placeholder="Search transcript..."
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                  />
                </div>
                <button className="btn btn-sm btn-light-primary">
                  <i className="ki-duotone ki-download fs-4 me-1">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Export
                </button>
              </div>
            </div>
          </div>
          <div className="card-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredTranscript.length > 0 ? (
              <div className="space-y-4">
                {filteredTranscript.map((entry) => (
                  <div key={entry.id} className="d-flex align-items-start">
                    <div className="flex-shrink-0 me-4" style={{ width: '120px' }}>
                      <div className="fw-bold text-primary">{entry.speaker}</div>
                      <div className="text-muted fs-8">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <p className="mb-0">{entry.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="ki-duotone ki-microphone fs-5x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <p className="text-muted">
                  {transcriptSearch ? 'No results found for your search' : 'No transcript available'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Share Meeting Summary</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowShareModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter email address"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                  />
                </div>
                <div className="alert alert-light-info">
                  <i className="ki-duotone ki-information fs-2 text-info me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  The recipient will receive a link to view this meeting summary.
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-light" 
                  onClick={() => setShowShareModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={shareMeeting}
                  disabled={!shareEmail.trim()}
                >
                  <i className="ki-duotone ki-send fs-4 me-1">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Share Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PostCallSummary