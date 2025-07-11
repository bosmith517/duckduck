import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { BookingService } from '../../services/bookingService'
import { BookingLink, AvailabilitySchedule } from '../../components/bookings/bookings.types'
import { toast } from 'react-toastify'

const BookingManagementPageV2: React.FC = () => {
  const { user, userProfile, tenant } = useSupabaseAuth()
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingLink, setEditingLink] = useState<BookingLink | null>(null)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [activeTab, setActiveTab] = useState('event-types')

  useEffect(() => {
    if (user) {
      loadBookingLinks()
    }
  }, [user])

  const loadBookingLinks = async () => {
    try {
      setLoading(true)
      const links = await BookingService.getUserBookingLinks(user!.id)
      setBookingLinks(links)
    } catch (error) {
      console.error('Error loading booking links:', error)
      toast.error('Failed to load booking links')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLink = async (data: any) => {
    try {
      const newLink = await BookingService.createBookingLink(
        data,
        user!.id,
        tenant!.id
      )
      
      // Set default availability (Mon-Fri 9-5)
      const defaultSchedules = [
        { day_of_week: 1, start_time: '09:00:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 2, start_time: '09:00:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 3, start_time: '09:00:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 4, start_time: '09:00:00', end_time: '17:00:00', is_active: true },
        { day_of_week: 5, start_time: '09:00:00', end_time: '17:00:00', is_active: true }
      ]
      
      await BookingService.updateAvailabilitySchedules(newLink.id, defaultSchedules)
      
      setBookingLinks([newLink, ...bookingLinks])
      setShowCreateModal(false)
      toast.success('Event type created! Default hours set to Mon-Fri 9-5. Click "Set Hours" to customize.')
    } catch (error) {
      console.error('Error creating booking link:', error)
      toast.error('Failed to create event type')
    }
  }

  const handleUpdateLink = async (id: string, updates: Partial<BookingLink>) => {
    try {
      const updatedLink = await BookingService.updateBookingLink(id, updates)
      setBookingLinks(bookingLinks.map(link => 
        link.id === id ? updatedLink : link
      ))
      toast.success('Event type updated')
    } catch (error) {
      console.error('Error updating booking link:', error)
      toast.error('Failed to update event type')
    }
  }

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event type?')) return

    try {
      await BookingService.deleteBookingLink(id)
      setBookingLinks(bookingLinks.filter(link => link.id !== id))
      toast.success('Event type deleted')
    } catch (error) {
      console.error('Error deleting booking link:', error)
      toast.error('Failed to delete event type')
    }
  }

  const getBookingUrl = (slug: string) => {
    return `${window.location.origin}/book/${slug}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Link copied!')
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f8f8' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#f8f8f8', minHeight: '100vh' }}>
      {/* Header */}
      <div className="bg-white border-bottom">
        <div className="container-fluid px-4 py-3">
          <div className="row align-items-center">
            <div className="col">
              <h4 className="mb-0 fw-semibold">My TradeWorks</h4>
            </div>
            <div className="col-auto">
              <div className="d-flex align-items-center gap-3">
                <span className="text-muted">{userProfile?.email}</span>
                <button className="btn btn-sm btn-outline-secondary">
                  <i className="bi bi-gear me-1"></i>Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid px-4 py-4">
        <div className="row">
          {/* Sidebar */}
          <div className="col-md-3">
            <div className="bg-white rounded-3 shadow-sm p-0 mb-4">
              <div className="list-group list-group-flush">
                <button 
                  className={`list-group-item list-group-item-action border-0 py-3 ${activeTab === 'event-types' ? 'active' : ''}`}
                  onClick={() => setActiveTab('event-types')}
                >
                  <i className="bi bi-calendar-event me-2"></i>Event Types
                </button>
                <button 
                  className={`list-group-item list-group-item-action border-0 py-3 ${activeTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('bookings')}
                >
                  <i className="bi bi-calendar-check me-2"></i>Scheduled Events
                </button>
                <button 
                  className={`list-group-item list-group-item-action border-0 py-3 ${activeTab === 'availability' ? 'active' : ''}`}
                  onClick={() => setActiveTab('availability')}
                >
                  <i className="bi bi-clock me-2"></i>Availability
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3 shadow-sm p-3">
              <h6 className="text-muted mb-3">YOUR BOOKING PAGES</h6>
              <p className="small text-muted mb-3">
                Create multiple booking pages for different services, durations, or team members.
              </p>
              {bookingLinks.length > 0 && (
                <div className="mb-3">
                  <label className="form-label small text-muted">Share a link:</label>
                  <select 
                    className="form-select form-select-sm mb-2"
                    onChange={(e) => e.target.value && copyToClipboard(e.target.value)}
                  >
                    <option value="">Select a booking page...</option>
                    {bookingLinks.map(link => (
                      <option key={link.id} value={getBookingUrl(link.slug)}>
                        {link.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button 
                className="btn btn-sm btn-primary w-100"
                onClick={() => setShowCreateModal(true)}
              >
                <i className="bi bi-plus-circle me-1"></i>Create New Booking Page
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-md-9">
            {activeTab === 'event-types' && (
              <div className="bg-white rounded-3 shadow-sm p-4">
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h5 className="mb-1">Event Types</h5>
                      <p className="text-muted mb-0">Create multiple booking pages for different services or durations.</p>
                    </div>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <i className="bi bi-plus-lg me-2"></i>New Event Type
                    </button>
                  </div>
                  
                  {/* Examples section */}
                  {bookingLinks.length === 0 && (
                    <div className="alert alert-info">
                      <h6 className="alert-heading">Examples of booking pages you can create:</h6>
                      <ul className="mb-0">
                        <li><strong>Initial Consultation</strong> - 30 min free consultation</li>
                        <li><strong>Service Estimate</strong> - 60 min on-site evaluation</li>
                        <li><strong>Emergency Service</strong> - Same-day appointments</li>
                        <li><strong>Follow-up Call</strong> - 15 min phone check-in</li>
                      </ul>
                    </div>
                  )}
                </div>

                {bookingLinks.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="mb-4">
                      <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                        <i className="bi bi-calendar-plus fs-1 text-muted"></i>
                      </div>
                    </div>
                    <h6>Create your first event type</h6>
                    <p className="text-muted mb-4">Event types enable you to share links that show available times on your calendar and allow people to make bookings with you.</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <i className="bi bi-plus-lg me-2"></i>New Event Type
                    </button>
                  </div>
                ) : (
                  <div>
                    {bookingLinks.map(link => (
                      <div key={link.id} className="border rounded-3 p-4 mb-3 position-relative">
                        <div className="row align-items-center">
                          <div className="col">
                            <div className="d-flex align-items-start">
                              <div className="form-check form-switch me-3">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={link.is_active}
                                  onChange={(e) => handleUpdateLink(link.id, { is_active: e.target.checked })}
                                  style={{ width: '40px', height: '20px' }}
                                />
                              </div>
                              <div className="flex-grow-1">
                                <h6 className="mb-1">
                                  <a href={`/bookings/${link.id}`} className="text-decoration-none text-dark">
                                    {link.title}
                                  </a>
                                </h6>
                                <div className="text-muted small mb-2">{link.description}</div>
                                <div className="d-flex align-items-center gap-3 text-muted small">
                                  <span><i className="bi bi-clock me-1"></i>{link.duration_minutes} min</span>
                                  <span><i className="bi bi-camera-video me-1"></i>Video call</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="col-auto">
                            <div className="d-flex align-items-center gap-2">
                              <button
                                className="btn btn-sm btn-light"
                                onClick={() => copyToClipboard(getBookingUrl(link.slug))}
                              >
                                <i className="bi bi-link-45deg"></i>
                              </button>
                              <div className="dropdown">
                                <button
                                  className="btn btn-sm btn-light"
                                  data-bs-toggle="dropdown"
                                >
                                  <i className="bi bi-gear"></i>
                                </button>
                                <ul className="dropdown-menu">
                                  <li>
                                    <button 
                                      className="dropdown-item"
                                      onClick={() => {
                                        setEditingLink(link)
                                        setShowCreateModal(true)
                                      }}
                                    >
                                      <i className="bi bi-pencil me-2"></i>Edit Event
                                    </button>
                                  </li>
                                  <li>
                                    <button 
                                      className="dropdown-item"
                                      onClick={() => {
                                        setEditingLink(link)
                                        setShowAvailabilityModal(true)
                                      }}
                                    >
                                      <i className="bi bi-clock me-2"></i>Set Hours
                                    </button>
                                  </li>
                                  <li><hr className="dropdown-divider" /></li>
                                  <li>
                                    <button 
                                      className="dropdown-item text-danger"
                                      onClick={() => handleDeleteLink(link.id)}
                                    >
                                      <i className="bi bi-trash me-2"></i>Delete
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="bg-white rounded-3 shadow-sm p-4">
                <h5 className="mb-4">Scheduled Events</h5>
                <div className="text-center py-5">
                  <div className="mb-4">
                    <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                      <i className="bi bi-calendar-check fs-1 text-muted"></i>
                    </div>
                  </div>
                  <h6>No upcoming bookings</h6>
                  <p className="text-muted">When people book time with you, it will appear here.</p>
                </div>
              </div>
            )}

            {activeTab === 'availability' && (
              <div className="bg-white rounded-3 shadow-sm p-4">
                <h5 className="mb-4">Availability</h5>
                <p className="text-muted">Configure your general availability across all event types.</p>
                <button className="btn btn-outline-primary">
                  <i className="bi bi-clock me-2"></i>Set Availability
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateEventTypeModal
          bookingLink={editingLink}
          onClose={() => {
            setShowCreateModal(false)
            setEditingLink(null)
          }}
          onSave={async (data) => {
            if (editingLink) {
              await handleUpdateLink(editingLink.id, data)
              setEditingLink(null)
            } else {
              await handleCreateLink(data)
            }
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && editingLink && (
        <AvailabilityModalV2
          bookingLink={editingLink}
          onClose={() => {
            setShowAvailabilityModal(false)
            setEditingLink(null)
          }}
        />
      )}
    </div>
  )
}

interface CreateEventTypeModalProps {
  bookingLink?: BookingLink | null
  onClose: () => void
  onSave: (data: any) => void
}

const CreateEventTypeModal: React.FC<CreateEventTypeModalProps> = ({ bookingLink, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: bookingLink?.title || '',
    description: bookingLink?.description || '',
    duration_minutes: bookingLink?.duration_minutes || 30,
    buffer_minutes: bookingLink?.buffer_minutes || 0,
    advance_notice_hours: bookingLink?.advance_notice_hours || 24,
    future_days_available: bookingLink?.future_days_available || 60,
    timezone: bookingLink?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-0">
            <h5 className="modal-title">{bookingLink ? 'Edit Event Type' : 'Create New Event Type'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label fw-semibold">Event name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Quick Meeting"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Description (optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="A quick meeting to discuss your project"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Duration</label>
                <select
                  className="form-select"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Location</label>
                <select className="form-select">
                  <option>Video call (Link will be provided)</option>
                  <option>Phone call</option>
                  <option>In-person meeting</option>
                </select>
              </div>
            </div>
            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {bookingLink ? 'Save Changes' : 'Create Event Type'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

interface AvailabilityModalV2Props {
  bookingLink: BookingLink
  onClose: () => void
}

const AvailabilityModalV2: React.FC<AvailabilityModalV2Props> = ({ bookingLink, onClose }) => {
  const [schedules, setSchedules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    try {
      const data = await BookingService.getAvailabilitySchedules(bookingLink.id)
      
      // Initialize schedules for all days
      const allSchedules = daysOfWeek.map((day, index) => {
        const existing = data.find(s => s.day_of_week === index)
        return existing || {
          day_of_week: index,
          start_time: '09:00',
          end_time: '17:00',
          is_active: index >= 1 && index <= 5 // Mon-Fri by default
        }
      })
      
      setSchedules(allSchedules)
    } catch (error) {
      console.error('Error loading schedules:', error)
      toast.error('Failed to load availability')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const activeSchedules = schedules
        .filter(s => s.is_active)
        .map(({ day_of_week, start_time, end_time, is_active }) => ({
          day_of_week,
          start_time: start_time.includes(':') ? start_time + (start_time.split(':').length === 2 ? ':00' : '') : start_time,
          end_time: end_time.includes(':') ? end_time + (end_time.split(':').length === 2 ? ':00' : '') : end_time,
          is_active: true // Ensure this is always true for active schedules
        }))

      console.log('Saving schedules:', activeSchedules)
      await BookingService.updateAvailabilitySchedules(bookingLink.id, activeSchedules)
      toast.success('Availability updated')
      onClose()
    } catch (error) {
      console.error('Error saving schedules:', error)
      toast.error('Failed to save availability')
    }
  }

  if (loading) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-0">
            <h5 className="modal-title">Edit {bookingLink.title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <h6 className="mb-3">Weekly hours</h6>
            <div className="bg-light rounded-3 p-3">
              {schedules.map((schedule, index) => (
                <div key={index} className="d-flex align-items-center py-2">
                  <div className="form-check form-switch" style={{ width: '150px' }}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={schedule.is_active}
                      onChange={(e) => {
                        const updated = [...schedules]
                        updated[index].is_active = e.target.checked
                        setSchedules(updated)
                      }}
                    />
                    <label className="form-check-label">
                      {daysOfWeek[schedule.day_of_week]}
                    </label>
                  </div>
                  {schedule.is_active ? (
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        style={{ width: '120px' }}
                        value={schedule.start_time}
                        onChange={(e) => {
                          const updated = [...schedules]
                          updated[index].start_time = e.target.value
                          setSchedules(updated)
                        }}
                      />
                      <span className="text-muted">–</span>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        style={{ width: '120px' }}
                        value={schedule.end_time}
                        onChange={(e) => {
                          const updated = [...schedules]
                          updated[index].end_time = e.target.value
                          setSchedules(updated)
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-muted">Unavailable</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-light" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingManagementPageV2