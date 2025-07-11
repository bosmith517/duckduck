import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { BookingService } from '../../services/bookingService'
import { BookingLink, AvailabilitySchedule } from '../../components/bookings/bookings.types'
import { toast } from 'react-toastify'

const BookingManagementPage: React.FC = () => {
  const { user, userProfile, tenant } = useSupabaseAuth()
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingLink, setEditingLink] = useState<BookingLink | null>(null)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)

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
      setBookingLinks([newLink, ...bookingLinks])
      setShowCreateModal(false)
      toast.success('Booking link created successfully')
    } catch (error) {
      console.error('Error creating booking link:', error)
      toast.error('Failed to create booking link')
    }
  }

  const handleUpdateLink = async (id: string, updates: Partial<BookingLink>) => {
    try {
      const updatedLink = await BookingService.updateBookingLink(id, updates)
      setBookingLinks(bookingLinks.map(link => 
        link.id === id ? updatedLink : link
      ))
      toast.success('Booking link updated')
    } catch (error) {
      console.error('Error updating booking link:', error)
      toast.error('Failed to update booking link')
    }
  }

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking link?')) return

    try {
      await BookingService.deleteBookingLink(id)
      setBookingLinks(bookingLinks.filter(link => link.id !== id))
      toast.success('Booking link deleted')
    } catch (error) {
      console.error('Error deleting booking link:', error)
      toast.error('Failed to delete booking link')
    }
  }

  const getBookingUrl = (slug: string) => {
    return `${window.location.origin}/book/${slug}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Link copied to clipboard')
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
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col">
          <h1 className="h3 mb-0">Booking Links</h1>
          <p className="text-muted">Create and manage your public booking pages</p>
        </div>
        <div className="col-auto">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <i className="bi bi-plus-lg me-2"></i>
            Create Booking Link
          </button>
        </div>
      </div>

      {bookingLinks.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-calendar-plus fs-1 text-muted mb-3 d-block"></i>
            <h5>No booking links yet</h5>
            <p className="text-muted mb-4">Create your first booking link to start accepting appointments</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              Create Your First Link
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {bookingLinks.map(link => (
            <div key={link.id} className="col-12 col-md-6 col-lg-4">
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="card-title mb-0">{link.title}</h5>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={link.is_active}
                        onChange={(e) => handleUpdateLink(link.id, { is_active: e.target.checked })}
                      />
                    </div>
                  </div>
                  
                  {link.description && (
                    <p className="card-text text-muted small">{link.description}</p>
                  )}

                  <div className="mb-3">
                    <div className="d-flex align-items-center text-muted small mb-2">
                      <i className="bi bi-clock me-2"></i>
                      {link.duration_minutes} minutes
                    </div>
                    <div className="d-flex align-items-center text-muted small mb-2">
                      <i className="bi bi-hourglass-split me-2"></i>
                      {link.advance_notice_hours}h advance notice
                    </div>
                    <div className="d-flex align-items-center text-muted small">
                      <i className="bi bi-globe me-2"></i>
                      {link.timezone}
                    </div>
                  </div>

                  <div className="input-group input-group-sm mb-3">
                    <input
                      type="text"
                      className="form-control"
                      value={getBookingUrl(link.slug)}
                      readOnly
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => copyToClipboard(getBookingUrl(link.slug))}
                    >
                      <i className="bi bi-clipboard"></i>
                    </button>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-outline-primary flex-fill"
                      onClick={() => {
                        setEditingLink(link)
                        setShowAvailabilityModal(true)
                      }}
                    >
                      <i className="bi bi-calendar-week me-1"></i>
                      Availability
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary flex-fill"
                      onClick={() => window.open(`/bookings/${link.id}`, '_blank')}
                    >
                      <i className="bi bi-calendar-check me-1"></i>
                      Bookings
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDeleteLink(link.id)}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateBookingLinkModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateLink}
        />
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && editingLink && (
        <AvailabilityModal
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

interface CreateBookingLinkModalProps {
  onClose: () => void
  onSave: (data: any) => void
}

const CreateBookingLinkModal: React.FC<CreateBookingLinkModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    buffer_minutes: 0,
    advance_notice_hours: 24,
    future_days_available: 60,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create Booking Link</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                    min="15"
                    step="15"
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Buffer Time (minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.buffer_minutes}
                    onChange={(e) => setFormData({ ...formData, buffer_minutes: parseInt(e.target.value) })}
                    min="0"
                    step="5"
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Advance Notice (hours)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.advance_notice_hours}
                    onChange={(e) => setFormData({ ...formData, advance_notice_hours: parseInt(e.target.value) })}
                    min="0"
                    required
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Future Availability (days)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.future_days_available}
                    onChange={(e) => setFormData({ ...formData, future_days_available: parseInt(e.target.value) })}
                    min="1"
                    max="365"
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Timezone</label>
                <select
                  className="form-select"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Link
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

interface AvailabilityModalProps {
  bookingLink: BookingLink
  onClose: () => void
}

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({ bookingLink, onClose }) => {
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
          is_active: false
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
          start_time: start_time + ':00',
          end_time: end_time + ':00',
          is_active
        }))

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
        <div className="modal-dialog modal-lg">
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
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Set Availability for {bookingLink.title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <p className="text-muted mb-4">
              Set your regular weekly availability. You can override specific dates later.
            </p>

            {schedules.map((schedule, index) => (
              <div key={index} className="mb-3">
                <div className="row align-items-center">
                  <div className="col-md-3">
                    <div className="form-check">
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
                  </div>
                  <div className="col-md-4">
                    <input
                      type="time"
                      className="form-control"
                      value={schedule.start_time}
                      onChange={(e) => {
                        const updated = [...schedules]
                        updated[index].start_time = e.target.value
                        setSchedules(updated)
                      }}
                      disabled={!schedule.is_active}
                    />
                  </div>
                  <div className="col-md-1 text-center">to</div>
                  <div className="col-md-4">
                    <input
                      type="time"
                      className="form-control"
                      value={schedule.end_time}
                      onChange={(e) => {
                        const updated = [...schedules]
                        updated[index].end_time = e.target.value
                        setSchedules(updated)
                      }}
                      disabled={!schedule.is_active}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Availability
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingManagementPage