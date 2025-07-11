import { supabase } from '../../supabaseClient'
import { 
  BookingLink, 
  AvailabilitySchedule, 
  AvailabilityOverride, 
  Booking,
  TimeSlot,
  CreateBookingLinkData,
  UpdateAvailabilityData,
  BookingFormData
} from '../../lib/supabase/bookings.types'

export class BookingService {
  // Booking Links
  static async createBookingLink(data: CreateBookingLinkData, userId: string, tenantId: string): Promise<BookingLink> {
    // Generate slug from title
    const { data: slugData, error: slugError } = await supabase
      .rpc('generate_booking_slug', { base_name: data.title })

    if (slugError) throw slugError

    const { data: bookingLink, error } = await supabase
      .from('booking_links')
      .insert({
        ...data,
        user_id: userId,
        tenant_id: tenantId,
        slug: slugData
      })
      .select()
      .single()

    if (error) throw error
    return bookingLink
  }

  static async getBookingLinkBySlug(slug: string): Promise<BookingLink | null> {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  static async getUserBookingLinks(userId: string): Promise<BookingLink[]> {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async updateBookingLink(id: string, updates: Partial<BookingLink>): Promise<BookingLink> {
    const { data, error } = await supabase
      .from('booking_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteBookingLink(id: string): Promise<void> {
    const { error } = await supabase
      .from('booking_links')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Availability Schedules
  static async getAvailabilitySchedules(bookingLinkId: string): Promise<AvailabilitySchedule[]> {
    const { data, error } = await supabase
      .from('availability_schedules')
      .select('*')
      .eq('booking_link_id', bookingLinkId)
      .order('day_of_week', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async updateAvailabilitySchedules(bookingLinkId: string, schedules: UpdateAvailabilityData['schedules']): Promise<void> {
    // Delete existing schedules
    const { error: deleteError } = await supabase
      .from('availability_schedules')
      .delete()
      .eq('booking_link_id', bookingLinkId)

    if (deleteError) throw deleteError

    // Insert new schedules
    if (schedules.length > 0) {
      const schedulesToInsert = schedules.map(schedule => ({
        ...schedule,
        booking_link_id: bookingLinkId
      }))

      const { error: insertError } = await supabase
        .from('availability_schedules')
        .insert(schedulesToInsert)

      if (insertError) throw insertError
    }
  }

  // Availability Overrides
  static async getAvailabilityOverrides(bookingLinkId: string, startDate: string, endDate: string): Promise<AvailabilityOverride[]> {
    const { data, error } = await supabase
      .from('availability_overrides')
      .select('*')
      .eq('booking_link_id', bookingLinkId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async addAvailabilityOverride(override: Omit<AvailabilityOverride, 'id' | 'created_at'>): Promise<AvailabilityOverride> {
    const { data, error } = await supabase
      .from('availability_overrides')
      .insert(override)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async removeAvailabilityOverride(id: string): Promise<void> {
    const { error } = await supabase
      .from('availability_overrides')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Time Slots
  static async getAvailableTimeSlots(bookingLinkId: string, date: Date): Promise<TimeSlot[]> {
    const bookingLink = await this.getBookingLinkById(bookingLinkId)
    if (!bookingLink) throw new Error('Booking link not found')

    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]

    // Get schedules for this day
    const schedules = await this.getAvailabilitySchedules(bookingLinkId)
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek && s.is_active)

    console.log('Debug - Day of week:', dayOfWeek)
    console.log('Debug - All schedules:', schedules)
    console.log('Debug - Day schedule:', daySchedule)

    if (!daySchedule) return []

    // Check for overrides
    const overrides = await this.getAvailabilityOverrides(bookingLinkId, dateStr, dateStr)
    const override = overrides[0]

    if (override && !override.is_available) return []

    // Use override times if available, otherwise use regular schedule
    const startTime = override?.start_time || daySchedule.start_time
    const endTime = override?.end_time || daySchedule.end_time

    // Generate time slots
    const slots: TimeSlot[] = []
    const slotDuration = bookingLink.duration_minutes
    const bufferMinutes = bookingLink.buffer_minutes

    // Handle both HH:MM and HH:MM:SS formats
    const startTimeParts = startTime.split(':')
    const endTimeParts = endTime.split(':')
    
    const [startHour, startMinute] = [parseInt(startTimeParts[0]), parseInt(startTimeParts[1])]
    const [endHour, endMinute] = [parseInt(endTimeParts[0]), parseInt(endTimeParts[1])]

    const startDateTime = new Date(date)
    startDateTime.setHours(startHour, startMinute, 0, 0)

    const endDateTime = new Date(date)
    endDateTime.setHours(endHour, endMinute, 0, 0)

    const currentTime = new Date()
    const advanceNoticeTime = new Date(currentTime.getTime() + bookingLink.advance_notice_hours * 60 * 60 * 1000)

    let slotStart = new Date(startDateTime)
    while (slotStart < endDateTime) {
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)
      
      if (slotEnd <= endDateTime && slotStart >= advanceNoticeTime) {
        // Check if slot is available
        const isAvailable = await this.isTimeSlotAvailable(
          bookingLinkId,
          slotStart.toISOString(),
          slotEnd.toISOString()
        )

        slots.push({
          start: new Date(slotStart),
          end: new Date(slotEnd),
          available: isAvailable
        })
      }

      // Move to next slot (including buffer time)
      slotStart = new Date(slotStart.getTime() + (slotDuration + bufferMinutes) * 60 * 1000)
    }

    return slots
  }

  static async isTimeSlotAvailable(bookingLinkId: string, startTime: string, endTime: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('is_time_slot_available', {
        p_booking_link_id: bookingLinkId,
        p_start_time: startTime,
        p_end_time: endTime
      })

    if (error) throw error
    return data
  }

  // Bookings
  static async createBooking(
    bookingLinkId: string, 
    tenantId: string,
    startTime: string, 
    endTime: string, 
    formData: BookingFormData
  ): Promise<Booking> {
    // Verify slot is still available
    const isAvailable = await this.isTimeSlotAvailable(bookingLinkId, startTime, endTime)
    if (!isAvailable) {
      throw new Error('This time slot is no longer available')
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        booking_link_id: bookingLinkId,
        tenant_id: tenantId,
        start_time: startTime,
        end_time: endTime,
        ...formData
      })
      .select()
      .single()

    if (error) throw error

    // Send confirmation notification
    try {
      await supabase.functions.invoke('send-booking-notifications', {
        body: {
          bookingId: data.id,
          type: 'confirmation'
        }
      })
    } catch (notificationError) {
      console.error('Failed to send booking notification:', notificationError)
      // Don't throw - booking was still created successfully
    }

    return data
  }

  static async getBookingByConfirmationToken(token: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('confirmation_token', token)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  static async getUserBookings(bookingLinkId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_link_id', bookingLinkId)
      .order('start_time', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async cancelBooking(id: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason
      })
      .eq('id', id)

    if (error) throw error
  }

  static async updateBookingStatus(id: string, status: Booking['status']): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)

    if (error) throw error
  }

  // Helper to get booking link by ID (private method)
  private static async getBookingLinkById(id: string): Promise<BookingLink | null> {
    const { data, error } = await supabase
      .from('booking_links')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }
}