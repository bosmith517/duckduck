import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { BookingService } from '../../services/bookingService'
import { BookingLink, TimeSlot, BookingFormData } from '../../components/bookings/bookings.types'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { toast } from 'react-toastify'

const PublicBookingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()))
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [bookingComplete, setBookingComplete] = useState(false)
  const [confirmationToken, setConfirmationToken] = useState<string>('')

  useEffect(() => {
    if (slug) {
      loadBookingLink()
    }
  }, [slug])

  useEffect(() => {
    if (bookingLink) {
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
    if (!bookingLink) return

    try {
      const slots = await BookingService.getAvailableTimeSlots(bookingLink.id, selectedDate)
      setTimeSlots(slots)
    } catch (error) {
      console.error('Error loading time slots:', error)
      toast.error('Failed to load available times')
    }
  }

  const handleDateChange = (date: Date) => {
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

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
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
        <div className="card shadow" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="card-body text-center py-5">
            <i className="bi bi-check-circle-fill text-success fs-1 mb-3 d-block"></i>
            <h3 className="mb-3">Booking Confirmed!</h3>
            <p className="text-muted mb-4">
              We've sent a confirmation email with your booking details.
            </p>
            <div className="bg-light rounded p-3 mb-4">
              <p className="mb-2"><strong>{bookingLink.title}</strong></p>
              <p className="mb-1">
                <i className="bi bi-calendar3 me-2"></i>
                {format(selectedSlot!.start, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="mb-0">
                <i className="bi bi-clock me-2"></i>
                {format(selectedSlot!.start, 'h:mm a')} - {format(selectedSlot!.end, 'h:mm a')}
              </p>
            </div>
            <p className="text-muted small">
              Confirmation #: {confirmationToken.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card shadow">
              <div className="card-body p-4">
                <div className="text-center mb-4">
                  <h2 className="mb-2">{bookingLink.title}</h2>
                  {bookingLink.description && (
                    <p className="text-muted">{bookingLink.description}</p>
                  )}
                  <div className="d-inline-flex align-items-center text-muted">
                    <i className="bi bi-clock me-2"></i>
                    {bookingLink.duration_minutes} minutes
                  </div>
                </div>

                <hr className="my-4" />

                {!showBookingForm ? (
                  <>
                    <h5 className="mb-3">Select a Date & Time</h5>
                    
                    {/* Date Selection */}
                    <div className="mb-4">
                      <label className="form-label">Choose a date</label>
                      <div className="row g-2">
                        {Array.from({ length: 7 }, (_, i) => {
                          const date = addDays(new Date(), i)
                          return (
                            <div key={i} className="col">
                              <button
                                className={`btn btn-outline-primary w-100 ${
                                  isSameDay(date, selectedDate) ? 'active' : ''
                                }`}
                                onClick={() => handleDateChange(date)}
                              >
                                <div className="small">{format(date, 'EEE')}</div>
                                <div>{format(date, 'd')}</div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Time Slots */}
                    <div>
                      <label className="form-label">
                        Available times for {format(selectedDate, 'MMMM d, yyyy')}
                      </label>
                      {timeSlots.length === 0 ? (
                        <div className="alert alert-info">
                          No available times for this date. Please try another day.
                        </div>
                      ) : (
                        <div className="row g-2">
                          {timeSlots.map((slot, index) => (
                            <div key={index} className="col-6 col-md-4 col-lg-3">
                              <button
                                className={`btn w-100 ${
                                  slot.available
                                    ? 'btn-outline-primary'
                                    : 'btn-outline-secondary disabled'
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
                  </>
                ) : (
                  <BookingForm
                    bookingLink={bookingLink}
                    selectedSlot={selectedSlot!}
                    onSubmit={handleBookingSubmit}
                    onCancel={() => {
                      setShowBookingForm(false)
                      setSelectedSlot(null)
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BookingFormProps {
  bookingLink: BookingLink
  selectedSlot: TimeSlot
  onSubmit: (data: BookingFormData) => void
  onCancel: () => void
}

const BookingForm: React.FC<BookingFormProps> = ({
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
      <div className="mb-4">
        <button
          type="button"
          className="btn btn-link p-0 text-decoration-none"
          onClick={onCancel}
        >
          <i className="bi bi-arrow-left me-2"></i>
          Back to time selection
        </button>
      </div>

      <div className="bg-light rounded p-3 mb-4">
        <h6 className="mb-3">Booking Details</h6>
        <p className="mb-1">
          <i className="bi bi-calendar3 me-2"></i>
          {format(selectedSlot.start, 'EEEE, MMMM d, yyyy')}
        </p>
        <p className="mb-0">
          <i className="bi bi-clock me-2"></i>
          {format(selectedSlot.start, 'h:mm a')} - {format(selectedSlot.end, 'h:mm a')}
          <span className="text-muted ms-2">({bookingLink.duration_minutes} min)</span>
        </p>
      </div>

      <h5 className="mb-3">Your Information</h5>

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
        <label className="form-label">Phone</label>
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
            'Confirm Booking'
          )}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default PublicBookingPage