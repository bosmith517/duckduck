import React, { useState, useEffect, useRef } from 'react'
import { videoService, VideoMeeting, CreateVideoMeetingRequest } from '../../services/videoService'
import { showToast } from '../../utils/toast'

interface VideoMeetingInterfaceProps {
  contactId?: string
  jobId?: string
  className?: string
}

export const VideoMeetingInterface: React.FC<VideoMeetingInterfaceProps> = ({
  contactId,
  jobId,
  className = ''
}) => {
  const [meetings, setMeetings] = useState<VideoMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    fetchMeetings()
    setupRealtimeSubscription()
  }, [contactId, jobId])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const filters: any = {}
      
      if (contactId) filters.contact_id = contactId
      if (jobId) filters.job_id = jobId

      const videoMeetings = await videoService.getVideoMeetings(filters)
      setMeetings(videoMeetings)
    } catch (error) {
      console.error('Error fetching video meetings:', error)
      showToast.error('Failed to load video meetings')
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const subscription = videoService.subscribeToVideoMeetings((payload) => {
      const meeting = payload.new as VideoMeeting
      
      // Only update if it's relevant to this component
      if (
        (!contactId || meeting.contact_id === contactId) &&
        (!jobId || meeting.job_id === jobId)
      ) {
        if (payload.eventType === 'INSERT') {
          setMeetings(prev => [meeting, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setMeetings(prev => prev.map(m => m.id === meeting.id ? meeting : m))
        } else if (payload.eventType === 'DELETE') {
          setMeetings(prev => prev.filter(m => m.id !== meeting.id))
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }

  const handleCreateMeeting = async () => {
    try {
      setCreating(true)
      
      const request: CreateVideoMeetingRequest = {}
      if (contactId) request.contact_id = contactId
      if (jobId) request.job_id = jobId

      const meeting = await videoService.createVideoMeeting(request)
      
      showToast.success('Video meeting created successfully')
      setShowCreateForm(false)
      
      // Automatically join the meeting
      if (meeting.id) {
        handleJoinMeeting(meeting.id)
      }
    } catch (error) {
      console.error('Error creating video meeting:', error)
      showToast.error('Failed to create video meeting')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinMeeting = async (meetingId: string) => {
    const loadingToast = showToast.loading('Joining meeting...')
    
    try {
      const { room_url } = await videoService.joinVideoMeeting(meetingId)
      
      // Open the Daily.co room in a new window
      const meetingWindow = window.open(
        room_url,
        'video-meeting',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      )

      if (!meetingWindow) {
        throw new Error('Please allow popups to join video meetings')
      }

      showToast.dismiss(loadingToast)
      showToast.success('Joined video meeting')
    } catch (error) {
      console.error('Error joining video meeting:', error)
      showToast.dismiss(loadingToast)
      showToast.error(error instanceof Error ? error.message : 'Failed to join meeting')
    }
  }

  const handleEndMeeting = async (meetingId: string) => {
    if (!window.confirm('Are you sure you want to end this meeting?')) return

    try {
      await videoService.endVideoMeeting(meetingId)
      showToast.success('Meeting ended')
    } catch (error) {
      console.error('Error ending meeting:', error)
      showToast.error('Failed to end meeting')
    }
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return

    try {
      await videoService.deleteVideoMeeting(meetingId)
      showToast.success('Meeting deleted')
    } catch (error) {
      console.error('Error deleting meeting:', error)
      showToast.error('Failed to delete meeting')
    }
  }

  const formatMeetingTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className='card-header'>
          <h3 className='card-title'>
            <i className='ki-duotone ki-video fs-2 me-2'></i>
            Video Meetings
          </h3>
        </div>
        <div className='card-body'>
          <div className='d-flex justify-content-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading meetings...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      <div className='card-header'>
        <h3 className='card-title'>
          <i className='ki-duotone ki-video fs-2 me-2'></i>
          Video Meetings
        </h3>
        <div className='card-toolbar'>
          <button
            className='btn btn-primary btn-sm'
            onClick={() => setShowCreateForm(true)}
            disabled={creating}
          >
            <i className='ki-duotone ki-plus fs-4'></i>
            Start Meeting
          </button>
        </div>
      </div>

      <div className='card-body'>
        {/* Quick Create Form */}
        {showCreateForm && (
          <div className='alert alert-primary d-flex align-items-center p-5 mb-5'>
            <div className='d-flex flex-column flex-grow-1'>
              <h4 className='mb-2'>Start Video Meeting</h4>
              <p className='mb-0'>
                Create an instant video meeting room. Participants will be able to join using the meeting link.
              </p>
            </div>
            <div className='d-flex gap-2'>
              <button
                className='btn btn-success'
                onClick={handleCreateMeeting}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <span className='spinner-border spinner-border-sm me-2' role='status'></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className='ki-duotone ki-video fs-2'></i>
                    Create & Join
                  </>
                )}
              </button>
              <button
                className='btn btn-light'
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Meetings List */}
        {meetings.length === 0 ? (
          <div className='text-center py-10'>
            <div className='text-muted mb-3'>
              <i className='ki-duotone ki-video fs-3x text-muted mb-3'></i>
            </div>
            <div className='text-muted'>
              No video meetings yet. Start a meeting to begin video conferencing.
            </div>
          </div>
        ) : (
          <div className='d-flex flex-column gap-4'>
            {meetings.map((meeting) => (
              <div key={meeting.id} className='border border-gray-300 rounded p-4'>
                <div className='d-flex align-items-center justify-content-between mb-3'>
                  <div className='d-flex align-items-center'>
                    <div className='symbol symbol-40px me-3'>
                      <div className='symbol-label bg-light-primary'>
                        <i className='ki-duotone ki-video fs-2 text-primary'></i>
                      </div>
                    </div>
                    <div className='d-flex flex-column'>
                      <span className='fw-bold text-gray-800'>
                        {meeting.room_name || `Meeting ${meeting.id.substring(0, 8)}`}
                      </span>
                      <span className='text-muted fs-7'>
                        Created {formatMeetingTime(meeting.created_at)}
                      </span>
                    </div>
                  </div>
                  <span className={`badge ${videoService.getStatusBadgeClass(meeting.status ?? '')}`}>
                    {meeting.status}
                  </span>
                </div>

                {/* Meeting Details */}
                <div className='row mb-3'>
                  {(meeting as any).contact && (
                    <div className='col-md-6'>
                      <div className='d-flex align-items-center mb-2'>
                        <i className='ki-duotone ki-profile-circle fs-4 text-muted me-2'></i>
                        <span className='text-muted'>Contact:</span>
                        <span className='fw-bold ms-2'>
                          {(meeting as any).contact.first_name} {(meeting as any).contact.last_name}
                        </span>
                      </div>
                    </div>
                  )}
                  {(meeting as any).job && (
                    <div className='col-md-6'>
                      <div className='d-flex align-items-center mb-2'>
                        <i className='ki-duotone ki-briefcase fs-4 text-muted me-2'></i>
                        <span className='text-muted'>Job:</span>
                        <span className='fw-bold ms-2'>{(meeting as any).job.title}</span>
                      </div>
                    </div>
                  )}
                  <div className='col-md-6'>
                    <div className='d-flex align-items-center mb-2'>
                      <i className='ki-duotone ki-people fs-4 text-muted me-2'></i>
                      <span className='text-muted'>Participants:</span>
                      <span className='fw-bold ms-2'>
                        {videoService.getParticipantsCount(meeting)}
                      </span>
                    </div>
                  </div>
                  {meeting.duration && (
                    <div className='col-md-6'>
                      <div className='d-flex align-items-center mb-2'>
                        <i className='ki-duotone ki-time fs-4 text-muted me-2'></i>
                        <span className='text-muted'>Duration:</span>
                        <span className='fw-bold ms-2'>
                          {videoService.formatDuration(meeting.duration)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meeting Actions */}
                <div className='d-flex gap-2'>
                  {videoService.isMeetingJoinable(meeting) && (
                    <button
                      className='btn btn-success btn-sm'
                      onClick={() => {
                        if (meeting?.id) handleJoinMeeting(meeting.id);
                      }}
                    >
                      <i className='ki-duotone ki-entrance-right fs-4'></i>
                      Join Meeting
                    </button>
                  )}
                  
                  {meeting.status === 'active' && (
                    <button
                      className='btn btn-warning btn-sm'
                      onClick={() => handleEndMeeting(meeting.id)}
                    >
                      <i className='ki-duotone ki-cross fs-4'></i>
                      End Meeting
                    </button>
                  )}

                  <button
                    className='btn btn-light btn-sm'
                    onClick={() => {
                      navigator.clipboard.writeText(meeting.room_url)
                      showToast.success('Meeting link copied to clipboard')
                    }}
                  >
                    <i className='ki-duotone ki-copy fs-4'></i>
                    Copy Link
                  </button>

                  {meeting.status === 'ended' && (
                    <button
                      className='btn btn-light-danger btn-sm'
                      onClick={() => handleDeleteMeeting(meeting.id)}
                    >
                      <i className='ki-duotone ki-trash fs-4'></i>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Quick video meeting button for headers/toolbars
interface QuickVideoButtonProps {
  contactId?: string
  jobId?: string
  contactName?: string
  className?: string
}

export const QuickVideoButton: React.FC<QuickVideoButtonProps> = ({
  contactId,
  jobId,
  contactName,
  className = 'btn btn-primary btn-sm'
}) => {
  const [creating, setCreating] = useState(false)

  const handleQuickMeeting = async () => {
    try {
      setCreating(true)
      
      const request: CreateVideoMeetingRequest = {}
      if (contactId) request.contact_id = contactId
      if (jobId) request.job_id = jobId
      if (contactName) request.room_name = `Meeting with ${contactName}`

      const meeting = await videoService.createVideoMeeting(request)
      
      // Automatically join the meeting
      if (meeting && meeting.id) {
        const { room_url } = await videoService.joinVideoMeeting(meeting.id)
        
        const meetingWindow = window.open(
        room_url,
        'video-meeting',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
        )

        if (!meetingWindow) {
          throw new Error('Please allow popups to join video meetings')
        }

        showToast.success('Video meeting started')
      }
    } catch (error) {
      console.error('Error starting video meeting:', error)
      showToast.error(error instanceof Error ? error.message : 'Failed to start meeting')
    } finally {
      setCreating(false)
    }
  }

  return (
    <button
      className={className}
      onClick={handleQuickMeeting}
      disabled={creating}
      title={`Start video meeting${contactName ? ` with ${contactName}` : ''}`}
    >
      {creating ? (
        <>
          <span className='spinner-border spinner-border-sm me-2' role='status'></span>
          Starting...
        </>
      ) : (
        <>
          <i className='ki-duotone ki-video fs-4'></i>
          Video Call
        </>
      )}
    </button>
  )
}