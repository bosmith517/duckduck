import * as Yup from 'yup'
import { supabase } from '../../supabaseClient'

// Phone number validation regex for format (xxx) xxx-xxxx
const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/

// Format phone number to (xxx) xxx-xxxx
export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const numbers = value.replace(/\D/g, '')
  
  // Format based on length
  if (numbers.length === 0) return ''
  if (numbers.length <= 3) return `(${numbers}`
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
  if (numbers.length <= 10) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`
  // If more than 10 digits, only use first 10
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
}

// Unformat phone number to just digits
export const unformatPhoneNumber = (value: string): string => {
  return value.replace(/\D/g, '')
}

// Common validation messages
const validationMessages = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Phone number must be in format (xxx) xxx-xxxx',
  futureDate: 'Date must be in the future',
  endTimeAfterStart: 'End time must be after start time',
  businessHours: 'Appointments must be scheduled during business hours (8 AM - 6 PM)',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
}

// Business hours validation (8 AM to 6 PM)
const isWithinBusinessHours = (time: string): boolean => {
  const [hours] = time.split(':').map(Number)
  return hours >= 8 && hours < 18
}

// Check if end time is after start time
const isEndTimeAfterStartTime = (startTime: string, endTime: string): boolean => {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  
  const startTotalMinutes = startHours * 60 + startMinutes
  const endTotalMinutes = endHours * 60 + endMinutes
  
  return endTotalMinutes > startTotalMinutes
}

// Site Visit Validation Schema
export const siteVisitSchema = Yup.object().shape({
  site_visit_date: Yup.date()
    .required(validationMessages.required)
    .min(new Date(), validationMessages.futureDate),
  site_visit_time: Yup.string()
    .required(validationMessages.required)
    .test('business-hours', validationMessages.businessHours, (value) => {
      if (!value) return false
      return isWithinBusinessHours(value)
    }),
  estimated_duration: Yup.string()
    .required(validationMessages.required),
  notes: Yup.string()
    .max(500, validationMessages.maxLength(500))
})

// Schedule Event Validation Schema
export const scheduleEventSchema = Yup.object().shape({
  title: Yup.string()
    .required(validationMessages.required)
    .min(3, validationMessages.minLength(3))
    .max(100, validationMessages.maxLength(100)),
  client: Yup.string()
    .required(validationMessages.required)
    .min(2, validationMessages.minLength(2))
    .max(100, validationMessages.maxLength(100)),
  type: Yup.string()
    .required(validationMessages.required)
    .oneOf(['meeting', 'work', 'inspection', 'delivery'], 'Please select a valid event type'),
  date: Yup.date()
    .required(validationMessages.required)
    .min(new Date().toISOString().split('T')[0], validationMessages.futureDate),
  startTime: Yup.string()
    .required(validationMessages.required),
  endTime: Yup.string()
    .required(validationMessages.required)
    .test('end-after-start', validationMessages.endTimeAfterStart, function(value) {
      const { startTime } = this.parent
      if (!value || !startTime) return false
      return isEndTimeAfterStartTime(startTime, value)
    }),
  location: Yup.string()
    .required(validationMessages.required)
    .min(5, validationMessages.minLength(5))
    .max(200, validationMessages.maxLength(200)),
  assignedTo: Yup.string()
    .required(validationMessages.required),
  notes: Yup.string()
    .max(500, validationMessages.maxLength(500))
})

// Public Booking Validation Schema
export const publicBookingSchema = Yup.object().shape({
  customer_name: Yup.string()
    .required(validationMessages.required)
    .min(2, validationMessages.minLength(2))
    .max(100, validationMessages.maxLength(100))
    .matches(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  customer_email: Yup.string()
    .required(validationMessages.required)
    .email(validationMessages.email),
  customer_phone: Yup.string()
    .required(validationMessages.required)
    .matches(phoneRegex, validationMessages.phone),
  service_type: Yup.string()
    .required('Please select a service type'),
  preferred_date: Yup.date()
    .required(validationMessages.required)
    .min(new Date(), validationMessages.futureDate),
  preferred_time: Yup.string()
    .required(validationMessages.required),
  address: Yup.string()
    .required(validationMessages.required)
    .min(10, validationMessages.minLength(10))
    .max(200, validationMessages.maxLength(200)),
  message: Yup.string()
    .max(500, validationMessages.maxLength(500))
})

// Inspection Scheduling Validation Schema
export const inspectionScheduleSchema = Yup.object().shape({
  scheduled_date: Yup.date()
    .required(validationMessages.required)
    .min(new Date(), validationMessages.futureDate),
  inspector_name: Yup.string()
    .required(validationMessages.required)
    .min(2, validationMessages.minLength(2))
    .max(100, validationMessages.maxLength(100)),
  inspector_contact: Yup.string()
    .required(validationMessages.required)
    .test('valid-contact', 'Please enter a valid email or phone number', (value) => {
      if (!value) return false
      // Check if it's an email
      if (value.includes('@')) {
        return Yup.string().email().isValidSync(value)
      }
      // Otherwise check if it's a phone number
      return phoneRegex.test(value)
    }),
  notes: Yup.string()
    .max(500, validationMessages.maxLength(500))
})

// Helper function to validate for time conflicts
export const checkTimeConflict = async (
  date: string,
  startTime: string,
  endTime: string,
  tenantId: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    // Combine date and times into full timestamps
    const startDateTime = new Date(`${date}T${startTime}`).toISOString()
    const endDateTime = new Date(`${date}T${endTime}`).toISOString()
    
    // Check for conflicts in jobs table
    let jobQuery = supabase
      .from('jobs')
      .select('id, start_date, due_date')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'completed')
      .or(`start_date.gte.${startDateTime},start_date.lt.${endDateTime}`)
      .or(`due_date.gt.${startDateTime},due_date.lte.${endDateTime}`)
      .or(`and(start_date.lte.${startDateTime},due_date.gte.${endDateTime})`)
    
    if (excludeId && excludeId.startsWith('job-')) {
      jobQuery = jobQuery.not('id', 'eq', excludeId.replace('job-', ''))
    }
    
    const { data: jobConflicts } = await jobQuery
    
    // Check for conflicts in calendar_events table
    let calendarQuery = supabase
      .from('calendar_events')
      .select('id, start_time, end_time')
      .eq('tenant_id', tenantId)
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'completed')
      .or(`start_time.gte.${startDateTime},start_time.lt.${endDateTime}`)
      .or(`end_time.gt.${startDateTime},end_time.lte.${endDateTime}`)
      .or(`and(start_time.lte.${startDateTime},end_time.gte.${endDateTime})`)
    
    if (excludeId && excludeId.startsWith('calendar-')) {
      calendarQuery = calendarQuery.not('id', 'eq', excludeId.replace('calendar-', ''))
    }
    
    const { data: calendarConflicts } = await calendarQuery
    
    // Return true if any conflicts found
    return Boolean((jobConflicts && jobConflicts.length > 0) || (calendarConflicts && calendarConflicts.length > 0))
  } catch (error) {
    console.error('Error checking time conflicts:', error)
    // Return false on error to not block the user
    return false
  }
}

// Helper function to check for duplicate appointments
export const checkDuplicateAppointment = async (
  clientName: string,
  date: string,
  tenantId: string,
  excludeId?: string
): Promise<boolean> => {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    // Check for duplicates in jobs table
    let jobQuery = supabase
      .from('jobs')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('title', `%${clientName}%`)
      .gte('start_date', startOfDay.toISOString())
      .lte('start_date', endOfDay.toISOString())
      .not('status', 'eq', 'cancelled')
    
    if (excludeId && excludeId.startsWith('job-')) {
      jobQuery = jobQuery.not('id', 'eq', excludeId.replace('job-', ''))
    }
    
    const { data: jobDuplicates } = await jobQuery
    
    // Check for duplicates in calendar_events table
    let calendarQuery = supabase
      .from('calendar_events')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('title', `%${clientName}%`)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .not('status', 'eq', 'cancelled')
    
    if (excludeId && excludeId.startsWith('calendar-')) {
      calendarQuery = calendarQuery.not('id', 'eq', excludeId.replace('calendar-', ''))
    }
    
    const { data: calendarDuplicates } = await calendarQuery
    
    // Also check leads with site visits on the same day
    const { data: leadDuplicates } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${clientName}%`)
      .gte('site_visit_date', startOfDay.toISOString())
      .lte('site_visit_date', endOfDay.toISOString())
      .not('status', 'eq', 'cancelled')
    
    // Return true if any duplicates found
    return Boolean((jobDuplicates && jobDuplicates.length > 0) || 
           (calendarDuplicates && calendarDuplicates.length > 0) ||
           (leadDuplicates && leadDuplicates.length > 0))
  } catch (error) {
    console.error('Error checking duplicate appointments:', error)
    // Return false on error to not block the user
    return false
  }
}

// Custom validation method for async validations (conflicts, duplicates)
export const validateAppointmentAsync = async (
  values: any,
  tenantId: string,
  excludeId?: string
) => {
  const errors: any = {}

  // Check for time conflicts
  if (values.date && values.startTime && values.endTime) {
    const hasConflict = await checkTimeConflict(
      values.date,
      values.startTime,
      values.endTime,
      tenantId,
      excludeId
    )
    if (hasConflict) {
      errors.startTime = 'This time slot conflicts with another appointment'
    }
  }

  // Check for duplicate appointments
  if (values.client && values.date) {
    const isDuplicate = await checkDuplicateAppointment(
      values.client,
      values.date,
      tenantId,
      excludeId
    )
    if (isDuplicate) {
      errors.client = 'An appointment already exists for this client on this date'
    }
  }

  return errors
}