import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase, Job, Account, Contact } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { ScheduleEventForm } from '../../components/schedule/ScheduleEventForm'
import { showToast } from '../../utils/toast'

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
  job?: Job
  account?: Account
  contact?: Contact
}

const SchedulePage: React.FC = () => {
  const { currentUser, userProfile } = useSupabaseAuth()
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialMockEvents] = useState<ScheduleEvent[]>([
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

  // Fetch all appointments from multiple sources
  const fetchJobsAsEvents = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      setError(null)
      
      // Fetch multiple data sources in parallel
      const [jobsResult, leadsResult, calendarResult, bookingsResult] = await Promise.all([
        // 1. Fetch jobs with start dates
        supabase
          .from('jobs')
          .select(`
            *,
            account:accounts(*),
            contact:contacts(*)
          `)
          .eq('tenant_id', userProfile.tenant_id)
          .not('start_date', 'is', null)
          .order('start_date', { ascending: true }),
        
        // 2. Fetch leads with scheduled site visits
        supabase
          .from('leads')
          .select(`
            *,
            contact:contacts(*),
            account:accounts(*)
          `)
          .eq('tenant_id', userProfile.tenant_id)
          .not('site_visit_date', 'is', null)
          .order('site_visit_date', { ascending: true }),
        
        // 3. Fetch calendar events
        supabase
          .from('calendar_events')
          .select(`
            *,
            lead:leads(
              *,
              contact:contacts(*),
              account:accounts(*)
            ),
            job:jobs(
              *,
              account:accounts(*),
              contact:contacts(*)
            )
          `)
          .eq('tenant_id', userProfile.tenant_id)
          .order('start_time', { ascending: true }),
        
        // 4. Fetch customer bookings
        supabase
          .from('bookings')
          .select('*')
          .eq('tenant_id', userProfile.tenant_id)
          .order('start_time', { ascending: true })
      ])

      const scheduleEvents: ScheduleEvent[] = []

      // Process jobs
      if (jobsResult.data && !jobsResult.error) {
        jobsResult.data.forEach(job => {
          const startDate = job.start_date ? new Date(job.start_date) : new Date()
          const dueDate = job.due_date ? new Date(job.due_date) : new Date(startDate.getTime() + 8 * 60 * 60 * 1000)
          
          scheduleEvents.push({
            id: `job-${job.id}`,
            title: job.title || 'Untitled Job',
            client: job.account?.name || 
                    (job.contact ? (
                      job.contact.name || 
                      `${job.contact.first_name || ''} ${job.contact.last_name || ''}`.trim()
                    ) : '') || 
                    'Unknown Client',
            jobId: job.job_number || `JOB-${job.id.slice(0, 8)}`,
            type: determineJobType(job.title || '', job.description || ''),
            startTime: startDate.toTimeString().slice(0, 5),
            endTime: dueDate.toTimeString().slice(0, 5),
            date: startDate.toISOString().split('T')[0],
            location: [job.location_address, job.location_city, job.location_state]
              .filter(Boolean).join(', ') || 'Location TBD',
            assignedTo: ['Technician'],
            status: mapJobStatusToEventStatus(job.status),
            notes: job.notes || '',
            job,
            account: job.account,
            contact: job.contact
          })
        })
      }

      // Process leads with site visits
      if (leadsResult.data && !leadsResult.error) {
        leadsResult.data.forEach(lead => {
          const visitDate = new Date(lead.site_visit_date)
          
          scheduleEvents.push({
            id: `lead-${lead.id}`,
            title: `Site Visit - ${lead.title || 'Lead'}`,
            client: lead.account?.name || 
                    (lead.contact ? (
                      lead.contact.name || 
                      `${lead.contact.first_name || ''} ${lead.contact.last_name || ''}`.trim()
                    ) : '') || 
                    lead.name || 
                    'Unknown Client',
            jobId: `LEAD-${lead.id.slice(0, 8)}`,
            type: 'meeting',
            startTime: visitDate.toTimeString().slice(0, 5),
            endTime: new Date(visitDate.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5), // 1 hour default
            date: visitDate.toISOString().split('T')[0],
            location: lead.full_address || lead.street_address || 'Location TBD',
            assignedTo: [lead.assigned_rep ? 'Assigned' : 'Unassigned'],
            status: lead.status === 'site_visit_scheduled' ? 'scheduled' : 'completed',
            notes: lead.site_visit_notes || 'Site visit scheduled'
          })
        })
      }

      // Process calendar events
      if (calendarResult.data && !calendarResult.error) {
        calendarResult.data.forEach(event => {
          const startTime = new Date(event.start_time)
          const endTime = event.end_time ? new Date(event.end_time) : new Date(startTime.getTime() + 60 * 60 * 1000)
          
          // Skip if this calendar event is already represented as a job or lead
          if (event.job_id && scheduleEvents.some(e => e.id === `job-${event.job_id}`)) return
          if (event.lead_id && scheduleEvents.some(e => e.id === `lead-${event.lead_id}`)) return
          
          scheduleEvents.push({
            id: `calendar-${event.id}`,
            title: event.title || 'Calendar Event',
            client: event.lead?.contact?.name || event.job?.account?.name || 'Unknown',
            jobId: `EVENT-${event.id.slice(0, 8)}`,
            type: event.event_type === 'site_visit' ? 'meeting' : 
                  event.event_type === 'job_work' ? 'work' : 
                  event.event_type === 'inspection' ? 'inspection' : 'meeting',
            startTime: startTime.toTimeString().slice(0, 5),
            endTime: endTime.toTimeString().slice(0, 5),
            date: startTime.toISOString().split('T')[0],
            location: event.location || 'Location TBD',
            assignedTo: [event.assigned_to || 'Unassigned'],
            status: event.status === 'completed' ? 'completed' : 
                    event.status === 'cancelled' ? 'cancelled' : 'scheduled',
            notes: event.description || ''
          })
        })
      }

      // Process bookings
      if (bookingsResult.data && !bookingsResult.error) {
        bookingsResult.data.forEach(booking => {
          const startTime = new Date(booking.start_time)
          const endTime = booking.end_time ? new Date(booking.end_time) : new Date(startTime.getTime() + 60 * 60 * 1000)
          
          scheduleEvents.push({
            id: `booking-${booking.id}`,
            title: `Customer Booking - ${booking.customer_name || 'Unknown'}`,
            client: booking.customer_name || 'Unknown',
            jobId: `BOOK-${booking.id.slice(0, 8)}`,
            type: 'meeting',
            startTime: startTime.toTimeString().slice(0, 5),
            endTime: endTime.toTimeString().slice(0, 5),
            date: startTime.toISOString().split('T')[0],
            location: 'Location TBD',
            assignedTo: ['Unassigned'],
            status: booking.status === 'confirmed' ? 'scheduled' : 
                    booking.status === 'completed' ? 'completed' : 'cancelled',
            notes: booking.notes || 'Customer booking'
          })
        })
      }

      // Sort all events by date and time
      scheduleEvents.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.startTime}`)
        const dateB = new Date(`${b.date}T${b.startTime}`)
        return dateA.getTime() - dateB.getTime()
      })

      setEvents(scheduleEvents.length > 0 ? scheduleEvents : initialMockEvents)
      
      if (scheduleEvents.length === 0) {
        setError('No appointments found. Showing demo data.')
      }
    } catch (err) {
      console.error('Error in fetchJobsAsEvents:', err)
      setError('Failed to load schedule data')
      setEvents(initialMockEvents)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to determine job type from title/description
  const determineJobType = (title: string, description: string): 'meeting' | 'work' | 'inspection' | 'delivery' => {
    const text = (title + ' ' + description).toLowerCase()
    if (text.includes('meeting') || text.includes('consultation') || text.includes('estimate')) return 'meeting'
    if (text.includes('inspection') || text.includes('review') || text.includes('check')) return 'inspection'
    if (text.includes('delivery') || text.includes('pickup') || text.includes('material')) return 'delivery'
    return 'work'
  }

  // Helper function to map job status to event status
  const mapJobStatusToEventStatus = (jobStatus: string): 'scheduled' | 'in-progress' | 'completed' | 'cancelled' => {
    switch (jobStatus?.toLowerCase()) {
      case 'scheduled':
      case 'pending':
      case 'confirmed':
        return 'scheduled'
      case 'in progress':
      case 'in-progress':
      case 'active':
      case 'started':
        return 'in-progress'
      case 'completed':
      case 'finished':
      case 'done':
        return 'completed'
      case 'cancelled':
      case 'canceled':
      case 'rejected':
        return 'cancelled'
      default:
        return 'scheduled'
    }
  }

  // Load jobs on component mount and when user changes
  useEffect(() => {
    if (currentUser) {
      fetchJobsAsEvents()
    }
  }, [userProfile?.tenant_id])

  // Set up real-time subscription for job updates
  useEffect(() => {
    if (!userProfile?.tenant_id) return

    const subscription = supabase
      .channel('jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${userProfile.tenant_id}`
        },
        (payload) => {
          console.log('Job updated:', payload)
          // Refetch jobs when changes occur
          fetchJobsAsEvents()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userProfile?.tenant_id])

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

  const handleSaveEvent = async (eventData: any) => {
    if (!userProfile?.tenant_id) {
      showToast.error('You must be logged in to create events')
      return
    }

    try {
      // Create a new job in the database
      const startDateTime = new Date(`${eventData.date}T${eventData.startTime}:00`)
      const endDateTime = new Date(`${eventData.date}T${eventData.endTime}:00`)
      
      const newJob = {
        tenant_id: userProfile.tenant_id,
        title: eventData.title,
        description: eventData.notes || '',
        status: 'Scheduled',
        priority: 'medium',
        start_date: startDateTime.toISOString(),
        due_date: endDateTime.toISOString(),
        location_address: eventData.location,
        notes: eventData.notes || '',
        job_number: `JOB-${Date.now().toString().slice(-6)}` // Generate unique job number
      }

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([newJob])
        .select()
        .single()

      if (jobError) {
        console.error('Error creating job:', jobError)
        showToast.error('Failed to create job: ' + jobError.message)
        return
      }

      // If we need to create/link an account for the client
      if (eventData.client && eventData.client.trim()) {
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .insert([{
            tenant_id: userProfile.tenant_id,
            name: eventData.client,
            type: 'Customer'
          }])
          .select()
          .single()

        if (!accountError && account) {
          // Update job with account_id
          await supabase
            .from('jobs')
            .update({ account_id: account.id })
            .eq('id', job.id)
        }
      }

      console.log('Job created successfully:', job)
      
      // Refresh the events list
      await fetchJobsAsEvents()
      setShowEventForm(false)
      
    } catch (err) {
      console.error('Error saving event:', err)
      showToast.error('Failed to save event. Please try again.')
    }
  }

  const handleEditEvent = (eventId: string) => {
    showToast.info('Edit functionality coming soon')
  }

  const handleMarkComplete = async (eventId: string) => {
    if (!userProfile?.tenant_id) return

    try {
      // Determine the type of event and update accordingly
      const [type, id] = eventId.split('-')
      
      let error = null
      
      switch (type) {
        case 'job':
          const jobResult = await supabase
            .from('jobs')
            .update({ status: 'Completed' })
            .eq('id', id)
            .eq('tenant_id', userProfile.tenant_id)
          error = jobResult.error
          break
          
        case 'lead':
          const leadResult = await supabase
            .from('leads')
            .update({ status: 'site_visit_completed' })
            .eq('id', id)
            .eq('tenant_id', userProfile.tenant_id)
          error = leadResult.error
          break
          
        case 'calendar':
          const calendarResult = await supabase
            .from('calendar_events')
            .update({ status: 'completed' })
            .eq('id', id)
            .eq('tenant_id', userProfile.tenant_id)
          error = calendarResult.error
          break
          
        case 'booking':
          const bookingResult = await supabase
            .from('bookings')
            .update({ status: 'completed' })
            .eq('id', id)
            .eq('tenant_id', userProfile.tenant_id)
          error = bookingResult.error
          break
      }

      if (error) {
        console.error('Error updating status:', error)
        showToast.error('Failed to update status')
        return
      }

      // Update local state immediately for better UX
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { ...event, status: 'completed' as const }
          : event
      ))
      
    } catch (err) {
      console.error('Error marking complete:', err)
      showToast.error('Failed to mark as complete')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!userProfile?.tenant_id) return
    
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', eventId)
        .eq('tenant_id', userProfile.tenant_id)

      if (error) {
        console.error('Error deleting job:', error)
        showToast.error('Failed to delete job')
        return
      }

      // Update local state immediately
      setEvents(prev => prev.filter(event => event.id !== eventId))
      
    } catch (err) {
      console.error('Error deleting job:', err)
      showToast.error('Failed to delete job')
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
                <span className='card-label fw-bold fs-3 mb-1'>All Appointments</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>View all scheduled appointments, site visits, jobs, and bookings</span>
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
              {loading && (
                <div className='text-center py-5'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                  <p className='mt-3 text-muted'>Loading schedule data...</p>
                </div>
              )}
              
              {error && (
                <div className='alert alert-warning' role='alert'>
                  <i className='ki-duotone ki-information fs-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                  </i>
                  {error}. Showing demo data.
                </div>
              )}
              
              {!loading && (viewMode === 'calendar' ? renderCalendarView() : (
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
              ))}
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* New Event Modal */}
      <ScheduleEventForm
        isOpen={showEventForm}
        onClose={() => setShowEventForm(false)}
        onSave={handleSaveEvent}
        selectedDate={selectedDate}
      />
    </>
  )
}

export default SchedulePage
