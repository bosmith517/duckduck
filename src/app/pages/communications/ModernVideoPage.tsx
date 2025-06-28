import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Routes, Route } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import VideoMeetingLobby from '../../components/video/VideoMeetingLobby'
import VideoMeetingRoom from '../../components/video/VideoMeetingRoom'
import VideoMeetingSummary from '../../components/video/VideoMeetingSummary'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface Meeting {
  id: string
  title: string
  scheduled_time: string
  status: 'scheduled' | 'in_progress' | 'completed'
  host_name: string
  participant_count: number
  duration?: number
}

const VideoMeetingsList: React.FC = () => {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    scheduled_time: '',
    participants: ''
  })

  useEffect(() => {
    loadMeetings()
  }, [])

  const loadMeetings = async () => {
    try {
      // Mock data - replace with actual Supabase query
      setMeetings([
        {
          id: '1',
          title: 'HVAC System Review & Estimate',
          scheduled_time: new Date(Date.now() + 3600000).toISOString(),
          status: 'scheduled',
          host_name: 'Mike Rodriguez',
          participant_count: 2
        },
        {
          id: '2',
          title: 'Kitchen Remodel Consultation',
          scheduled_time: new Date(Date.now() + 86400000).toISOString(),
          status: 'scheduled',
          host_name: 'Sarah Johnson',
          participant_count: 3
        },
        {
          id: '3',
          title: 'Plumbing Inspection Follow-up',
          scheduled_time: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed',
          host_name: 'Tom Wilson',
          participant_count: 2,
          duration: 1800
        }
      ])
    } catch (error) {
      showToast.error('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  const createMeeting = async () => {
    try {
      // Create meeting logic
      showToast.success('Meeting created successfully')
      setShowCreateModal(false)
      loadMeetings()
    } catch (error) {
      showToast.error('Failed to create meeting')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'badge-light-primary'
      case 'in_progress':
        return 'badge-light-success'
      case 'completed':
        return 'badge-light-secondary'
      default:
        return 'badge-light'
    }
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Video Meetings</PageTitle>

      <div className="row g-6 mb-6">
        {/* Stats Cards */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-primary">
                    <i className="ki-duotone ki-calendar fs-2x text-primary">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">12</div>
                  <div className="text-muted">Meetings This Week</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-success">
                    <i className="ki-duotone ki-people fs-2x text-success">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                      <span className="path5"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">48</div>
                  <div className="text-muted">Total Participants</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center">
                <div className="symbol symbol-50px me-5">
                  <div className="symbol-label bg-light-info">
                    <i className="ki-duotone ki-time fs-2x text-info">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </div>
                </div>
                <div>
                  <div className="fw-bold fs-6 text-gray-800">24.5h</div>
                  <div className="text-muted">Total Meeting Time</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <KTCard>
        <div className="card-header border-0 pt-6">
          <div className="card-title">
            <div className="d-flex align-items-center position-relative my-1">
              <i className="ki-duotone ki-magnifier fs-3 position-absolute ms-5">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <input
                type="text"
                className="form-control form-control-solid w-250px ps-13"
                placeholder="Search meetings..."
              />
            </div>
          </div>
          <div className="card-toolbar">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <i className="ki-duotone ki-plus fs-2"></i>
              Schedule Meeting
            </button>
          </div>
        </div>

        <KTCardBody className="py-4">
          <div className="table-responsive">
            <table className="table align-middle table-row-dashed fs-6 gy-5">
              <thead>
                <tr className="text-start text-muted fw-bold fs-7 text-uppercase gs-0">
                  <th>Meeting</th>
                  <th>Scheduled Time</th>
                  <th>Host</th>
                  <th>Participants</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 fw-semibold">
                {meetings.map((meeting) => (
                  <tr key={meeting.id}>
                    <td>
                      <a
                        href="#"
                        className="text-gray-800 text-hover-primary fw-bold"
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/video-meeting/${meeting.id}`)
                        }}
                      >
                        {meeting.title}
                      </a>
                    </td>
                    <td>
                      <div className="d-flex flex-column">
                        <span>{new Date(meeting.scheduled_time).toLocaleDateString()}</span>
                        <span className="text-muted fs-7">
                          {new Date(meeting.scheduled_time).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td>{meeting.host_name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-people fs-3 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                          <span className="path4"></span>
                          <span className="path5"></span>
                        </i>
                        {meeting.participant_count}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(meeting.status)}`}>
                        {meeting.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end flex-shrink-0">
                        {meeting.status === 'scheduled' && (
                          <button
                            className="btn btn-sm btn-light-primary me-2"
                            onClick={() => navigate(`/video-meeting/${meeting.id}`)}
                          >
                            <i className="ki-duotone ki-enter-right fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            Enter Lobby
                          </button>
                        )}
                        {meeting.status === 'completed' && (
                          <button
                            className="btn btn-sm btn-light-info"
                            onClick={() => navigate(`/video-meeting/${meeting.id}/summary`)}
                          >
                            <i className="ki-duotone ki-document fs-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            View Summary
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </KTCardBody>
      </KTCard>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Schedule New Meeting</h5>
                <button
                  className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                  onClick={() => setShowCreateModal(false)}
                >
                  <i className="ki-duotone ki-cross fs-2x">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>
              <div className="modal-body">
                <div className="mb-5">
                  <label className="form-label">Meeting Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., HVAC System Review"
                    value={newMeeting.title}
                    onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                  />
                </div>
                <div className="mb-5">
                  <label className="form-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={newMeeting.scheduled_time}
                    onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_time: e.target.value })}
                  />
                </div>
                <div className="mb-5">
                  <label className="form-label">Participant Emails</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Enter email addresses, one per line"
                    value={newMeeting.participants}
                    onChange={(e) => setNewMeeting({ ...newMeeting, participants: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-light"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={createMeeting}
                >
                  Schedule Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const ModernVideoPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<VideoMeetingsList />} />
      <Route path=":meetingId" element={<VideoMeetingLobbyWrapper />} />
      <Route path=":meetingId/room" element={<VideoMeetingRoomWrapper />} />
      <Route path=":meetingId/summary" element={<VideoMeetingSummaryWrapper />} />
    </Routes>
  )
}

// Wrapper components to pass meetingId prop
const VideoMeetingLobbyWrapper: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  return <VideoMeetingLobby meetingId={meetingId!} />
}

const VideoMeetingRoomWrapper: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  return <VideoMeetingRoom meetingId={meetingId!} />
}

const VideoMeetingSummaryWrapper: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  return <VideoMeetingSummary meetingId={meetingId!} />
}

export default ModernVideoPage