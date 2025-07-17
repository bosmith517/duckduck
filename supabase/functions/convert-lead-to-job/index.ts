import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Phone number normalization utility
function normalizePhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null
  }

  // Remove all formatting characters and extract digits
  const digitsOnly = phoneNumber.replace(/\D/g, '')
  
  if (!digitsOnly) {
    return null
  }

  // Handle US phone numbers
  if (digitsOnly.length === 10) {
    // US 10-digit number, add country code
    return `+1${digitsOnly}`
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US 11-digit number with country code
    return `+${digitsOnly}`
  }

  return null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadConversionRequest {
  leadId: string
  jobDetails: {
    property_address: string
    property_city: string
    property_state: string
    property_zip: string
    service_type: string
    job_description: string
    estimate_date: string
    estimate_time: string
    assigned_technician: string
    estimated_duration: number
    estimated_value: number
    special_instructions?: string
  }
}

interface LeadData {
  id: string
  caller_name: string
  phone_number: string
  email: string
  initial_request: string
  service_type: string
  tenant_id: string
  status: string
  urgency?: string
  notes?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { leadId, jobDetails }: LeadConversionRequest = await req.json()

    if (!leadId || !jobDetails) {
      return new Response(
        JSON.stringify({ error: 'Missing leadId or jobDetails' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Start transaction by fetching lead data
    const { data: lead, error: leadError } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found', details: leadError }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const leadData = lead as LeadData

    // Step 1: Find or create contact
    let contact = null
    const phoneNumber = normalizePhoneNumber(leadData.phone_number) || leadData.phone_number
    const email = leadData.email

    // Search for existing contact by normalized phone or email
    const { data: existingContacts } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('tenant_id', leadData.tenant_id)
      .or(`phone.eq.${phoneNumber},email.eq.${email}`)
      .limit(1)

    if (existingContacts && existingContacts.length > 0) {
      // Update existing contact with latest information
      const { data: updatedContact, error: updateError } = await supabaseClient
        .from('contacts')
        .update({
          address_line1: jobDetails.property_address,
          city: jobDetails.property_city,
          state: jobDetails.property_state,
          zip_code: jobDetails.property_zip,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContacts[0].id)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update contact: ${updateError.message}`)
      }
      contact = updatedContact
    } else {
      // Create new contact
      const callerName = leadData.caller_name || 'Unknown'
      const contactData = {
        tenant_id: leadData.tenant_id,
        first_name: callerName.split(' ')[0] || callerName,
        last_name: callerName.split(' ').slice(1).join(' ') || '',
        name: callerName,
        phone: phoneNumber,
        email: email,
        contact_type: 'individual',
        address_line1: jobDetails.property_address,
        city: jobDetails.property_city,
        state: jobDetails.property_state,
        zip_code: jobDetails.property_zip,
        notes: `Created from lead: ${leadData.initial_request || leadData.service_type || 'Converted from customer journey'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: newContact, error: contactError } = await supabaseClient
        .from('contacts')
        .insert(contactData)
        .select()
        .single()

      if (contactError) {
        throw new Error(`Failed to create contact: ${contactError.message}`)
      }
      contact = newContact
    }

    // Step 2: Create job record
    const estimateDateTime = new Date(`${jobDetails.estimate_date}T${jobDetails.estimate_time}:00`)
    const jobData = {
      tenant_id: leadData.tenant_id,
      contact_id: contact.id,
      lead_id: leadId,
      job_number: `JOB-${Date.now()}`,
      title: `${jobDetails.service_type} - ${leadData.caller_name}`,
      description: jobDetails.job_description,
      status: 'needs_estimate',
      priority: leadData.urgency === 'emergency' ? 'high' : leadData.urgency === 'high' ? 'medium' : 'low',
      start_date: estimateDateTime.toISOString(),
      estimated_hours: jobDetails.estimated_duration,
      estimated_cost: jobDetails.estimated_value,
      location_address: jobDetails.property_address,
      location_city: jobDetails.property_city,
      location_state: jobDetails.property_state,
      location_zip: jobDetails.property_zip,
      assigned_technician_id: jobDetails.assigned_technician,
      notes: jobDetails.special_instructions || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .insert(jobData)
      .select()
      .single()

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`)
    }

    // Step 3: Update lead status to converted
    const { error: leadUpdateError } = await supabaseClient
      .from('leads')
      .update({
        status: 'converted',
        converted_to_job_id: job.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)

    if (leadUpdateError) {
      throw new Error(`Failed to update lead status: ${leadUpdateError.message}`)
    }

    // Step 4: Create job activity log entry
    const activityData = {
      tenant_id: leadData.tenant_id,
      job_id: job.id,
      activity_type: 'job_created',
      activity_category: 'system',
      title: 'Job Created from Lead',
      description: `Job created from lead conversion for ${leadData.caller_name}`,
      reference_id: leadId,
      reference_type: 'lead',
      is_visible_to_customer: true,
      is_milestone: true,
      created_at: new Date().toISOString()
    }

    const { error: activityError } = await supabaseClient
      .from('job_activity_log')
      .insert(activityData)

    if (activityError) {
      console.error('Failed to create activity log:', activityError)
      // Don't fail the whole transaction for activity log errors
    }

    // Step 5: Create calendar event for technician
    const calendarEventData = {
      tenant_id: leadData.tenant_id,
      user_id: jobDetails.assigned_technician,
      job_id: job.id,
      event_type: 'estimate_appointment',
      title: `Estimate: ${job.title}`,
      description: `Estimate appointment for ${job.description}`,
      start_time: estimateDateTime.toISOString(),
      end_time: new Date(estimateDateTime.getTime() + (2 * 60 * 60 * 1000)).toISOString(), // 2 hours
      location: job.location_address,
      status: 'scheduled',
      created_at: new Date().toISOString()
    }

    const { error: calendarError } = await supabaseClient
      .from('calendar_events')
      .insert(calendarEventData)

    if (calendarError) {
      console.error('Failed to create calendar event:', calendarError)
      // Don't fail the whole transaction for calendar errors
    }

    // Step 6: Create notification for customer
    const notificationData = {
      tenant_id: leadData.tenant_id,
      recipient_phone: leadData.phone_number,
      recipient_email: leadData.email,
      message_type: 'estimate_scheduled',
      message: `Hi ${leadData.caller_name}! Your ${jobDetails.service_type} estimate is scheduled for ${estimateDateTime.toLocaleDateString()} at ${estimateDateTime.toLocaleTimeString()}. We'll see you then!`,
      status: 'pending',
      scheduled_send_time: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const { error: notificationError } = await supabaseClient
      .from('notifications')
      .insert(notificationData)

    if (notificationError) {
      console.error('Failed to create notification:', notificationError)
      // Don't fail the whole transaction for notification errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        job: {
          id: job.id,
          job_number: job.job_number,
          title: job.title,
          status: job.status,
          estimated_cost: job.estimated_cost,
          start_date: job.start_date
        },
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email
        },
        lead: {
          id: leadData.id,
          status: 'converted',
          converted_to_job_id: job.id
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Lead conversion error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})