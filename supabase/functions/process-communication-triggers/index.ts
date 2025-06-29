import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { 
      trigger_type, 
      job_id, 
      technician_location, 
      payment_id,
      test_mode = false 
    } = await req.json()

    console.log('Processing communication trigger:', { trigger_type, job_id, test_mode })

    // Get job details for context
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select(`
        *,
        accounts:account_id(name, phone, email),
        contacts:contact_id(first_name, last_name, phone, email),
        assigned_technician:assigned_technician_id(first_name, last_name, phone),
        tenants:tenant_id(company_name, phone, email)
      `)
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      throw new Error(`Job not found: ${job_id}`)
    }

    // Get active triggers for this tenant and trigger type
    const { data: triggers, error: triggersError } = await supabaseClient
      .from('communication_triggers')
      .select('*')
      .eq('tenant_id', job.tenant_id)
      .eq('trigger_type', trigger_type)
      .eq('active', true)

    if (triggersError) throw triggersError

    const results = []

    for (const trigger of triggers || []) {
      // Check if trigger conditions are met
      if (!shouldTrigger(trigger, { job, technician_location, trigger_type })) {
        continue
      }

      // Check rate limiting - don't spam customers
      const recentSend = await checkRecentSend(supabaseClient, trigger.id, job_id)
      if (recentSend && !test_mode) {
        console.log(`Skipping trigger ${trigger.id} - recently sent`)
        continue
      }

      // Prepare message variables
      const variables = buildMessageVariables(job, trigger)

      // Send SMS if enabled
      if (trigger.message_template.sms_enabled && job.contacts?.phone) {
        const smsResult = await sendSMS(
          supabaseClient,
          job.contacts.phone,
          replaceVariables(trigger.message_template.sms_message, variables)
        )
        results.push({ type: 'sms', success: smsResult.success, error: smsResult.error })
      }

      // Send Email if enabled
      if (trigger.message_template.email_enabled && job.contacts?.email) {
        const emailResult = await sendEmail(
          supabaseClient,
          job.contacts.email,
          replaceVariables(trigger.message_template.email_subject, variables),
          replaceVariables(trigger.message_template.email_body, variables)
        )
        results.push({ type: 'email', success: emailResult.success, error: emailResult.error })
      }

      // Log the trigger execution
      if (!test_mode) {
        await supabaseClient
          .from('communication_trigger_logs')
          .insert({
            trigger_id: trigger.id,
            job_id: job_id,
            recipient_phone: job.contacts?.phone,
            recipient_email: job.contacts?.email,
            message_sent: replaceVariables(trigger.message_template.sms_message, variables),
            sent_at: new Date().toISOString(),
            success: results.every(r => r.success)
          })

        // Update trigger send count
        await supabaseClient
          .from('communication_triggers')
          .update({ 
            send_count: trigger.send_count + 1,
            last_sent: new Date().toISOString()
          })
          .eq('id', trigger.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        triggers_processed: triggers?.length || 0
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error processing communication triggers:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function shouldTrigger(trigger: any, context: any): boolean {
  const { job, technician_location, trigger_type } = context

  switch (trigger_type) {
    case 'job_status':
      return job.status === trigger.trigger_conditions.status

    case 'location_proximity':
      if (!technician_location || !job.service_address_lat || !job.service_address_lng) {
        return false
      }
      const distance = calculateDistance(
        technician_location.lat,
        technician_location.lng,
        job.service_address_lat,
        job.service_address_lng
      )
      return distance <= trigger.trigger_conditions.distance_meters

    case 'appointment_reminder':
      if (!job.scheduled_start) return false
      const appointmentTime = new Date(job.scheduled_start).getTime()
      const now = Date.now()
      const timeDiff = appointmentTime - now
      const triggerTime = trigger.trigger_conditions.time_before_minutes * 60 * 1000
      return Math.abs(timeDiff - triggerTime) < 300000 // Within 5 minutes of trigger time

    case 'payment_status':
      // This would be called from payment webhook
      return true

    default:
      return false
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180
  const φ2 = lat2 * Math.PI/180
  const Δφ = (lat2-lat1) * Math.PI/180
  const Δλ = (lon2-lon1) * Math.PI/180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

async function checkRecentSend(supabaseClient: any, triggerId: string, jobId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  
  const { data } = await supabaseClient
    .from('communication_trigger_logs')
    .select('id')
    .eq('trigger_id', triggerId)
    .eq('job_id', jobId)
    .gte('sent_at', oneHourAgo)
    .limit(1)

  return data && data.length > 0
}

function buildMessageVariables(job: any, trigger: any): Record<string, string> {
  const now = new Date()
  
  return {
    customer_name: job.contacts?.first_name 
      ? `${job.contacts.first_name} ${job.contacts.last_name || ''}`.trim()
      : job.accounts?.name || 'Valued Customer',
    technician_name: job.assigned_technician 
      ? `${job.assigned_technician.first_name} ${job.assigned_technician.last_name || ''}`.trim()
      : 'Our Technician',
    company_name: job.tenants?.company_name || 'TradeWorks Pro',
    company_phone: job.tenants?.phone || '(555) 123-4567',
    service_type: job.service_type || 'Service',
    address: job.service_address || job.contacts?.address || 'your location',
    appointment_time: job.scheduled_start 
      ? new Date(job.scheduled_start).toLocaleString('en-US', {
          weekday: 'long',
          month: 'long', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'your scheduled time',
    job_number: job.job_number || job.id.slice(0, 8).toUpperCase(),
    amount: job.total_amount ? `$${job.total_amount}` : '$0.00',
    portal_link: `${Deno.env.get('FRONTEND_URL')}/portal/${job.id}`,
    invoice_link: `${Deno.env.get('FRONTEND_URL')}/invoice/${job.id}`,
    receipt_link: `${Deno.env.get('FRONTEND_URL')}/receipt/${job.id}`,
    emergency_phone: job.tenants?.emergency_phone || job.tenants?.phone || '(555) 911-HELP'
  }
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    result = result.replace(regex, value)
  })
  
  return result
}

async function sendSMS(supabaseClient: any, toNumber: string, message: string) {
  try {
    const { data, error } = await supabaseClient.functions.invoke('send-sms', {
      body: {
        to: toNumber,
        body: message
      }
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('SMS send error:', error)
    return { success: false, error: error.message }
  }
}

async function sendEmail(supabaseClient: any, toEmail: string, subject: string, body: string) {
  try {
    // This would integrate with your email service (SendGrid, etc.)
    const { data, error } = await supabaseClient.functions.invoke('send-email', {
      body: {
        to: toEmail,
        subject: subject,
        html: body.replace(/\n/g, '<br>')
      }
    })

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: error.message }
  }
}