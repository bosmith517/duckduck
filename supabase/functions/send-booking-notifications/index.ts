import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BookingNotificationRequest {
  bookingId: string
  type: 'confirmation' | 'reminder' | 'cancellation'
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { bookingId, type } = await req.json() as BookingNotificationRequest

    // Fetch booking details with related data
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        booking_link:booking_links!inner(
          *,
          user:auth.users!inner(
            email,
            raw_user_meta_data
          )
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      throw new Error('Booking not found')
    }

    // Get tenant branding for email customization
    const { data: tenant } = await supabaseClient
      .from('tenants')
      .select('name, email_from, email_reply_to')
      .eq('id', booking.tenant_id)
      .single()

    // Format date and time
    const startTime = new Date(booking.start_time)
    const endTime = new Date(booking.end_time)
    const dateStr = startTime.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const timeStr = `${startTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })} - ${endTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })}`

    // Prepare email content based on notification type
    let subject = ''
    let emailBody = ''
    let recipientEmail = booking.customer_email
    let ccEmail = booking.booking_link.user.email

    switch (type) {
      case 'confirmation':
        subject = `Booking Confirmed: ${booking.booking_link.title}`
        emailBody = `
          <h2>Booking Confirmed!</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>Your booking has been confirmed with the following details:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${booking.booking_link.title}</h3>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            <p><strong>Duration:</strong> ${booking.booking_link.duration_minutes} minutes</p>
            ${booking.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${booking.meeting_link}">${booking.meeting_link}</a></p>` : ''}
            ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
          </div>
          <p>Need to make changes? Use your confirmation code: <strong>${booking.confirmation_token.slice(0, 8).toUpperCase()}</strong></p>
          <p>Thank you for booking with ${tenant?.name || 'us'}!</p>
        `
        break

      case 'reminder':
        const hoursUntil = Math.round((startTime.getTime() - Date.now()) / (1000 * 60 * 60))
        subject = `Reminder: ${booking.booking_link.title} in ${hoursUntil} hours`
        emailBody = `
          <h2>Booking Reminder</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>This is a reminder about your upcoming booking:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${booking.booking_link.title}</h3>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Time:</strong> ${timeStr}</p>
            ${booking.meeting_link ? `<p><strong>Meeting Link:</strong> <a href="${booking.meeting_link}">${booking.meeting_link}</a></p>` : ''}
          </div>
          <p>We look forward to seeing you!</p>
        `
        break

      case 'cancellation':
        subject = `Booking Cancelled: ${booking.booking_link.title}`
        emailBody = `
          <h2>Booking Cancelled</h2>
          <p>Hi ${booking.customer_name},</p>
          <p>Your booking has been cancelled:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${booking.booking_link.title}</h3>
            <p><strong>Original Date:</strong> ${dateStr}</p>
            <p><strong>Original Time:</strong> ${timeStr}</p>
            ${booking.cancellation_reason ? `<p><strong>Reason:</strong> ${booking.cancellation_reason}</p>` : ''}
          </div>
          <p>If you'd like to reschedule, please visit our booking page.</p>
        `
        break
    }

    // Send email via SendGrid
    const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: recipientEmail,
        cc: type === 'confirmation' ? ccEmail : undefined,
        subject: subject,
        html: emailBody,
        from: tenant?.email_from || 'noreply@tradeworkspro.com',
        replyTo: tenant?.email_reply_to || tenant?.email_from
      }
    })

    if (emailError) {
      console.error('Email send error:', emailError)
      throw new Error('Failed to send email notification')
    }

    // Also send SMS notification if phone number provided
    if (booking.customer_phone && (type === 'confirmation' || type === 'reminder')) {
      const smsMessage = type === 'confirmation' 
        ? `Your booking for ${booking.booking_link.title} on ${dateStr} at ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} has been confirmed.`
        : `Reminder: Your booking for ${booking.booking_link.title} is coming up on ${dateStr} at ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`

      await supabaseClient.functions.invoke('send-sms', {
        body: {
          to: booking.customer_phone,
          message: smsMessage
        }
      })
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-booking-notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})