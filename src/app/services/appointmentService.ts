import { supabase } from '../../supabaseClient'

export interface TimeSlot {
  startTime: string
  endTime: string
  date: string
}

export interface AppointmentConflict {
  id: string
  title: string
  startTime: string
  endTime: string
  type: 'job' | 'calendar_event' | 'lead_visit' | 'booking'
}

export class AppointmentService {
  // Get all appointments for a specific date and tenant
  static async getAppointmentsForDate(date: string, tenantId: string): Promise<AppointmentConflict[]> {
    const appointments: AppointmentConflict[] = []
    
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    try {
      // Fetch jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, start_date, due_date')
        .eq('tenant_id', tenantId)
        .gte('start_date', startOfDay.toISOString())
        .lte('start_date', endOfDay.toISOString())
        .not('status', 'in', '["cancelled","completed"]')
      
      if (jobs) {
        jobs.forEach(job => {
          appointments.push({
            id: `job-${job.id}`,
            title: job.title || 'Untitled Job',
            startTime: new Date(job.start_date).toTimeString().slice(0, 5),
            endTime: job.due_date ? new Date(job.due_date).toTimeString().slice(0, 5) : '',
            type: 'job'
          })
        })
      }
      
      // Fetch calendar events
      const { data: events } = await supabase
        .from('calendar_events')
        .select('id, title, start_time, end_time')
        .eq('tenant_id', tenantId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .not('status', 'in', '["cancelled","completed"]')
      
      if (events) {
        events.forEach(event => {
          appointments.push({
            id: `calendar-${event.id}`,
            title: event.title || 'Calendar Event',
            startTime: new Date(event.start_time).toTimeString().slice(0, 5),
            endTime: event.end_time ? new Date(event.end_time).toTimeString().slice(0, 5) : '',
            type: 'calendar_event'
          })
        })
      }
      
      // Fetch leads with site visits
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, site_visit_date')
        .eq('tenant_id', tenantId)
        .gte('site_visit_date', startOfDay.toISOString())
        .lte('site_visit_date', endOfDay.toISOString())
        .not('status', 'eq', 'cancelled')
      
      if (leads) {
        leads.forEach(lead => {
          const visitTime = new Date(lead.site_visit_date)
          appointments.push({
            id: `lead-${lead.id}`,
            title: `Site Visit: ${lead.name || 'Lead'}`,
            startTime: visitTime.toTimeString().slice(0, 5),
            endTime: new Date(visitTime.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5), // 1 hour
            type: 'lead_visit'
          })
        })
      }
      
      // Fetch bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, customer_name, start_time, end_time')
        .eq('tenant_id', tenantId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .not('status', 'in', '["cancelled","completed"]')
      
      if (bookings) {
        bookings.forEach(booking => {
          appointments.push({
            id: `booking-${booking.id}`,
            title: `Booking: ${booking.customer_name || 'Customer'}`,
            startTime: new Date(booking.start_time).toTimeString().slice(0, 5),
            endTime: booking.end_time ? new Date(booking.end_time).toTimeString().slice(0, 5) : '',
            type: 'booking'
          })
        })
      }
      
    } catch (error) {
      console.error('Error fetching appointments:', error)
    }
    
    // Sort by start time
    return appointments.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  
  // Check if a time slot has conflicts
  static async checkTimeSlotConflict(
    slot: TimeSlot,
    tenantId: string,
    excludeId?: string
  ): Promise<{ hasConflict: boolean; conflicts: AppointmentConflict[] }> {
    const appointments = await this.getAppointmentsForDate(slot.date, tenantId)
    
    // Filter out the appointment being edited
    const relevantAppointments = excludeId 
      ? appointments.filter(apt => apt.id !== excludeId)
      : appointments
    
    // Check for overlaps
    const conflicts = relevantAppointments.filter(apt => {
      // Skip if no end time
      if (!apt.endTime || !slot.endTime) return false
      
      // Convert times to minutes for easier comparison
      const slotStart = this.timeToMinutes(slot.startTime)
      const slotEnd = this.timeToMinutes(slot.endTime)
      const aptStart = this.timeToMinutes(apt.startTime)
      const aptEnd = this.timeToMinutes(apt.endTime)
      
      // Check for overlap
      return (slotStart < aptEnd && slotEnd > aptStart)
    })
    
    return {
      hasConflict: conflicts.length > 0,
      conflicts
    }
  }
  
  // Convert time string (HH:MM) to minutes
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }
  
  // Get suggested available time slots for a date
  static async getSuggestedTimeSlots(
    date: string,
    duration: number, // in minutes
    tenantId: string
  ): Promise<TimeSlot[]> {
    const appointments = await this.getAppointmentsForDate(date, tenantId)
    const suggestedSlots: TimeSlot[] = []
    
    // Business hours: 8 AM to 6 PM
    const businessStart = 8 * 60 // 8:00 AM in minutes
    const businessEnd = 18 * 60 // 6:00 PM in minutes
    const slotDuration = duration
    
    // Convert appointments to minute ranges
    const busyRanges = appointments
      .filter(apt => apt.endTime)
      .map(apt => ({
        start: this.timeToMinutes(apt.startTime),
        end: this.timeToMinutes(apt.endTime)
      }))
      .sort((a, b) => a.start - b.start)
    
    // Find available slots
    let currentTime = businessStart
    
    for (const busy of busyRanges) {
      // If there's a gap before this appointment
      if (currentTime + slotDuration <= busy.start) {
        suggestedSlots.push({
          date,
          startTime: this.minutesToTime(currentTime),
          endTime: this.minutesToTime(currentTime + slotDuration)
        })
      }
      currentTime = Math.max(currentTime, busy.end)
    }
    
    // Check if there's time after the last appointment
    if (currentTime + slotDuration <= businessEnd) {
      suggestedSlots.push({
        date,
        startTime: this.minutesToTime(currentTime),
        endTime: this.minutesToTime(currentTime + slotDuration)
      })
    }
    
    // Return up to 5 suggested slots
    return suggestedSlots.slice(0, 5)
  }
  
  // Convert minutes to time string (HH:MM)
  private static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }
}