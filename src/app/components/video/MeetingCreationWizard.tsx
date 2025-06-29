import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface Participant {
  id: string
  name: string
  email: string
  role: 'host' | 'technician' | 'client' | 'viewer'
  avatar?: string
}

interface Integration {
  id: string
  name: string
  icon: string
  enabled: boolean
}

interface AgendaItem {
  id: string
  title: string
  duration: number
  description?: string
}

export const MeetingCreationWizard: React.FC = () => {
  const navigate = useNavigate()
  const { user, userProfile } = useSupabaseAuth()
  
  const [title, setTitle] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [description, setDescription] = useState('')
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [participantEmail, setParticipantEmail] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [integrations] = useState<Integration[]>([
    { id: 'gdrive', name: 'Google Drive', icon: 'folder', enabled: false },
    { id: 'miro', name: 'Miro', icon: 'layout', enabled: false },
    { id: 'figma', name: 'Figma', icon: 'figma', enabled: false },
    { id: 'whiteboard', name: 'Jitsi Whiteboard', icon: 'edit-3', enabled: false },
    { id: 'dropbox', name: 'Dropbox', icon: 'cloud', enabled: false },
    { id: 'slack', name: 'Slack', icon: 'message-circle', enabled: false },
    { id: 'asana', name: 'Asana', icon: 'check-circle', enabled: false },
    { id: 'trello', name: 'Trello', icon: 'trello', enabled: false },
    { id: 'notion', name: 'Notion', icon: 'book-open', enabled: false }
  ])

  const addParticipant = () => {
    if (!participantEmail.trim()) return

    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: participantEmail.split('@')[0],
      email: participantEmail.trim(),
      role: 'viewer'
    }

    setParticipants(prev => [...prev, newParticipant])
    setParticipantEmail('')
  }

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  const updateParticipantRole = (id: string, role: Participant['role']) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, role } : p))
  }

  const addAgendaItem = () => {
    const newItem: AgendaItem = {
      id: Date.now().toString(),
      title: `Agenda Item ${agenda.length + 1}`,
      duration: 15,
      description: ''
    }
    setAgenda(prev => [...prev, newItem])
  }

  const updateAgendaItem = (id: string, field: keyof AgendaItem, value: any) => {
    setAgenda(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeAgendaItem = (id: string) => {
    setAgenda(prev => prev.filter(item => item.id !== id))
  }

  const toggleIntegration = (id: string) => {
    // For now, just show that it's selected
    showToast.info(`${integrations.find(i => i.id === id)?.name} integration coming soon`)
  }

  const createMeeting = async () => {
    if (!title.trim() || !selectedDate || !selectedTime) {
      showToast.error('Please fill in all required fields')
      return
    }

    setIsCreating(true)
    try {
      const scheduledTime = new Date(`${selectedDate}T${selectedTime}`)
      
      const meetingData = {
        title: title.trim(),
        description,
        scheduled_time: scheduledTime.toISOString(),
        host_id: user?.id,
        company_id: userProfile?.tenant_id,
        agenda: agenda,
        participants: participants,
        status: 'scheduled'
      }

      const { data, error } = await supabase
        .from('video_meetings')
        .insert(meetingData)
        .select()
        .single()

      if (error) throw error

      showToast.success('Meeting created successfully!')
      
      // Send invitations to participants
      if (participants.length > 0) {
        const { error: inviteError } = await supabase.functions.invoke('send-meeting-invites', {
          body: {
            meetingId: data.id,
            participants: participants,
            meetingTitle: title,
            scheduledTime: scheduledTime.toISOString(),
            hostName: `${userProfile?.first_name} ${userProfile?.last_name}`
          }
        })

        if (inviteError) {
          console.error('Failed to send invites:', inviteError)
          showToast.warning('Meeting created but failed to send some invitations')
        }
      }

      navigate(`/video-meeting/${data.id}/lobby`)
    } catch (error) {
      console.error('Error creating meeting:', error)
      showToast.error('Failed to create meeting')
    } finally {
      setIsCreating(false)
    }
  }

  const getRoleColor = (role: Participant['role']) => {
    switch (role) {
      case 'host': return 'bg-primary'
      case 'technician': return 'bg-info'
      case 'client': return 'bg-warning'
      case 'viewer': return 'bg-secondary'
      default: return 'bg-secondary'
    }
  }

  const formatDateTime = () => {
    if (!selectedDate || !selectedTime) return ''
    const date = new Date(`${selectedDate}T${selectedTime}`)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="container-fluid py-6">
      {/* Header Ribbon */}
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
            <h1 className="fs-2x fw-bold text-dark mb-0">Schedule a Meeting</h1>
            <div className="text-muted fs-6">
              <span className="text-hover-primary cursor-pointer" onClick={() => navigate('/dashboard')}>
                Dashboard
              </span>
              <span className="mx-2">•</span>
              <span>Video Meetings</span>
              <span className="mx-2">•</span>
              <span className="text-primary">New Meeting</span>
            </div>
          </div>
        </div>
        <button 
          className="btn btn-icon btn-light"
          onClick={() => navigate('/communications/video')}
        >
          <i className="ki-duotone ki-cross fs-1">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
        </button>
      </div>

      {/* Core Form */}
      <div className="row justify-content-center">
        <div className="col-xxl-10">
          <div className="card shadow-sm">
            <div className="card-body p-8">
              <div className="row g-8">
                {/* Left Column - Form Fields */}
                <div className="col-lg-8">
                  {/* Meeting Title */}
                  <div className="mb-6">
                    <label className="form-label fs-4 fw-bold text-dark">Meeting Title</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Kitchen Remodel Kick-off"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  {/* Date and Time */}
                  <div className="row g-4 mb-6">
                    <div className="col-md-6">
                      <label className="form-label fs-5 fw-semibold text-dark">Date</label>
                      <input
                        type="date"
                        className="form-control form-control-lg"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fs-5 fw-semibold text-dark">Time</label>
                      <input
                        type="time"
                        className="form-control form-control-lg"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Scheduled Time Preview */}
                  {selectedDate && selectedTime && (
                    <div className="alert alert-light-primary mb-6">
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-calendar fs-2x text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="fw-bold text-dark">Scheduled for:</div>
                          <div className="text-primary fs-5 fw-semibold">{formatDateTime()}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-6">
                    <label className="form-label fs-5 fw-semibold text-dark">Description</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Brief description of the meeting purpose and goals..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  {/* Participants */}
                  <div className="mb-6">
                    <label className="form-label fs-5 fw-semibold text-dark">Participants</label>
                    
                    {/* Add Participant */}
                    <div className="d-flex mb-4">
                      <input
                        type="email"
                        className="form-control me-3"
                        placeholder="Enter email address"
                        value={participantEmail}
                        onChange={(e) => setParticipantEmail(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
                      />
                      <button 
                        className="btn btn-primary"
                        onClick={addParticipant}
                        disabled={!participantEmail.trim()}
                      >
                        <i className="ki-duotone ki-plus fs-3"></i>
                        Add
                      </button>
                    </div>

                    {/* Participant List */}
                    <div className="d-flex flex-wrap gap-3">
                      {participants.map((participant) => (
                        <div key={participant.id} className="d-flex align-items-center bg-light rounded p-3">
                          <div className={`symbol symbol-35px me-3`}>
                            <div className={`symbol-label ${getRoleColor(participant.role)}`}>
                              <span className="fs-6 fw-bold text-white">
                                {participant.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-grow-1 me-3">
                            <div className="fw-semibold text-dark">{participant.name}</div>
                            <div className="text-muted fs-7">{participant.email}</div>
                          </div>
                          <select 
                            className="form-select form-select-sm w-auto me-2"
                            value={participant.role}
                            onChange={(e) => updateParticipantRole(participant.id, e.target.value as Participant['role'])}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="client">Client</option>
                            <option value="technician">Technician</option>
                            <option value="host">Host</option>
                          </select>
                          <button 
                            className="btn btn-icon btn-sm btn-light-danger"
                            onClick={() => removeParticipant(participant.id)}
                          >
                            <i className="ki-duotone ki-cross fs-3">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Agenda */}
                  <div className="mb-6">
                    <div className="d-flex align-items-center justify-content-between mb-4">
                      <label className="form-label fs-5 fw-semibold text-dark mb-0">Agenda</label>
                      <button className="btn btn-sm btn-light-primary" onClick={addAgendaItem}>
                        <i className="ki-duotone ki-plus fs-4"></i>
                        Add Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {agenda.map((item, index) => (
                        <div key={item.id} className="card bg-light border-0">
                          <div className="card-body p-4">
                            <div className="d-flex align-items-start">
                              <div className="badge badge-circle badge-primary me-3 mt-1">
                                {index + 1}
                              </div>
                              <div className="flex-grow-1">
                                <div className="row g-3">
                                  <div className="col-md-8">
                                    <input
                                      type="text"
                                      className="form-control"
                                      placeholder="Agenda item title"
                                      value={item.title}
                                      onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-md-4">
                                    <div className="input-group">
                                      <input
                                        type="number"
                                        className="form-control"
                                        placeholder="15"
                                        value={item.duration}
                                        onChange={(e) => updateAgendaItem(item.id, 'duration', parseInt(e.target.value) || 0)}
                                        min="1"
                                        max="120"
                                      />
                                      <span className="input-group-text">min</span>
                                    </div>
                                  </div>
                                </div>
                                <textarea
                                  className="form-control mt-3"
                                  rows={2}
                                  placeholder="Optional description..."
                                  value={item.description || ''}
                                  onChange={(e) => updateAgendaItem(item.id, 'description', e.target.value)}
                                />
                              </div>
                              <button 
                                className="btn btn-icon btn-sm btn-light-danger ms-3"
                                onClick={() => removeAgendaItem(item.id)}
                              >
                                <i className="ki-duotone ki-trash fs-4">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                  <span className="path3"></span>
                                  <span className="path4"></span>
                                  <span className="path5"></span>
                                </i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Integrations Grid */}
                  <div className="mb-8">
                    <label className="form-label fs-5 fw-semibold text-dark mb-4">Integrations</label>
                    <div className="row g-3">
                      {integrations.map((integration) => (
                        <div key={integration.id} className="col-md-4">
                          <div 
                            className={`card cursor-pointer hover-scale ${integration.enabled ? 'border-primary bg-light-primary' : 'border-light'}`}
                            onClick={() => toggleIntegration(integration.id)}
                          >
                            <div className="card-body text-center p-4">
                              <i className={`ki-duotone ki-${integration.icon} fs-2x ${integration.enabled ? 'text-primary' : 'text-muted'} mb-2`}>
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <div className={`fw-semibold ${integration.enabled ? 'text-primary' : 'text-dark'}`}>
                                {integration.name}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - AI Assist Panel (Placeholder for now) */}
                <div className="col-lg-4">
                  <div className="card bg-light-info border-0 h-100">
                    <div className="card-body p-6 text-center">
                      <i className="ki-duotone ki-abstract-26 fs-5x text-info mb-4">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <h4 className="fw-bold text-dark mb-3">AI Assistant</h4>
                      <p className="text-muted mb-4">
                        AI-powered meeting assistance will help you create agendas, 
                        generate descriptions, and optimize your meeting structure.
                      </p>
                      <div className="alert alert-warning">
                        <i className="ki-duotone ki-information fs-2 text-warning me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        Coming Soon
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="card-footer d-flex justify-content-between align-items-center p-6">
              <button 
                className="btn btn-light btn-lg"
                onClick={() => navigate('/communications/video')}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary btn-lg"
                onClick={createMeeting}
                disabled={isCreating || !title.trim() || !selectedDate || !selectedTime}
              >
                {isCreating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="ki-duotone ki-send fs-3 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Save & Send Invites
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeetingCreationWizard