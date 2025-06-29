import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface MeetingData {
  id: string
  title: string
  description?: string
  scheduled_time: string
  host_id: string
  agenda: AgendaItem[]
  participants: Participant[]
  files: MeetingFile[]
  status: 'scheduled' | 'in_progress' | 'completed'
}

interface AgendaItem {
  id: string
  title: string
  duration: number
  description?: string
  status: 'upcoming' | 'current' | 'completed'
  progress?: number
}

interface Participant {
  id: string
  name: string
  email: string
  role: 'host' | 'technician' | 'client' | 'viewer'
  status: 'waiting' | 'admitted' | 'joined' | 'left'
  joined_at?: string
  avatar?: string
}

interface MeetingFile {
  id: string
  name: string
  url: string
  size: number
  type: string
  uploaded_at: string
  uploaded_by: string
}

interface TechCheckStatus {
  camera: boolean
  microphone: boolean
  speakers: boolean
  connection: boolean
}

export const PreCallLobby: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>()
  const navigate = useNavigate()
  const { user, userProfile } = useSupabaseAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micLevelRef = useRef<HTMLDivElement>(null)

  const [meeting, setMeeting] = useState<MeetingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [techCheck, setTechCheck] = useState<TechCheckStatus>({
    camera: false,
    microphone: false,
    speakers: false,
    connection: false
  })
  const [selectedCamera, setSelectedCamera] = useState('')
  const [selectedMicrophone, setSelectedMicrophone] = useState('')
  const [selectedSpeakers, setSelectedSpeakers] = useState('')
  const [devices, setDevices] = useState<{
    cameras: MediaDeviceInfo[]
    microphones: MediaDeviceInfo[]
    speakers: MediaDeviceInfo[]
  }>({
    cameras: [],
    microphones: [],
    speakers: []
  })
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [canJoin, setCanJoin] = useState(false)

  useEffect(() => {
    if (meetingId) {
      loadMeetingData()
      initializeDevices()
    }
  }, [meetingId])

  useEffect(() => {
    if (meeting && user) {
      setIsHost(meeting.host_id === user.id)
      checkJoinEligibility()
    }
  }, [meeting, user])

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
          agenda: data.agenda || [],
          participants: data.participants || [],
          files: data.files || []
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

  const initializeDevices = async () => {
    try {
      // Get user media permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      
      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const cameras = devices.filter(device => device.kind === 'videoinput')
      const microphones = devices.filter(device => device.kind === 'audioinput')
      const speakers = devices.filter(device => device.kind === 'audiooutput')

      setDevices({ cameras, microphones, speakers })
      
      // Set default devices
      if (cameras.length > 0) setSelectedCamera(cameras[0].deviceId)
      if (microphones.length > 0) setSelectedMicrophone(microphones[0].deviceId)
      if (speakers.length > 0) setSelectedSpeakers(speakers[0].deviceId)

      setStream(stream)
      setTechCheck(prev => ({ ...prev, camera: true, microphone: true, connection: true }))
      
      // Setup video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Setup audio level monitoring
      setupAudioLevelMonitoring(stream)
      
    } catch (error) {
      console.error('Error accessing media devices:', error)
      showToast.error('Unable to access camera and microphone')
    }
  }

  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const updateLevel = () => {
        if (analyserRef.current && micLevelRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / bufferLength
          const level = (average / 255) * 100
          
          micLevelRef.current.style.height = `${Math.max(level, 2)}%`
          micLevelRef.current.style.backgroundColor = level > 30 ? '#17E1D1' : '#FBAF40'
        }
        requestAnimationFrame(updateLevel)
      }
      
      updateLevel()
    } catch (error) {
      console.error('Error setting up audio monitoring:', error)
    }
  }

  const switchCamera = async (deviceId: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: { deviceId: { exact: selectedMicrophone } }
      })

      setStream(newStream)
      setSelectedCamera(deviceId)
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }

      setupAudioLevelMonitoring(newStream)
    } catch (error) {
      console.error('Error switching camera:', error)
      showToast.error('Failed to switch camera')
    }
  }

  const switchMicrophone = async (deviceId: string) => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCamera } },
        audio: { deviceId: { exact: deviceId } }
      })

      setStream(newStream)
      setSelectedMicrophone(deviceId)
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }

      setupAudioLevelMonitoring(newStream)
    } catch (error) {
      console.error('Error switching microphone:', error)
      showToast.error('Failed to switch microphone')
    }
  }

  const checkJoinEligibility = () => {
    if (!meeting) return

    const scheduledTime = new Date(meeting.scheduled_time).getTime()
    const now = Date.now()
    const timeDiff = scheduledTime - now
    
    // Can join 15 minutes before scheduled time
    const canJoinTime = timeDiff < 15 * 60 * 1000
    const techReady = techCheck.camera && techCheck.microphone && techCheck.connection
    
    setCanJoin(canJoinTime && techReady)
  }

  const joinMeeting = () => {
    if (!canJoin) {
      showToast.error('Unable to join meeting at this time')
      return
    }

    navigate(`/video-meeting/${meetingId}/room`)
  }

  const admitParticipant = async (participantId: string) => {
    // Implementation for host to admit participants
    showToast.success('Participant admitted')
  }

  const formatTimeUntilMeeting = () => {
    if (!meeting) return ''
    
    const scheduledTime = new Date(meeting.scheduled_time).getTime()
    const now = Date.now()
    const timeDiff = scheduledTime - now
    
    if (timeDiff <= 0) return 'Meeting can start now'
    
    const minutes = Math.ceil(timeDiff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `Meeting starts in ${hours}h ${minutes % 60}m`
    }
    return `Meeting starts in ${minutes} minutes`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-4" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="text-muted">Loading meeting...</h4>
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
        <h3 className="text-muted">Meeting not found</h3>
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
    <div className="container-fluid py-6" style={{ backgroundColor: '#121417', minHeight: '100vh' }}>
      {/* Header Bar */}
      <div className="bg-dark bg-opacity-25 rounded p-4 mb-6">
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <i className="ki-duotone ki-video fs-2x text-primary me-3">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <div>
              <h2 className="text-white fw-bold mb-0">{meeting.title}</h2>
              <div className="text-muted fs-6">
                {new Date(meeting.scheduled_time).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center">
            <div className="me-4">
              <div className="badge badge-warning fs-7 fw-bold">
                {formatTimeUntilMeeting()}
              </div>
            </div>
            <button 
              className="btn btn-icon btn-light-secondary text-dark"
              title="Meeting Information"
            >
              <i className="ki-duotone ki-information fs-1">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
            </button>
          </div>
        </div>
      </div>

      <div className="row g-6">
        {/* Left Column - Meeting Hub */}
        <div className="col-lg-9">
          {/* Agenda Cards */}
          {meeting.agenda && meeting.agenda.length > 0 && (
            <div className="card bg-dark border-secondary mb-6">
              <div className="card-header border-secondary">
                <h4 className="text-white fw-bold mb-0">Meeting Agenda</h4>
              </div>
              <div className="card-body p-0">
                {meeting.agenda.map((item, index) => (
                  <div 
                    key={item.id} 
                    className="border-bottom border-secondary p-4 hover-bg-secondary cursor-pointer"
                  >
                    <div className="d-flex align-items-center">
                      <div className="position-relative me-4">
                        <div className={`w-4px h-50px ${item.status === 'current' ? 'bg-warning' : 'bg-primary'} rounded`}></div>
                        <div className="badge badge-circle badge-primary position-absolute top-0 start-50 translate-middle">
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-grow-1">
                        <h5 className="text-white fw-bold mb-1">{item.title}</h5>
                        <div className="d-flex align-items-center text-muted">
                          <i className="ki-duotone ki-time fs-6 me-1">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <span className="fs-7">{item.duration} minutes</span>
                          {item.description && (
                            <>
                              <span className="mx-2">•</span>
                              <span className="fs-7">{item.description}</span>
                            </>
                          )}
                        </div>
                        {item.status === 'current' && (
                          <div className="progress mt-2" style={{ height: '2px' }}>
                            <div 
                              className="progress-bar bg-warning" 
                              style={{ width: `${item.progress || 0}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Library */}
          <div className="card bg-dark border-secondary">
            <div className="card-header border-secondary">
              <h4 className="text-white fw-bold mb-0">Files & Resources</h4>
            </div>
            <div className="card-body">
              {meeting.files && meeting.files.length > 0 ? (
                <div className="row g-4">
                  {meeting.files.map((file) => (
                    <div key={file.id} className="col-md-6 col-lg-4">
                      <div className="card bg-secondary border-0 hover-scale cursor-pointer">
                        <div className="card-body text-center p-4">
                          <i className="ki-duotone ki-file-text fs-3x text-primary mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <h6 className="text-white fw-bold mb-1">{file.name}</h6>
                          <div className="text-muted fs-7 mb-3">{formatFileSize(file.size)}</div>
                          <button className="btn btn-sm btn-primary">
                            <i className="ki-duotone ki-down fs-4">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <i className="ki-duotone ki-file fs-5x text-muted mb-4">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <p className="text-muted">No files shared for this meeting</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Participant & Tech Hub */}
        <div className="col-lg-3">
          {/* Tech Check Widget */}
          <div className="card bg-dark border-secondary mb-6">
            <div className="card-header border-secondary">
              <h5 className="text-white fw-bold mb-0">Tech Check</h5>
            </div>
            <div className="card-body">
              {/* Video Preview */}
              <div className="position-relative mb-4">
                <video 
                  ref={videoRef}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-100 rounded"
                  style={{ aspectRatio: '16/9', backgroundColor: '#2B2E33' }}
                />
                <div className="position-absolute bottom-0 start-0 end-0 p-3">
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="bg-dark bg-opacity-50 rounded p-1 me-2">
                        <div 
                          className="bg-secondary rounded"
                          style={{ width: '3px', height: '20px', position: 'relative' }}
                        >
                          <div 
                            ref={micLevelRef}
                            className="position-absolute bottom-0 start-0 w-100 rounded transition-all"
                            style={{ height: '2%', backgroundColor: '#17E1D1' }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-white fs-7">Mic Level</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Selectors */}
              <div className="mb-3">
                <label className="text-white fs-7 mb-1">Camera</label>
                <select 
                  className="form-select form-select-sm bg-secondary border-0 text-white"
                  value={selectedCamera}
                  onChange={(e) => switchCamera(e.target.value)}
                >
                  {devices.cameras.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${devices.cameras.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="text-white fs-7 mb-1">Microphone</label>
                <select 
                  className="form-select form-select-sm bg-secondary border-0 text-white"
                  value={selectedMicrophone}
                  onChange={(e) => switchMicrophone(e.target.value)}
                >
                  {devices.microphones.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${devices.microphones.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="text-white fs-7 mb-1">Speakers</label>
                <select 
                  className="form-select form-select-sm bg-secondary border-0 text-white"
                  value={selectedSpeakers}
                  onChange={(e) => setSelectedSpeakers(e.target.value)}
                >
                  {devices.speakers.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Speakers ${devices.speakers.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Indicators */}
              <div className="space-y-2">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-white fs-7">Camera</span>
                  <div className={`badge ${techCheck.camera ? 'badge-success' : 'badge-danger'}`}>
                    {techCheck.camera ? 'Ready' : 'Check'}
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-white fs-7">Microphone</span>
                  <div className={`badge ${techCheck.microphone ? 'badge-success' : 'badge-danger'}`}>
                    {techCheck.microphone ? 'Ready' : 'Check'}
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-white fs-7">Connection</span>
                  <div className={`badge ${techCheck.connection ? 'badge-success' : 'badge-warning'}`}>
                    {techCheck.connection ? 'Good' : 'Testing'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Participants List */}
          <div className="card bg-dark border-secondary mb-6">
            <div className="card-header border-secondary">
              <h5 className="text-white fw-bold mb-0">
                Participants ({meeting.participants ? meeting.participants.length : 0})
              </h5>
            </div>
            <div className="card-body p-0">
              {meeting.participants && meeting.participants.length > 0 ? (
                meeting.participants.map((participant) => (
                  <div key={participant.id} className="d-flex align-items-center p-4 border-bottom border-secondary">
                    <div className="symbol symbol-35px me-3">
                      {participant.avatar ? (
                        <img src={participant.avatar} alt={participant.name} />
                      ) : (
                        <div className="symbol-label bg-primary">
                          <span className="fs-6 fw-bold text-white">
                            {participant.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow-1">
                      <div className="text-white fw-semibold">{participant.name}</div>
                      <div className="text-muted fs-7">{participant.role}</div>
                    </div>
                    <div className="d-flex align-items-center">
                      <div className={`badge ${
                        participant.status === 'joined' ? 'badge-success' : 
                        participant.status === 'admitted' ? 'badge-warning' : 
                        participant.status === 'left' ? 'badge-danger' : 'badge-secondary'
                      }`}>
                        {participant.status === 'waiting' ? 'In Lobby' : participant.status}
                      </div>
                      {isHost && participant.status === 'waiting' && (
                        <button 
                          className="btn btn-sm btn-primary ms-2"
                          onClick={() => admitParticipant(participant.id)}
                        >
                          Admit
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted">No participants yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Join Meeting CTA */}
          <div className="d-grid">
            <button 
              className={`btn btn-lg ${canJoin ? 'btn-primary' : 'btn-secondary'}`}
              onClick={joinMeeting}
              disabled={!canJoin}
            >
              {canJoin ? (
                <>
                  <i className="ki-duotone ki-entrance-right fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Join Meeting
                </>
              ) : (
                <>
                  <i className="ki-duotone ki-time fs-1 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Tech Check Required
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreCallLobby