import React, { useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'

interface ScheduleEvent {
  id: string
  title: string
  client: string
  jobId: string
  type: 'meeting' | 'work' | 'inspection' | 'delivery'
  startTime: string
  endTime: string
  date: string
  location: string
  assignedTo: string[]
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes: string
}

const SchedulePage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [events, setEvents] = useState<ScheduleEvent[]>([
    {
      id: '1',
      title: 'Kitchen Installation',
      client: 'Smith Family',
      jobId: 'JOB-001',
      type: 'work',
      startTime: '08:00',
      endTime: '16:00',
      date: '2024-02-15',
      location: '123 Main St, Springfield, IL',
      assignedTo: ['John Doe', 'Mike Wilson'],
      status: 'scheduled',
      notes: 'Install kitchen cabinets and countertops'
    },
    {
      id: '2',
      title: 'Client Meeting',
      client: 'Johnson Residence',
      jobId: 'JOB-002',
      type: 'meeting',
      startTime: '10:00',
      endTime: '11:00',
      date: '2024-02-16',
      location: '456 Oak Ave, Springfield, IL',
      assignedTo: ['Sarah Johnson'],
      status: 'scheduled',
      notes: 'Discuss bathroom renovation plans'
    },
    {
      id: '3',
      title: 'Material Delivery',
      client: 'Williams Property',
      jobId: 'JOB-003',
      type: 'delivery',
      startTime: '09:00',
      endTime: '10:00',
      date: '2024-02-17',
      location: '789 Pine Rd, Springfield, IL',
      assignedTo: ['Delivery Team'],
      status: 'scheduled',
      notes: 'Deck materials delivery'
    },
    {
      id: '4',
      title: 'Final Inspection',
      client: 'Davis Home',
      jobId: 'JOB-004',
      type: 'inspection',
      startTime: '14:00',
      endTime: '15:00',
      date: '2024-02-18',
      location: '321 Elm St, Springfield, IL',
      assignedTo: ['Inspector Smith'],
      status: 'completed',
      notes: 'Final inspection for roof repair'
    }
  ])

  const getTypeIcon = (type: string) => {
    const icons = {
      'meeting': 'ki-people',
      'work': 'ki-hammer',
      'inspection': 'ki-search-list',
      'delivery': 'ki-delivery'
    }
    return icons[type as keyof typeof icons] || 'ki-calendar'
  }

  const getTypeBadge = (type: string) => {
    const badges = {
      'meeting': 'badge-light-info',
      'work': 'badge-light-primary',
      'inspection': 'badge-light-warning',
      'delivery': 'badge-light-success'
    }
    return `badge ${badges[type as keyof typeof badges]}`
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'scheduled': 'badge-light-info',
      'in-progress': 'badge-light-primary',
      'completed': 'badge-light-success',
      'cancelled': 'badge-light-danger'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses]}`
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const [showEventForm, setShowEventForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')

  const handleNewEvent = () => {
    setSelectedDate(new Date().toISOString().split('T')[0])
    setShowEventForm(true)
  }

  const handleSaveEvent = (eventData: any) => {
    const newEvent: ScheduleEvent = {
      id: (events.length + 1).toString(),
      title: eventData.title,
      client: eventData.client,
      jobId: `JOB-${String(events.length + 1).padStart(3, '0')}`,
      type: eventData.type,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      date: eventData.date,
      location: eventData.location,
      assignedTo: [eventData.assignedTo],
      status: 'scheduled',
      notes: eventData.notes
    }
    setEvents(prev => [...prev, newEvent])
    setShowEventForm(false)
  }

  const handleEditEvent = (eventId: string) => {
    alert(`Edit event ${eventId}`)
  }

  const handleMarkComplete = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { ...event, status: 'completed' as const }
        : event
    ))
  }

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      setEvents(prev => prev.filter(event => event.id !== eventId))
    }
  }

  const renderCalendarView = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"]

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day)
      const dateString = date.toISOString().split('T')[0]
      const dayEvents = events.filter(event => event.date === dateString)
      
      days.push(
        <div key={day} className="calendar-day">
          <div className="day-number">{day}</div>
          <div className="day-events">
            {dayEvents.slice(0, 2).map(event => (
              <div key={event.id} className={`event-item ${event.type}`}>
                <small>{event.title}</small>
              </div>
            ))}
            {dayEvents.length > 2 && (
              <small className="text-muted">+{dayEvents.length - 2} more</small>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="calendar-container">
        <div className="calendar-header mb-4">
          <h4>{monthNames[currentMonth]} {currentYear}</h4>
        </div>
        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="weekday-header">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {days}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Schedule Management</PageTitle>
      
      <style>{`
        .calendar-container {
          min-height: 600px;
        }
        .calendar-grid {
          display: grid;
          grid-template-rows: auto 1fr;
          height: 100%;
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background-color: #f5f8fa;
          padding: 10px 0;
        }
        .weekday-header {
          text-align: center;
          font-weight: 600;
          color: #5e6278;
          font-size: 14px;
          padding: 10px;
        }
        .calendar-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background-color: #e1e3ea;
        }
        .calendar-day {
          background-color: white;
          min-height: 120px;
          padding: 8px;
          border: 1px solid #e1e3ea;
          position: relative;
        }
        .calendar-day.empty {
          background-color: #f5f8fa;
        }
        .day-number {
          font-weight: 600;
          color: #181c32;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .day-events {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .event-item {
          background-color: #f1f3ff;
          border-left: 3px solid #3f4254;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          line-height: 1.2;
        }
        .event-item.work {
          background-color: #e8f4fd;
          border-left-color: #009ef7;
        }
        .event-item.meeting {
          background-color: #fff8dd;
          border-left-color: #ffc700;
        }
        .event-item.inspection {
          background-color: #fff0e6;
          border-left-color: #f1416c;
        }
        .event-item.delivery {
          background-color: #e8f5e8;
          border-left-color: #50cd89;
        }
      `}</style>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Project Schedule</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Manage appointments and work schedules</span>
              </h3>
              <div className='card-toolbar'>
                <button 
                  className={`btn btn-sm me-3 ${viewMode === 'calendar' ? 'btn-primary' : 'btn-light'}`}
                  onClick={() => setViewMode('calendar')}
                >
                  <i className='ki-duotone ki-calendar fs-2'></i>
                  Calendar View
                </button>
                <button 
                  className={`btn btn-sm me-3 ${viewMode === 'list' ? 'btn-primary' : 'btn-light'}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className='ki-duotone ki-row-horizontal fs-2'></i>
                  List View
                </button>
                <button className='btn btn-sm btn-primary' onClick={handleNewEvent}>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Event
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              {viewMode === 'calendar' ? renderCalendarView() : (
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th className='min-w-200px'>Event</th>
                      <th className='min-w-120px'>Type</th>
                      <th className='min-w-120px'>Date</th>
                      <th className='min-w-120px'>Time</th>
                      <th className='min-w-150px'>Assigned To</th>
                      <th className='min-w-120px'>Status</th>
                      <th className='min-w-200px'>Location</th>
                      <th className='min-w-100px text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-5'>
                              <div className='symbol-label bg-light-primary text-primary'>
                                <i className={`ki-duotone ${getTypeIcon(event.type)} fs-2`}>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                              </div>
                            </div>
                            <div className='d-flex justify-content-start flex-column'>
                              <a href='#' className='text-dark fw-bold text-hover-primary fs-6'>
                                {event.title}
                              </a>
                              <span className='text-muted fw-semibold fs-7'>
                                {event.client} - {event.jobId}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={getTypeBadge(event.type)}>
                            {event.type}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            <span className='text-dark fw-bold fs-6'>
                              {formatTime(event.startTime)}
                            </span>
                            <span className='text-muted fw-semibold fs-7'>
                              to {formatTime(event.endTime)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            {event.assignedTo.map((person, index) => (
                              <span key={index} className='text-dark fw-bold fs-6'>
                                {person}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className={getStatusBadge(event.status)}>
                            {event.status.replace('-', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {event.location}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex justify-content-end flex-shrink-0'>
                            <button
                              onClick={(e) => { e.preventDefault(); handleEditEvent(event.id) }}
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Edit Event'
                            >
                              <i className='ki-duotone ki-pencil fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); handleMarkComplete(event.id) }}
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                              title='Mark Complete'
                              disabled={event.status === 'completed'}
                            >
                              <i className='ki-duotone ki-check fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); handleDeleteEvent(event.id) }}
                              className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                              title='Delete'
                            >
                              <i className='ki-duotone ki-trash fs-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                                <span className='path4'></span>
                                <span className='path5'></span>
                              </i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* New Event Modal */}
      {showEventForm && (
        <div className='modal fade show d-block' style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className='modal-dialog modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Create New Event</h5>
                <button 
                  type='button' 
                  className='btn-close' 
                  onClick={() => setShowEventForm(false)}
                ></button>
              </div>
              <div className='modal-body'>
                <form onSubmit={(e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target as HTMLFormElement)
                  const eventData = {
                    title: formData.get('title'),
                    client: formData.get('client'),
                    type: formData.get('type'),
                    startTime: formData.get('startTime'),
                    endTime: formData.get('endTime'),
                    date: formData.get('date'),
                    location: formData.get('location'),
                    assignedTo: formData.get('assignedTo'),
                    notes: formData.get('notes')
                  }
                  handleSaveEvent(eventData)
                }}>
                  <div className='row g-3'>
                    <div className='col-md-6'>
                      <label className='form-label required'>Event Title</label>
                      <input type='text' name='title' className='form-control' required />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Client Name</label>
                      <input type='text' name='client' className='form-control' required />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Event Type</label>
                      <select name='type' className='form-select' required>
                        <option value=''>Select Type</option>
                        <option value='meeting'>Meeting</option>
                        <option value='work'>Work</option>
                        <option value='inspection'>Inspection</option>
                        <option value='delivery'>Delivery</option>
                      </select>
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Date</label>
                      <input type='date' name='date' className='form-control' defaultValue={selectedDate} required />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>Start Time</label>
                      <input type='time' name='startTime' className='form-control' required />
                    </div>
                    <div className='col-md-6'>
                      <label className='form-label required'>End Time</label>
                      <input type='time' name='endTime' className='form-control' required />
                    </div>
                    <div className='col-12'>
                      <label className='form-label required'>Location</label>
                      <input type='text' name='location' className='form-control' placeholder='123 Main St, City, State' required />
                    </div>
                    <div className='col-12'>
                      <label className='form-label required'>Assigned To</label>
                      <input type='text' name='assignedTo' className='form-control' placeholder='Technician name' required />
                    </div>
                    <div className='col-12'>
                      <label className='form-label'>Notes</label>
                      <textarea name='notes' className='form-control' rows={3} placeholder='Additional notes...'></textarea>
                    </div>
                  </div>
                  <div className='modal-footer'>
                    <button type='button' className='btn btn-light' onClick={() => setShowEventForm(false)}>
                      Cancel
                    </button>
                    <button type='submit' className='btn btn-primary'>
                      Create Event
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SchedulePage
