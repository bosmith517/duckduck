import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BookingService } from '../../services/bookingService'
import { BookingLink, TimeSlot, BookingFormData } from '../../../lib/supabase/bookings.types'
import { format, addDays, startOfDay, isSameDay, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { toast } from 'react-toastify'

const PublicBookingPageV2: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [confirmationToken, setConfirmationToken] = useState<string>('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [showEmbedInfo, setShowEmbedInfo] = useState(false)

  useEffect(() => {
    if (slug) {
      loadBookingLink()
    }
  }, [slug])

  useEffect(() => {
    if (bookingLink && selectedDate) {
      loadTimeSlots()
    }
  }, [bookingLink, selectedDate])

  const loadBookingLink = async () => {
    try {
      setLoading(true)
      const link = await BookingService.getBookingLinkBySlug(slug!)
      if (!link) {
        throw new Error('Booking link not found')
      }
      setBookingLink(link)
    } catch (error) {
      console.error('Error loading booking link:', error)
      toast.error('This booking link is not available')
    } finally {
      setLoading(false)
    }
  }

  const loadTimeSlots = async () => {
    if (!bookingLink || !selectedDate) return

    try {
      setLoadingSlots(true)
      const slots = await BookingService.getAvailableTimeSlots(bookingLink.id, selectedDate)
      setTimeSlots(slots)
    } catch (error) {
      console.error('Error loading time slots:', error)
      toast.error('Failed to load available times')
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return
    setSelectedSlot(slot)
    setShowBookingForm(true)
  }

  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!bookingLink || !selectedSlot) return

    try {
      const booking = await BookingService.createBooking(
        bookingLink.id,
        bookingLink.tenant_id,
        selectedSlot.start.toISOString(),
        selectedSlot.end.toISOString(),
        formData
      )
      
      setConfirmationToken(booking.confirmation_token)
      setBookingComplete(true)
      toast.success('Booking confirmed!')
    } catch (error: any) {
      console.error('Error creating booking:', error)
      toast.error(error.message || 'Failed to create booking')
    }
  }

  // Get all days in current month
  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }

  // Get calendar grid (including padding days)
  const getCalendarDays = () => {
    const days = getDaysInMonth()
    const firstDay = days[0]
    const startPadding = getDay(firstDay)
    
    // Add padding days from previous month
    const paddedDays = []
    for (let i = startPadding - 1; i >= 0; i--) {
      paddedDays.push(null)
    }
    
    return [...paddedDays, ...days]
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center bg-light">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (!bookingLink) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <i className="bi bi-exclamation-triangle fs-1 text-warning mb-3 d-block"></i>
          <h3>Booking Link Not Found</h3>
          <p className="text-muted">This booking link may have been removed or is no longer active.</p>
        </div>
      </div>
    )
  }

  if (bookingComplete) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center bg-light">
        <div className="card shadow-sm" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="card-body text-center py-5">
            <div className="mb-4">
              <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                <i className="bi bi-check-lg text-success" style={{ fontSize: '3rem' }}></i>
              </div>
            </div>
            <h3 className="mb-3">Confirmed</h3>
            <p className="text-muted mb-4">
              You are scheduled with {bookingLink.title}
            </p>
            <div className="border rounded p-3 mb-4 text-start">
              <h6 className="mb-3">{bookingLink.title}</h6>
              <div className="d-flex align-items-center text-muted mb-2">
                <i className="bi bi-calendar3 me-2"></i>
                {format(selectedSlot!.start, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="d-flex align-items-center text-muted mb-2">
                <i className="bi bi-clock me-2"></i>
                {format(selectedSlot!.start, 'h:mm a')} - {format(selectedSlot!.end, 'h:mm a')}
              </div>
              <div className="d-flex align-items-center text-muted">
                <i className="bi bi-camera-video me-2"></i>
                Web conferencing details to follow
              </div>
            </div>
            <p className="text-muted small mb-0">
              A calendar invitation has been sent to your email address
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (showBookingForm && selectedSlot) {
    return (
      <div className="min-vh-100 bg-light py-5">
        <div className="container" style={{ maxWidth: '600px' }}>
          <button
            className="btn btn-link text-decoration-none mb-3"
            onClick={() => {
              setShowBookingForm(false)
              setSelectedSlot(null)
            }}
          >
            <i className="bi bi-arrow-left me-2"></i>Back
          </button>
          
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <h5 className="mb-4">{bookingLink.title}</h5>
              
              <div className="border rounded p-3 mb-4">
                <div className="d-flex align-items-center text-muted mb-2">
                  <i className="bi bi-calendar3 me-2"></i>
                  {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="d-flex align-items-center text-muted mb-2">
                  <i className="bi bi-clock me-2"></i>
                  {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                  <span className="ms-2">({bookingLink.duration_minutes} min)</span>
                </div>
                <div className="d-flex align-items-center text-muted">
                  <i className="bi bi-globe me-2"></i>
                  {bookingLink.timezone}
                </div>
              </div>

              <BookingFormV2
                bookingLink={bookingLink}
                selectedSlot={selectedSlot}
                onSubmit={handleBookingSubmit}
                onCancel={() => {
                  setShowBookingForm(false)
                  setSelectedSlot(null)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      <div className="container py-5" style={{ maxWidth: '1200px' }}>
        <div className="row g-4">
          {/* Left side - Info */}
          <div className="col-lg-4">
            <div className="mb-4">
              <button 
                className="btn btn-sm btn-outline-secondary float-end"
                onClick={() => setShowEmbedInfo(!showEmbedInfo)}
              >
                <i className="bi bi-code-slash me-1"></i>Embed
              </button>
              <h2 className="h4 mb-1">{bookingLink.title}</h2>
              <p className="text-muted">{bookingLink.description}</p>
            </div>
            
            <div className="d-flex align-items-center text-muted mb-3">
              <i className="bi bi-clock me-2"></i>
              {bookingLink.duration_minutes} minutes
            </div>
            
            <div className="d-flex align-items-center text-muted mb-3">
              <i className="bi bi-camera-video me-2"></i>
              Web conferencing details provided upon confirmation
            </div>

            <div className="d-flex align-items-center text-muted mb-4">
              <i className="bi bi-globe me-2"></i>
              {bookingLink.timezone}
            </div>

            {showEmbedInfo && (
              <div className="alert alert-info">
                <h6 className="alert-heading">Embed on your website</h6>
                <p className="small mb-2">Add this booking widget to your website:</p>
                <div className="bg-light p-2 rounded mb-2">
                  <code className="small">
                    &lt;iframe src="{window.location.origin}/book/{bookingLink.slug}" width="100%" height="800" frameborder="0"&gt;&lt;/iframe&gt;
                  </code>
                </div>
                <button 
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/book/${bookingLink.slug}" width="100%" height="800" frameborder="0"></iframe>`)
                    toast.success('Embed code copied!')
                  }}
                >
                  Copy embed code
                </button>
              </div>
            )}
          </div>

          {/* Right side - Calendar */}
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-body p-4">
                <h5 className="mb-4">Select a Date & Time</h5>
                
                <div className="row">
                  {/* Calendar */}
                  <div className="col-md-7 mb-4 mb-md-0">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <h6 className="mb-0">{format(currentMonth, 'MMMM yyyy')}</h6>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>

                    <div className="calendar-grid">
                      <div className="row g-0 text-center mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="col">
                            <small className="text-muted fw-semibold">{day}</small>
                          </div>
                        ))}
                      </div>
                      
                      {Array.from({ length: Math.ceil(getCalendarDays().length / 7) }).map((_, weekIndex) => (
                        <div key={weekIndex} className="row g-0">
                          {getCalendarDays().slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
                            <div key={dayIndex} className="col p-1">
                              {day && (
                                <button
                                  className={`btn btn-sm w-100 ${
                                    selectedDate && isSameDay(day, selectedDate)
                                      ? 'btn-primary'
                                      : isToday(day)
                                      ? 'btn-outline-primary'
                                      : 'btn-light'
                                  }`}
                                  onClick={() => handleDateSelect(day)}
                                  disabled={day < startOfDay(new Date())}
                                >
                                  {format(day, 'd')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="col-md-5">
                    {selectedDate ? (
                      <>
                        <h6 className="mb-3">
                          {format(selectedDate, 'EEEE, MMMM d')}
                        </h6>
                        {loadingSlots ? (
                          <div className="text-center py-4">
                            <div className="spinner-border spinner-border-sm text-primary" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                          </div>
                        ) : timeSlots.length === 0 ? (
                          <p className="text-muted text-center py-4">
                            No available times for this date
                          </p>
                        ) : (
                          <div className="time-slots-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {timeSlots.map((slot, index) => (
                              <button
                                key={index}
                                className="btn btn-outline-primary w-100 mb-2 text-start"
                                onClick={() => handleSlotSelect(slot)}
                                disabled={!slot.available}
                              >
                                {format(slot.start, 'h:mm a')}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted text-center py-4">
                        Select a date to see available times
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BookingFormV2Props {
  bookingLink: BookingLink
  selectedSlot: TimeSlot
  onSubmit: (data: BookingFormData) => void
  onCancel: () => void
}

const BookingFormV2: React.FC<BookingFormV2Props> = ({
  bookingLink,
  selectedSlot,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState<BookingFormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(formData)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h6 className="mb-3">Enter Details</h6>

      <div className="mb-3">
        <label className="form-label">Name *</label>
        <input
          type="text"
          className="form-control"
          value={formData.customer_name}
          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Email *</label>
        <input
          type="email"
          className="form-control"
          value={formData.customer_email}
          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Phone Number</label>
        <input
          type="tel"
          className="form-control"
          value={formData.customer_phone}
          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
        />
      </div>

      <div className="mb-4">
        <label className="form-label">Additional Notes</label>
        <textarea
          className="form-control"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Please share anything that will help prepare for our meeting"
        />
      </div>

      <div className="d-grid gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Confirming...
            </>
          ) : (
            'Confirm'
          )}
        </button>
      </div>
    </form>
  )
}

export default PublicBookingPageV2