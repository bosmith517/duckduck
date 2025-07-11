import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { BookingService } from '../../services/bookingService'
import { Booking, BookingLink } from '../../components/bookings/bookings.types'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth } from 'date-fns'
import { toast } from 'react-toastify'

const BookingCalendarPage: React.FC = () => {
  const { id: bookingLinkId } = useParams<{ id: string }>()
  const { user } = useSupabaseAuth()
  const [bookingLink, setBookingLink] = useState<BookingLink | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (bookingLinkId && user) {
      loadData()
    }
  }, [bookingLinkId, user, currentDate])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load booking link details
      const links = await BookingService.getUserBookingLinks(user!.id)
      const link = links.find(l => l.id === bookingLinkId)
      if (link) {
        setBookingLink(link)
      }

      // Load bookings for current view
      const bookingsList = await BookingService.getUserBookings(bookingLinkId!)
      setBookings(bookingsList.filter(b => b.status === 'confirmed'))
    } catch (error) {
      console.error('Error loading calendar data:', error)
      toast.error('Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  const getDaysToDisplay = () => {
    if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 })
      })
    } else {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      return eachDayOfInterval({
        start: startOfWeek(monthStart, { weekStartsOn: 0 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 0 })
      })
    }
  }

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => 
      isSameDay(new Date(booking.start_time), date)
    )
  }

  const handlePreviousPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))
    } else {
      setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))
    }
  }

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))
    } else {
      setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))
    }
  }

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking)
  }

  const handleStatusUpdate = async (bookingId: string, status: Booking['status']) => {
    try {
      await BookingService.updateBookingStatus(bookingId, status)
      await loadData()
      toast.success('Booking status updated')
      setSelectedBooking(null)
    } catch (error) {
      console.error('Error updating booking status:', error)
      toast.error('Failed to update booking status')
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

  if (!bookingLink) {
    return (
      <div className="container-fluid">
        <div className="alert alert-warning">Booking link not found</div>
      </div>
    )
  }

  const days = getDaysToDisplay()

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col">
          <h1 className="h3 mb-0">{bookingLink.title} - Calendar</h1>
          <p className="text-muted">View and manage your bookings</p>
        </div>
        <div className="col-auto">
          <div className="btn-group" role="group">
            <button
              className={`btn ${viewMode === 'month' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              className={`btn ${viewMode === 'week' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <button className="btn btn-sm btn-outline-secondary" onClick={handlePreviousPeriod}>
            <i className="bi bi-chevron-left"></i>
          </button>
          <h5 className="mb-0">
            {viewMode === 'month' 
              ? format(currentDate, 'MMMM yyyy')
              : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
            }
          </h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleNextPeriod}>
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered mb-0">
              <thead>
                <tr>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <th key={day} className="text-center" style={{ width: '14.28%' }}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'month' ? (
                  // Month view - multiple weeks
                  Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
                    <tr key={weekIndex}>
                      {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                        const dayBookings = getBookingsForDay(day)
                        const isCurrentMonth = isSameMonth(day, currentDate)
                        
                        return (
                          <td 
                            key={dayIndex} 
                            className={`p-0 ${!isCurrentMonth ? 'bg-light' : ''}`}
                            style={{ height: '100px', verticalAlign: 'top' }}
                          >
                            <div className="p-2">
                              <div className="text-muted small mb-1">
                                {format(day, 'd')}
                              </div>
                              {dayBookings.slice(0, 3).map((booking, idx) => (
                                <div
                                  key={booking.id}
                                  className="badge bg-primary text-truncate w-100 mb-1 cursor-pointer"
                                  style={{ fontSize: '11px', cursor: 'pointer' }}
                                  onClick={() => handleBookingClick(booking)}
                                  title={`${booking.customer_name} - ${format(new Date(booking.start_time), 'h:mm a')}`}
                                >
                                  {format(new Date(booking.start_time), 'h:mm a')} - {booking.customer_name}
                                </div>
                              ))}
                              {dayBookings.length > 3 && (
                                <div className="text-muted small text-center">
                                  +{dayBookings.length - 3} more
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                ) : (
                  // Week view - single week with time slots
                  <tr>
                    {days.map((day, dayIndex) => {
                      const dayBookings = getBookingsForDay(day)
                      
                      return (
                        <td 
                          key={dayIndex} 
                          className="p-0"
                          style={{ verticalAlign: 'top' }}
                        >
                          <div className="p-2">
                            <div className="fw-bold mb-2">
                              {format(day, 'MMM d')}
                            </div>
                            <div style={{ minHeight: '400px' }}>
                              {dayBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="card mb-2 cursor-pointer"
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => handleBookingClick(booking)}
                                >
                                  <div className="card-body p-2">
                                    <div className="fw-bold small text-truncate">
                                      {booking.customer_name}
                                    </div>
                                    <div className="text-muted small">
                                      {format(new Date(booking.start_time), 'h:mm a')} - 
                                      {format(new Date(booking.end_time), 'h:mm a')}
                                    </div>
                                    {booking.customer_phone && (
                                      <div className="text-muted small">
                                        <i className="bi bi-telephone me-1"></i>
                                        {booking.customer_phone}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Booking Details</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setSelectedBooking(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Customer:</strong> {selectedBooking.customer_name}
                </div>
                <div className="mb-3">
                  <strong>Email:</strong> {selectedBooking.customer_email}
                </div>
                {selectedBooking.customer_phone && (
                  <div className="mb-3">
                    <strong>Phone:</strong> {selectedBooking.customer_phone}
                  </div>
                )}
                <div className="mb-3">
                  <strong>Date:</strong> {format(new Date(selectedBooking.start_time), 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="mb-3">
                  <strong>Time:</strong> {format(new Date(selectedBooking.start_time), 'h:mm a')} - {format(new Date(selectedBooking.end_time), 'h:mm a')}
                </div>
                {selectedBooking.notes && (
                  <div className="mb-3">
                    <strong>Notes:</strong>
                    <p className="mb-0">{selectedBooking.notes}</p>
                  </div>
                )}
                <div className="mb-3">
                  <strong>Status:</strong> 
                  <span className={`badge ms-2 bg-${selectedBooking.status === 'confirmed' ? 'success' : selectedBooking.status === 'cancelled' ? 'danger' : 'secondary'}`}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                {selectedBooking.status === 'confirmed' && (
                  <>
                    <button 
                      className="btn btn-success"
                      onClick={() => handleStatusUpdate(selectedBooking.id, 'completed')}
                    >
                      Mark Completed
                    </button>
                    <button 
                      className="btn btn-warning"
                      onClick={() => handleStatusUpdate(selectedBooking.id, 'no_show')}
                    >
                      Mark No Show
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to cancel this booking?')) {
                          handleStatusUpdate(selectedBooking.id, 'cancelled')
                        }
                      }}
                    >
                      Cancel Booking
                    </button>
                  </>
                )}
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedBooking(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookingCalendarPage