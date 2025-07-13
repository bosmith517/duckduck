import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { 
      session_id, 
      customer_phone, 
      customer_email,
      magic_link, 
      send_sms = true, 
      send_email = false 
    } = await req.json()

    if (!session_id || !magic_link) {
      throw new Error('session_id and magic_link are required')
    }

    if (!send_sms && !send_email) {
      throw new Error('At least one notification method must be enabled')
    }

    if (send_sms && !customer_phone) {
      throw new Error('customer_phone is required for SMS')
    }

    if (send_email && !customer_email) {
      throw new Error('customer_email is required for email')
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get session details with RLS bypassed
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select(`
        *,
        leads(name, phone_number, email),
        contacts(first_name, last_name, phone, email),
        accounts(name, phone, email)
      `)
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError)
      throw new Error(`Session not found: ${session_id}`)
    }

    const customer = session.leads || session.contacts || session.accounts
    const customerName = customer ? (
      'name' in customer ? customer.name :
      `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    ) : 'Customer'

    const scheduledTime = session.scheduled_at ? 
      new Date(session.scheduled_at).toLocaleString() : 
      'as soon as possible'

    const tradeType = session.trade_type.toLowerCase()

    const messages = {
      sms: `Hi ${customerName}! Your ${tradeType} video estimate is scheduled for ${scheduledTime}. Join here: ${magic_link}`,
      email: {
        subject: `Video Estimate Session - ${session.trade_type}`,
        body: `
Dear ${customerName},

Your video estimate session for ${tradeType} work is scheduled for ${scheduledTime}.

What to expect:
• Our technician will guide you through showing the areas that need attention
• The session typically takes 10-15 minutes
• You'll receive a detailed estimate immediately after

Join your session: ${magic_link}

Questions? Reply to this message or call us.

Best regards,
Your Service Team
        `.trim()
      }
    }

    const results: any = { sent: [] }

    // Send SMS
    if (send_sms) {
      try {
        const { error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            to: customer_phone,
            message: messages.sms,
            from_number: null // Will use default number
          }
        })

        if (smsError) {
          console.error('SMS error:', smsError)
          results.sms_error = smsError.message
        } else {
          results.sent.push('sms')
        }
      } catch (error) {
        console.error('SMS sending failed:', error)
        results.sms_error = error.message
      }
    }

    // Send Email
    if (send_email) {
      try {
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: customer_email,
            subject: messages.email.subject,
            html: messages.email.body.replace(/\n/g, '<br>'),
            text: messages.email.body
          }
        })

        if (emailError) {
          console.error('Email error:', emailError)
          results.email_error = emailError.message
        } else {
          results.sent.push('email')
        }
      } catch (error) {
        console.error('Email sending failed:', error)
        results.email_error = error.message
      }
    }

    // Log the invitation (check if table exists first)
    try {
      const { error: logError } = await supabase
        .from('session_invitations')
        .insert({
          session_id,
          phone_number: send_sms ? customer_phone : null,
          email_address: send_email ? customer_email : null,
          magic_link,
          sent_via: results.sent,
          sent_at: new Date().toISOString()
        })

      if (logError) {
        console.error('Error logging invitation:', logError)
        // Continue anyway - logging failure shouldn't stop the invitation
      }
    } catch (err) {
      console.error('Failed to log invitation:', err)
      // Continue anyway
    }

    return new Response(
      JSON.stringify(results),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending session invite:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})