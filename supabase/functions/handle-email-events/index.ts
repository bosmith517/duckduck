import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailEvent {
  // Resend webhook event format
  type?: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked'
  created_at?: string
  data?: {
    email_id: string
    from?: string
    to?: string[]
    subject?: string
    click?: {
      link: string
      timestamp: number
    }
    bounce?: {
      type: string
      message: string
    }
    complaint?: {
      type: string
      message: string
    }
  }

  // SendGrid event format
  email?: string
  timestamp?: number
  event?: 'processed' | 'dropped' | 'delivered' | 'deferred' | 'bounce' | 'open' | 'click' | 'spamreport' | 'unsubscribe'
  sg_message_id?: string
  reason?: string
  type?: string
  url?: string
  ip?: string
  useragent?: string
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
    const events = await req.json()
    const eventArray = Array.isArray(events) ? events : [events]

    console.log(`Processing ${eventArray.length} email events`)

    for (const event of eventArray) {
      try {
        await processEmailEvent(supabaseClient, event)
      } catch (error) {
        console.error('Error processing individual event:', error)
        // Continue processing other events
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: eventArray.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing email events:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processEmailEvent(supabaseClient: any, event: EmailEvent): Promise<void> {
  let eventType: string
  let emailId: string
  let emailAddress: string
  let timestamp: Date
  let metadata: any = {}

  // Detect and parse based on provider format
  if (event.data?.email_id) {
    // Resend format
    emailId = event.data.email_id
    emailAddress = event.data.to?.[0] || ''
    timestamp = new Date(event.created_at || Date.now())
    
    // Map Resend event types to our standard types
    switch (event.type) {
      case 'email.sent':
        eventType = 'sent'
        break
      case 'email.delivered':
        eventType = 'delivered'
        break
      case 'email.bounced':
        eventType = 'bounced'
        metadata.bounce_reason = event.data.bounce?.message
        metadata.bounce_type = event.data.bounce?.type
        break
      case 'email.complained':
        eventType = 'complained'
        metadata.complaint_reason = event.data.complaint?.message
        metadata.complaint_type = event.data.complaint?.type
        break
      case 'email.opened':
        eventType = 'opened'
        break
      case 'email.clicked':
        eventType = 'clicked'
        metadata.clicked_link = event.data.click?.link
        break
      case 'email.delivery_delayed':
        eventType = 'deferred'
        break
      default:
        console.log('Unknown Resend event type:', event.type)
        return
    }
  } else if (event.sg_message_id) {
    // SendGrid format
    emailId = event.sg_message_id
    emailAddress = event.email || ''
    timestamp = new Date((event.timestamp || Date.now() / 1000) * 1000)
    
    // Map SendGrid event types to our standard types
    switch (event.event) {
      case 'processed':
      case 'delivered':
        eventType = 'delivered'
        break
      case 'bounce':
        eventType = 'bounced'
        metadata.bounce_reason = event.reason
        metadata.bounce_type = event.type
        break
      case 'dropped':
        eventType = 'dropped'
        metadata.drop_reason = event.reason
        break
      case 'deferred':
        eventType = 'deferred'
        metadata.defer_reason = event.reason
        break
      case 'spamreport':
        eventType = 'complained'
        metadata.complaint_type = 'spam'
        break
      case 'open':
        eventType = 'opened'
        metadata.ip = event.ip
        metadata.useragent = event.useragent
        break
      case 'click':
        eventType = 'clicked'
        metadata.clicked_link = event.url
        metadata.ip = event.ip
        metadata.useragent = event.useragent
        break
      case 'unsubscribe':
        eventType = 'unsubscribed'
        break
      default:
        console.log('Unknown SendGrid event type:', event.event)
        return
    }
  } else {
    console.log('Unknown event format:', event)
    return
  }

  // Find the email message by resend_email_id
  const { data: emailMessage, error: findError } = await supabaseClient
    .from('email_messages')
    .select('id, tenant_id, to_email')
    .eq('resend_email_id', emailId)
    .single()

  if (findError || !emailMessage) {
    console.log('Email message not found for ID:', emailId)
    // Try to find by message_id as fallback
    const { data: fallbackEmail } = await supabaseClient
      .from('email_messages')
      .select('id, tenant_id, to_email')
      .eq('message_id', emailId)
      .single()
    
    if (!fallbackEmail) {
      console.log('Could not find email for event:', emailId)
      return
    }
  }

  const email = emailMessage || emailAddress
  const tenantId = email.tenant_id

  // Update email message status based on event
  const updateData: any = {
    updated_at: timestamp.toISOString()
  }

  switch (eventType) {
    case 'delivered':
      updateData.status = 'delivered'
      updateData.delivered_at = timestamp.toISOString()
      break
    case 'bounced':
      updateData.status = 'bounced'
      updateData.bounced_at = timestamp.toISOString()
      break
    case 'opened':
      if (!email.opened_at) {
        updateData.opened_at = timestamp.toISOString()
      }
      break
    case 'clicked':
      if (!email.clicked_at) {
        updateData.clicked_at = timestamp.toISOString()
      }
      break
  }

  // Update the email message
  if (Object.keys(updateData).length > 1) {
    await supabaseClient
      .from('email_messages')
      .update(updateData)
      .eq('id', email.id)
  }

  // Store the event
  await supabaseClient
    .from('email_events')
    .insert({
      tenant_id: tenantId,
      resend_email_id: emailId,
      message_id: emailId,
      event_type: eventType,
      to_email: email.to_email || emailAddress,
      from_email: email.from_email || '',
      subject: email.subject || '',
      event_data: {
        ...metadata,
        provider: event.sg_message_id ? 'sendgrid' : 'resend',
        raw_event: event
      },
      event_timestamp: timestamp.toISOString(),
      created_at: new Date().toISOString()
    })

  // Update tenant email usage statistics
  await supabaseClient.rpc('update_email_usage', {
    p_tenant_id: tenantId,
    p_event_type: eventType
  })

  // Handle bounces and complaints for suppression
  if (eventType === 'bounced' || eventType === 'complained') {
    await handleSuppression(supabaseClient, tenantId, emailAddress, eventType, metadata)
  }
}

async function handleSuppression(
  supabaseClient: any,
  tenantId: string,
  email: string,
  reason: string,
  metadata: any
): Promise<void> {
  try {
    // Check if suppression already exists
    const { data: existing } = await supabaseClient
      .from('email_suppressions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .single()

    if (!existing) {
      // Add to suppression list
      await supabaseClient
        .from('email_suppressions')
        .insert({
          tenant_id: tenantId,
          email: email,
          reason: reason,
          reason_detail: metadata.bounce_reason || metadata.complaint_reason || '',
          created_at: new Date().toISOString()
        })

      console.log(`Added ${email} to suppression list for tenant ${tenantId} due to ${reason}`)
    }
  } catch (error) {
    console.error('Error handling suppression:', error)
  }
}

/* 
Email Events Handler Edge Function

This function processes webhook events from email service providers to track:
- Delivery confirmations
- Opens and clicks
- Bounces and complaints
- Other email events

Setup Instructions:

1. Resend Webhook Setup:
   - Go to Resend dashboard > Webhooks
   - Add endpoint: https://your-project.supabase.co/functions/v1/handle-email-events
   - Select events to track

2. SendGrid Event Webhook Setup:
   - Go to SendGrid dashboard > Settings > Mail Settings > Event Webhook
   - Set HTTP Post URL: https://your-project.supabase.co/functions/v1/handle-email-events
   - Select events to track

Features:
- Supports both Resend and SendGrid event formats
- Updates email message status in real-time
- Tracks email engagement metrics
- Automatic suppression list management for bounces/complaints
- Updates tenant usage statistics

The function processes events asynchronously and updates:
- email_messages table with status and timestamps
- email_events table with detailed event history
- email_suppressions table for bounce/complaint management
- tenant_email_usage for analytics
*/