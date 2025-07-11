export interface BookingLink {
  id: string
  tenant_id: string
  user_id: string
  slug: string
  title: string
  description?: string
  duration_minutes: number
  buffer_minutes: number
  advance_notice_hours: number
  future_days_available: number
  timezone: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AvailabilitySchedule {
  id: string
  booking_link_id: string
  day_of_week: number // 0=Sunday, 6=Saturday
  start_time: string // HH:MM:SS format
  end_time: string // HH:MM:SS format
  is_active: boolean
  created_at: string
}

export interface AvailabilityOverride {
  id: string
  booking_link_id: string
  date: string // YYYY-MM-DD format
  is_available: boolean
  start_time?: string // HH:MM:SS format
  end_time?: string // HH:MM:SS format
  reason?: string
  created_at: string
}

export interface Booking {
  id: string
  booking_link_id: string
  tenant_id: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  start_time: string
  end_time: string
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  notes?: string
  meeting_link?: string
  confirmation_token: string
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
  updated_at: string
}

export interface TimeSlot {
  start: Date
  end: Date
  available: boolean
}

export interface BookingFormData {
  customer_name: string
  customer_email: string
  customer_phone?: string
  notes?: string
}

export interface CreateBookingLinkData {
  title: string
  description?: string
  duration_minutes: number
  buffer_minutes?: number
  advance_notice_hours?: number
  future_days_available?: number
  timezone?: string
}

export interface UpdateAvailabilityData {
  schedules: Omit<AvailabilitySchedule, 'id' | 'booking_link_id' | 'created_at'>[]
}