import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface VideoMeetingLobbyProps {
  meetingId: string
  isHost?: boolean
}

interface MeetingData {
  id: string
  title: string
  scheduled_time: string
  host_id: string
  agenda: string
  files: MeetingFile[]
  participants: Participant[]
  status: 'scheduled' | 'in_progress' | 'completed'
}

interface MeetingFile {
  id: string
  name: string
  url: string
  size: number
  type: string
  uploaded_at: string
}

interface Participant {
  id: string
  name: string
  email: string
  status: 'waiting' | 'joined' | 'left'
  joined_at?: string
}

export const VideoMeetingLobby: React.FC<VideoMeetingLobbyProps> = ({ meetingId, isHost = false }) => {
  const navigate = useNavigate()
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [agenda, setAgenda] = useState('')
  const [techCheckPassed, setTechCheckPassed] = useState(false)
  const [cameraWorking, setCameraWorking] = useState(false)
  const [micWorking, setMicWorking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  useEffect(() => {
    loadMeetingData()
    performTechCheck()
  }, [meetingId])

  const loadMeetingData = async () => {
    try {
      // Mock data for now - replace with actual Supabase query
      setMeetingData({
        id: meetingId,
        title: 'HVAC System Review & Estimate',
        scheduled_time: new Date(Date.now() + 3600000).toISOString(),
        host_id: '123',
        agenda: '1. Review current HVAC system photos\n2. Discuss replacement options\n3. Go over estimate details\n4. Schedule installation date',
        files: [
          {
            id: '1',
            name: 'Current_System_Photos.pdf',
            url: '#',
            size: 2500000,
            type: 'application/pdf',
            uploaded_at: new Date().toISOString()
          },
          {
            id: '2',
            name: 'HVAC_Estimate_2024.pdf',
            url: '#',
            size: 1200000,
            type: 'application/pdf',
            uploaded_at: new Date().toISOString()
          }
        ],
        participants: [
          {
            id: '1',
            name: 'Mike Rodriguez',
            email: 'mike@tradeworks.com',
            status: 'waiting'
          },
          {
            id: '2',
            name: 'John Smith',
            email: 'john.smith@email.com',
            status: 'waiting'
          }
        ],
        status: 'scheduled'
      })
      setAgenda('1. Review current HVAC system photos\n2. Discuss replacement options\n3. Go over estimate details\n4. Schedule installation date')
    } catch (error) {
      showToast.error('Failed to load meeting data')
    } finally {
      setLoading(false)
    }
  }

  const performTechCheck = async () => {
    try {
      // Check camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setCameraWorking(true)
      setMicWorking(true)
      setTechCheckPassed(true)
      
      // Clean up
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error('Tech check failed:', error)
      setTechCheckPassed(false)
    }
  }

  const handleAgendaUpdate = async () => {
    if (!isHost) return
    
    try {
      // Update agenda in database
      showToast.success('Agenda updated')
    } catch (error) {
      showToast.error('Failed to update agenda')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return
    
    setUploading(true)
    try {
      const file = event.target.files[0]
      // Upload file logic here
      showToast.success(`${file.name} uploaded successfully`)
    } catch (error) {
      showToast.error('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const joinMeeting = () => {
    if (!techCheckPassed) {
      showToast.error('Please complete the tech check first')
      return
    }
    navigate(`/video-meeting/${meetingId}/room`)
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      showToast.error('Please enter an email address')
      return
    }

    setSendingInvite(true)
    try {
      // Call Supabase Edge Function to send email invitation
      const { data, error } = await supabase.functions.invoke('send-meeting-invite', {
        body: {
          meetingId: meetingData?.id,
          recipientEmail: inviteEmail,
          message: inviteMessage,
          meetingTitle: meetingData?.title,
          scheduledTime: meetingData?.scheduled_time,
          hostName: 'TradeWorks Pro'
        }
      })

      if (error) throw error

      showToast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteMessage('')
      setShowInviteModal(false)
    } catch (error) {
      showToast.error('Failed to send invitation')
      console.error('Invite error:', error)
    } finally {
      setSendingInvite(false)
    }
  }

  const createInstantMeeting = async () => {
    try {
      const instantMeetingId = `instant-${Date.now()}`
      navigate(`/video-meeting/${instantMeetingId}/room`)
      showToast.success('Instant meeting started!')
    } catch (error) {
      showToast.error('Failed to create instant meeting')
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
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

  if (!meetingData) {
    return (
      <div className="text-center py-10">
        <h3 className="text-muted">Meeting not found</h3>
      </div>
    )
  }

  const timeUntilMeeting = new Date(meetingData.scheduled_time).getTime() - Date.now()
  const canJoin = timeUntilMeeting < 15 * 60 * 1000 // Can join 15 minutes before

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="row mb-8">
        <div className="col-12 text-center">
          <img src="/assets/media/logos/tradeworks-logo.png" alt="TradeWorks Pro" className="h-50px mb-4" />
          <h1 className="fs-2x fw-bold text-dark mb-2">{meetingData.title}</h1>
          <p className="text-muted fs-5">
            Scheduled for {new Date(meetingData.scheduled_time).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="row g-6">
        {/* Main Content */}
        <div className="col-lg-8">
          {/* Tech Check */}
          <KTCard className="mb-6">
            <div className="card-header">
              <h3 className="card-title">Tech Check</h3>
            </div>
            <KTCardBody>
              <div className="d-flex align-items-center justify-content-between mb-5">
                <div className="d-flex align-items-center">
                  <i className={`ki-duotone ki-camera fs-2x me-3 text-${cameraWorking ? 'success' : 'danger'}`}>
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <div className="fw-bold">Camera</div>
                    <div className="text-muted fs-7">{cameraWorking ? 'Working properly' : 'Not detected'}</div>
                  </div>
                </div>
                <span className={`badge badge-light-${cameraWorking ? 'success' : 'danger'}`}>
                  {cameraWorking ? 'Ready' : 'Check'}
                </span>
              </div>

              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className={`ki-duotone ki-microphone fs-2x me-3 text-${micWorking ? 'success' : 'danger'}`}>
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <div className="fw-bold">Microphone</div>
                    <div className="text-muted fs-7">{micWorking ? 'Working properly' : 'Not detected'}</div>
                  </div>
                </div>
                <span className={`badge badge-light-${micWorking ? 'success' : 'danger'}`}>
                  {micWorking ? 'Ready' : 'Check'}
                </span>
              </div>

              {!techCheckPassed && (
                <button 
                  className="btn btn-sm btn-light-primary mt-5"
                  onClick={performTechCheck}
                >
                  Re-run Tech Check
                </button>
              )}
            </KTCardBody>
          </KTCard>

          {/* Meeting Agenda */}
          <KTCard className="mb-6">
            <div className="card-header">
              <h3 className="card-title">Meeting Agenda</h3>
              {isHost && (
                <div className="card-toolbar">
                  <button 
                    className="btn btn-sm btn-light-primary"
                    onClick={handleAgendaUpdate}
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
            <KTCardBody>
              <textarea
                className="form-control"
                rows={6}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                readOnly={!isHost}
                placeholder="No agenda set for this meeting"
              />
              <div className="text-muted fs-7 mt-2">
                {isHost ? 'You can edit the agenda. Changes are visible to all participants.' : 'Set by the meeting host'}
              </div>
            </KTCardBody>
          </KTCard>

          {/* Files & Resources */}
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Files & Resources</h3>
              {isHost && (
                <div className="card-toolbar">
                  <label className="btn btn-sm btn-light-primary">
                    <i className="ki-duotone ki-cloud-add fs-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Upload File
                    <input 
                      type="file" 
                      className="d-none" 
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              )}
            </div>
            <KTCardBody>
              {meetingData.files.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <tbody>
                      {meetingData.files.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="ki-duotone ki-file fs-2x text-primary me-3">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <div>
                                <a href={file.url} className="text-dark fw-bold text-hover-primary">
                                  {file.name}
                                </a>
                                <div className="text-muted fs-7">
                                  {formatFileSize(file.size)} • Uploaded {new Date(file.uploaded_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="text-end">
                            <a href={file.url} className="btn btn-sm btn-light-primary">
                              <i className="ki-duotone ki-download fs-3"></i>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted">
                  <i className="ki-duotone ki-file fs-5x mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <p>No files uploaded yet</p>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          {/* Join Meeting Button */}
          <div className="d-grid mb-6">
            <button 
              className="btn btn-primary btn-lg"
              onClick={joinMeeting}
              disabled={!canJoin || !techCheckPassed}
            >
              {!canJoin ? (
                <>
                  <i className="ki-duotone ki-time fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Meeting starts in {Math.ceil(timeUntilMeeting / 60000)} minutes
                </>
              ) : (
                <>
                  <i className="ki-duotone ki-video fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Join Meeting
                </>
              )}
            </button>
            {!techCheckPassed && canJoin && (
              <div className="text-danger text-center mt-2 fs-7">
                Complete tech check to join
              </div>
            )}
          </div>

          {/* Participants */}
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Participants ({meetingData.participants.length})</h3>
              {isHost && (
                <div className="card-toolbar">
                  <button 
                    className="btn btn-sm btn-light-primary"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <i className="ki-duotone ki-send fs-4 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Invite
                  </button>
                </div>
              )}
            </div>
            <KTCardBody className="p-0">
              <div className="scroll-y mh-300px">
                {meetingData.participants.map((participant) => (
                  <div key={participant.id} className="d-flex align-items-center p-5 border-bottom">
                    <div className="symbol symbol-50px me-3">
                      <div className="symbol-label bg-light-primary">
                        <span className="fs-3 fw-bold text-primary">
                          {participant.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-bold">{participant.name}</div>
                      <div className="text-muted fs-7">{participant.email}</div>
                    </div>
                    <span className={`badge badge-light-${
                      participant.status === 'joined' ? 'success' : 
                      participant.status === 'left' ? 'danger' : 'warning'
                    }`}>
                      {participant.status === 'waiting' ? 'In Lobby' : participant.status}
                    </span>
                  </div>
                ))}
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Instant Meeting Button */}
      <div className="row mt-6">
        <div className="col-12 text-center">
          <button 
            className="btn btn-light-primary btn-lg"
            onClick={createInstantMeeting}
          >
            <i className="ki-duotone ki-rocket fs-1 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Start Instant Meeting
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Invite to Meeting</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowInviteModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-5">
                  <label className="form-label required">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="mb-5">
                  <label className="form-label">Personal Message (Optional)</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Add a personal message to the invitation..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </div>
                <div className="bg-light-primary rounded p-4">
                  <h6 className="fw-bold mb-2">Meeting Details</h6>
                  <div className="text-muted fs-7">
                    <div><strong>Title:</strong> {meetingData?.title}</div>
                    <div><strong>Time:</strong> {meetingData && new Date(meetingData.scheduled_time).toLocaleString()}</div>
                    <div><strong>Host:</strong> TradeWorks Pro</div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-light" 
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={sendInvite}
                  disabled={sendingInvite || !inviteEmail.trim()}
                >
                  {sendingInvite ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-send fs-4 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoMeetingLobby