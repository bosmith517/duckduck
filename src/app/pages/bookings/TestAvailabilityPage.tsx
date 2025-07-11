import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookingService } from '../../services/bookingService'
import { supabase } from '../../../supabaseClient'

const TestAvailabilityPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (slug) {
      testAvailability()
    }
  }, [slug])

  const testAvailability = async () => {
    try {
      setLoading(true)
      const testResults: any = {}

      // 1. Get booking link
      const bookingLink = await BookingService.getBookingLinkBySlug(slug!)
      testResults.bookingLink = bookingLink

      if (!bookingLink) {
        testResults.error = 'Booking link not found'
        setResults(testResults)
        return
      }

      // 2. Get availability schedules
      const schedules = await BookingService.getAvailabilitySchedules(bookingLink.id)
      testResults.schedules = schedules

      // 3. Check a specific day (today)
      const today = new Date()
      const dayOfWeek = today.getDay()
      testResults.todayDayOfWeek = dayOfWeek
      
      const todaySchedule = schedules.find(s => s.day_of_week === dayOfWeek)
      testResults.todaySchedule = todaySchedule

      // 4. Get available time slots for today
      try {
        const timeSlots = await BookingService.getAvailableTimeSlots(bookingLink.id, today)
        testResults.timeSlots = timeSlots
      } catch (error) {
        testResults.timeSlotsError = error
      }

      // 5. Direct database query to check schedules
      const { data: directSchedules, error: scheduleError } = await supabase
        .from('availability_schedules')
        .select('*')
        .eq('booking_link_id', bookingLink.id)
      
      testResults.directSchedules = directSchedules
      testResults.scheduleError = scheduleError

      // 6. Test the RPC function
      const testDate = new Date()
      testDate.setHours(14, 0, 0, 0) // 2 PM
      const testEndDate = new Date(testDate)
      testEndDate.setHours(15, 0, 0, 0) // 3 PM

      const { data: isAvailable, error: rpcError } = await supabase
        .rpc('is_time_slot_available', {
          p_booking_link_id: bookingLink.id,
          p_start_time: testDate.toISOString(),
          p_end_time: testEndDate.toISOString()
        })

      testResults.rpcTest = {
        startTime: testDate.toISOString(),
        endTime: testEndDate.toISOString(),
        isAvailable,
        error: rpcError
      }

      setResults(testResults)
    } catch (error) {
      setResults({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="container py-4">
      <h1>Availability Test for: {slug}</h1>
      <pre className="bg-light p-3 rounded">
        {JSON.stringify(results, null, 2)}
      </pre>
    </div>
  )
}

export default TestAvailabilityPage