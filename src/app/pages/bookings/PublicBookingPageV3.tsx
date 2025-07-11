import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BookingService } from '../../services/bookingService'
import { BookingLink, TimeSlot, BookingFormData } from '../../../lib/supabase/bookings.types'
import { format, addDays, startOfDay, isSameDay, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isBefore } from 'date-fns'
import { toast } from 'react-toastify'
import './booking-page.css'

const PublicBookingPageV3: React.FC = () => {
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
      <div className="min-vh-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: '#f8f9fa' }}>
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
      <div className="min-vh-100 d-flex align-items-center" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="text-center">
                <div className="mb-4">
                  <div className="rounded-circle bg-success d-inline-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-check-lg text-white" style={{ fontSize: '3rem' }}></i>
                  </div>
                </div>
                <h2 className="mb-3">Booking Confirmed!</h2>
                <p className="lead mb-4">Thank you for booking with us.</p>
                <div className="card mb-4">
                  <div className="card-body">
                    <h5 className="card-title mb-3">{bookingLink.title}</h5>
                    <p className="mb-2">
                      <i className="bi bi-calendar3 me-2 text-primary"></i>
                      {format(selectedSlot!.start, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="mb-2">
                      <i className="bi bi-clock me-2 text-primary"></i>
                      {format(selectedSlot!.start, 'h:mm a')} - {format(selectedSlot!.end, 'h:mm a')}
                    </p>
                    <p className="mb-0">
                      <i className="bi bi-pin-map me-2 text-primary"></i>
                      We'll contact you with location details
                    </p>
                  </div>
                </div>
                <p className="text-muted">A confirmation email has been sent to your email address.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="container py-4">
          <div className="row align-items-center">
            <div className="col">
              <h2 className="mb-0">{bookingLink.title}</h2>
              {bookingLink.description && (
                <p className="text-muted mb-0 mt-2">{bookingLink.description}</p>
              )}
            </div>
            <div className="col-auto">
              <div className="d-flex align-items-center text-muted">
                <i className="bi bi-clock me-2"></i>
                <span>{bookingLink.duration_minutes} minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-5">
        <div className="row g-4">
          {/* Calendar Section */}
          <div className="col-lg-7">
            <div className="card shadow-sm">
              <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <button
                    className="btn btn-link text-decoration-none p-0"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                    disabled={isBefore(endOfMonth(addMonths(currentMonth, -1)), new Date())}
                  >
                    <i className="bi bi-chevron-left fs-5"></i>
                  </button>
                  <h5 className="mb-0">{format(currentMonth, 'MMMM yyyy')}</h5>
                  <button
                    className="btn btn-link text-decoration-none p-0"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <i className="bi bi-chevron-right fs-5"></i>
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="calendar-grid">
                  <div className="row g-0 text-center mb-3">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="col">
                        <small className="text-muted fw-bold">{day}</small>
                      </div>
                    ))}
                  </div>
                  
                  {Array.from({ length: Math.ceil(getCalendarDays().length / 7) }).map((_, weekIndex) => (
                    <div key={weekIndex} className="row g-0">
                      {getCalendarDays().slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => (
                        <div key={dayIndex} className="col p-1">
                          {day && (
                            <button
                              className={`btn w-100 ${
                                selectedDate && isSameDay(day, selectedDate)
                                  ? 'btn-primary'
                                  : isBefore(day, startOfDay(new Date()))
                                  ? 'btn-light text-muted disabled'
                                  : 'btn-outline-secondary'
                              }`}
                              style={{ 
                                height: '40px',
                                fontSize: '14px'
                              }}
                              onClick={() => handleDateSelect(day)}
                              disabled={isBefore(day, startOfDay(new Date()))}
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
            </div>
          </div>

          {/* Time Slots / Form Section */}
          <div className="col-lg-5">
            {!selectedDate ? (
              <div className="card shadow-sm">
                <div className="card-body text-center py-5">
                  <i className="bi bi-calendar-event fs-1 text-muted mb-3 d-block"></i>
                  <h5>Select a Date</h5>
                  <p className="text-muted">Please select a date to see available time slots</p>
                </div>
              </div>
            ) : !selectedSlot ? (
              <div className="card shadow-sm">
                <div className="card-header bg-white border-bottom-0">
                  <h5 className="mb-0">{format(selectedDate, 'EEEE, MMMM d')}</h5>
                </div>
                <div className="card-body">
                  {loadingSlots ? (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="bi bi-calendar-x fs-1 text-muted mb-3 d-block"></i>
                      <p className="text-muted mb-0">No available times for this date</p>
                    </div>
                  ) : (
                    <div className="row g-2">
                      {timeSlots.map((slot, index) => (
                        <div key={index} className="col-6">
                          <button
                            className={`btn w-100 ${
                              selectedSlot && isSameDay(slot.start, selectedSlot.start) && 
                              slot.start.getTime() === selectedSlot.start.getTime()
                                ? 'btn-primary'
                                : 'btn-outline-primary'
                            }`}
                            onClick={() => handleSlotSelect(slot)}
                            disabled={!slot.available}
                          >
                            {format(slot.start, 'h:mm a')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card shadow-sm">
                <div className="card-header bg-white border-bottom-0">
                  <button
                    className="btn btn-link text-decoration-none p-0"
                    onClick={() => setSelectedSlot(null)}
                  >
                    <i className="bi bi-arrow-left me-2"></i>Back
                  </button>
                </div>
                <div className="card-body">
                  <div className="mb-4">
                    <h5 className="mb-3">Booking Details</h5>
                    <div className="bg-light rounded p-3">
                      <p className="mb-2">
                        <i className="bi bi-calendar3 me-2 text-primary"></i>
                        {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="mb-0">
                        <i className="bi bi-clock me-2 text-primary"></i>
                        {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
                      </p>
                    </div>
                  </div>

                  <BookingFormV3
                    bookingLink={bookingLink}
                    selectedSlot={selectedSlot}
                    onSubmit={handleBookingSubmit}
                    onCancel={() => setSelectedSlot(null)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface BookingFormV3Props {
  bookingLink: BookingLink
  selectedSlot: TimeSlot
  onSubmit: (data: BookingFormData) => void
  onCancel: () => void
}

const BookingFormV3: React.FC<BookingFormV3Props> = ({
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
      <h5 className="mb-3">Your Information</h5>

      <div className="mb-3">
        <label className="form-label">Full Name *</label>
        <input
          type="text"
          className="form-control"
          placeholder="John Smith"
          value={formData.customer_name}
          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Email Address *</label>
        <input
          type="email"
          className="form-control"
          placeholder="john@example.com"
          value={formData.customer_email}
          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
          required
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Phone Number *</label>
        <input
          type="tel"
          className="form-control"
          placeholder="(555) 123-4567"
          value={formData.customer_phone}
          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
          required
        />
      </div>

      <div className="mb-4">
        <label className="form-label">Additional Information</label>
        <textarea
          className="form-control"
          rows={3}
          placeholder="Tell us about your project or any specific requirements..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="d-grid">
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Confirming...
            </>
          ) : (
            'Confirm Booking'
          )}
        </button>
      </div>
    </form>
  )
}

export default PublicBookingPageV3