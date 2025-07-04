import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: {
    id: string
    object: string
    to: string[]
    from: string
    subject: string
    html?: string
    text?: string
    bcc?: string[]
    cc?: string[]
    reply_to?: string[]
    last_event: string
    created_at: string
    // Event-specific fields
    bounce?: {
      type: string
      message: string
    }
    complaint?: {
      type: string
      message: string
    }
    click?: {
      ipAddress: string
      link: string
      timestamp: string
      userAgent: string
    }
    open?: {
      ipAddress: string
      timestamp: string
      userAgent: string
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse webhook payload
    const payload: ResendWebhookEvent = await req.json()
    
    console.log('Received Resend webhook:', payload.type, payload.data.id)

    // Extract email details
    const emailId = payload.data.id
    const toEmail = payload.data.to[0] // Assuming single recipient
    const fromEmail = payload.data.from
    const subject = payload.data.subject
    const eventType = payload.type.replace('email.', '') // Remove 'email.' prefix

    // Find tenant by checking existing email events or domain
    let tenantId: string | null = null
    
    // First, try to find existing event for this email
    const { data: existingEvent } = await supabaseClient
      .from('email_events')
      .select('tenant_id')
      .eq('resend_email_id', emailId)
      .single()

    if (existingEvent) {
      tenantId = existingEvent.tenant_id
    } else {
      // If no existing event, try to find tenant by from_email domain
      const fromDomain = fromEmail.split('@')[1]
      const { data: domainData } = await supabaseClient
        .from('tenant_email_domains')
        .select('tenant_id')
        .eq('domain_name', fromDomain)
        .eq('status', 'verified')
        .single()

      if (domainData) {
        tenantId = domainData.tenant_id
      }
    }

    if (!tenantId) {
      console.error('Could not determine tenant for email:', emailId)
      return new Response(
        JSON.stringify({ error: 'Tenant not found for email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare event data
    const eventData: any = {
      tenant_id: tenantId,
      resend_email_id: emailId,
      message_id: payload.data.id,
      event_type: eventType,
      to_email: toEmail,
      from_email: fromEmail,
      subject: subject,
      event_data: {
        created_at: payload.created_at,
        last_event: payload.data.last_event,
        ...payload.data
      },
      event_timestamp: payload.created_at
    }

    // Add event-specific data
    switch (eventType) {
      case 'bounced':
        eventData.bounce_reason = payload.data.bounce?.message || 'Unknown bounce reason'
        break
      case 'complained':
        eventData.complaint_reason = payload.data.complaint?.message || 'Spam complaint'
        break
      case 'clicked':
        eventData.event_data.click_data = payload.data.click
        break
      case 'opened':
        eventData.event_data.open_data = payload.data.open
        break
    }

    // Insert event record
    const { error: eventError } = await supabaseClient
      .from('email_events')
      .insert(eventData)

    if (eventError) {
      console.error('Error inserting email event:', eventError)
      return new Response(
        JSON.stringify({ error: 'Failed to record email event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update email usage counters
    const { error: usageError } = await supabaseClient
      .rpc('update_email_usage', {
        p_tenant_id: tenantId,
        p_event_type: eventType
      })

    if (usageError) {
      console.error('Error updating email usage:', usageError)
      // Don't fail the webhook for this - just log the error
    }

    // Update email queue status if this is a sent email
    if (eventType === 'sent' || eventType === 'delivered') {
      const { error: queueError } = await supabaseClient
        .from('email_queue')
        .update({
          status: eventType === 'sent' ? 'sent' : 'sent',
          resend_email_id: emailId,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('resend_email_id', emailId)

      if (queueError) {
        console.error('Error updating email queue:', queueError)
      }
    }

    // Handle bounces and complaints - mark email as problematic
    if (eventType === 'bounced' || eventType === 'complained') {
      const { error: queueError } = await supabaseClient
        .from('email_queue')
        .update({
          status: 'failed',
          error_message: eventType === 'bounced' ? eventData.bounce_reason : eventData.complaint_reason,
          updated_at: new Date().toISOString()
        })
        .eq('resend_email_id', emailId)

      if (queueError) {
        console.error('Error updating failed email queue:', queueError)
      }
    }

    console.log('Successfully processed webhook event:', eventType, 'for tenant:', tenantId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_type: eventType, 
        tenant_id: tenantId,
        email_id: emailId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing Resend webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/* 
This webhook handler processes Resend email events and updates the database accordingly.

Supported Events:
- email.sent - Email was sent successfully
- email.delivered - Email was delivered to recipient
- email.bounced - Email bounced (hard/soft bounce)
- email.complained - Recipient marked as spam
- email.opened - Recipient opened the email
- email.clicked - Recipient clicked a link in the email

The webhook:
1. Identifies the tenant from the email ID or domain
2. Records the event in the email_events table
3. Updates usage counters for the tenant
4. Updates the email queue status
5. Handles bounces and complaints appropriately

To configure in Resend:
1. Go to your Resend dashboard
2. Add webhook endpoint: https://your-project.supabase.co/functions/v1/resend-webhook
3. Select the events you want to track
4. Optionally add webhook secret for security
*/