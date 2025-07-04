import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { createHash, createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendGridEvent {
  email: string
  timestamp: number
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'deferred' | 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe' | 'spamreport'
  sg_event_id: string
  sg_message_id: string
  reason?: string
  status?: string
  response?: string
  attempt?: string
  useragent?: string
  ip?: string
  url?: string
  category?: string[]
  unique_args?: Record<string, any>
  marketing_campaign_id?: string
  marketing_campaign_name?: string
}

interface InboundEmail {
  headers: string
  dkim: string
  to: string
  html: string
  from: string
  text: string
  sender_ip: string
  envelope: string
  attachments: string
  subject: string
  charsets: string
  SPF: string
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

    const url = new URL(req.url)
    
    // Handle inbound email parsing
    if (url.pathname.includes('/inbound')) {
      return await handleInboundEmail(req, supabaseClient)
    }
    
    // Handle event webhooks
    return await handleEventWebhook(req, supabaseClient)

  } catch (error) {
    console.error('Error in sendgrid-webhook function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleEventWebhook(req: Request, supabaseClient: any) {
  // Verify SendGrid webhook signature
  const signature = req.headers.get('X-Twilio-Email-Event-Webhook-Signature')
  const timestamp = req.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')
  
  if (!signature || !timestamp) {
    return new Response(
      JSON.stringify({ error: 'Missing webhook signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.text()
  
  // TODO: Verify signature with webhook secret
  // const publicKey = Deno.env.get('SENDGRID_WEBHOOK_PUBLIC_KEY')
  // const isValid = verifySignature(body, signature, timestamp, publicKey)
  // if (!isValid) {
  //   return new Response('Invalid signature', { status: 401 })
  // }

  const events: SendGridEvent[] = JSON.parse(body)

  for (const event of events) {
    try {
      // Find the tenant based on the message ID or email domain
      const emailDomain = event.email.split('@')[1]
      
      const { data: domain } = await supabaseClient
        .from('tenant_email_domains')
        .select('tenant_id, id')
        .eq('domain_name', emailDomain)
        .single()

      if (!domain) {
        console.warn(`No tenant found for domain: ${emailDomain}`)
        continue
      }

      // Insert event into database
      const eventData = {
        tenant_id: domain.tenant_id,
        sendgrid_event_id: event.sg_event_id,
        sg_message_id: event.sg_message_id,
        event_type: mapSendGridEvent(event.event),
        to_email: event.email,
        event_timestamp: new Date(event.timestamp * 1000).toISOString(),
        event_data: JSON.stringify(event),
        bounce_reason: event.reason,
        complaint_reason: event.event === 'spamreport' ? 'spam complaint' : undefined,
        useragent: event.useragent,
        ip_address: event.ip,
        url: event.url,
        reason: event.reason,
        status: event.status,
        attempt: event.attempt ? parseInt(event.attempt) : undefined,
        category: event.category?.[0]
      }

      const { error: insertError } = await supabaseClient
        .from('email_events')
        .insert(eventData)

      if (insertError) {
        console.error('Failed to insert email event:', insertError)
        continue
      }

      // Update email queue status if this is a delivery/failure event
      if (event.sg_message_id && ['delivered', 'bounce', 'dropped'].includes(event.event)) {
        const newStatus = event.event === 'delivered' ? 'sent' : 'failed'
        
        await supabaseClient
          .from('email_queue')
          .update({ 
            status: newStatus,
            error_message: event.reason,
            updated_at: new Date().toISOString()
          })
          .eq('sendgrid_message_id', event.sg_message_id)
      }

      // Update usage counters
      await supabaseClient.rpc('update_email_usage', {
        p_tenant_id: domain.tenant_id,
        p_event_type: mapSendGridEvent(event.event)
      })

      // Handle unsubscribes by adding to suppression list
      if (event.event === 'unsubscribe' || event.event === 'group_unsubscribe') {
        await supabaseClient.rpc('suppress_email', {
          p_tenant_id: domain.tenant_id,
          p_email: event.email,
          p_reason: 'unsubscribe',
          p_source: 'sendgrid_webhook'
        })
      }

      // Handle spam complaints
      if (event.event === 'spamreport') {
        await supabaseClient.rpc('suppress_email', {
          p_tenant_id: domain.tenant_id,
          p_email: event.email,
          p_reason: 'complaint',
          p_source: 'sendgrid_webhook'
        })
      }

    } catch (eventError) {
      console.error('Error processing event:', eventError, event)
    }
  }

  return new Response('OK', { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
  })
}

async function handleInboundEmail(req: Request, supabaseClient: any) {
  const formData = await req.formData()
  
  // Parse inbound email data
  const inboundData: Partial<InboundEmail> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      inboundData[key as keyof InboundEmail] = value
    }
  }

  if (!inboundData.to || !inboundData.from) {
    return new Response('Missing required fields', { status: 400 })
  }

  // Find tenant based on the receiving email domain
  const toDomain = inboundData.to!.split('@')[1]
  
  const { data: domain } = await supabaseClient
    .from('tenant_email_domains')
    .select('tenant_id, id')
    .eq('domain_name', toDomain)
    .single()

  if (!domain) {
    return new Response('Domain not found', { status: 404 })
  }

  // Store inbound email
  const inboundEmail = {
    tenant_id: domain.tenant_id,
    message_id: `inbound_${Date.now()}_${Math.random()}`,
    from_email: inboundData.from,
    to_email: inboundData.to,
    subject: inboundData.subject || 'No Subject',
    html_body: inboundData.html,
    text_body: inboundData.text,
    raw_mime: inboundData.headers || '',
    parsed_fields: JSON.stringify({
      dkim: inboundData.dkim,
      spf: inboundData.SPF,
      sender_ip: inboundData.sender_ip,
      envelope: inboundData.envelope,
      charsets: inboundData.charsets,
      attachments: inboundData.attachments
    }),
    processing_status: 'pending',
    received_at: new Date().toISOString()
  }

  const { error: insertError } = await supabaseClient
    .from('tenant_inbound_emails')
    .insert(inboundEmail)

  if (insertError) {
    console.error('Failed to store inbound email:', insertError)
    return new Response('Failed to store email', { status: 500 })
  }

  // TODO: Trigger any inbound email processing workflows
  // This could include:
  // - Creating tickets from emails
  // - Auto-responding
  // - Forwarding to team members
  // - Parsing structured data

  return new Response('OK', { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
  })
}

function mapSendGridEvent(sendgridEvent: string): string {
  const eventMap: Record<string, string> = {
    'processed': 'sent',
    'delivered': 'delivered',
    'open': 'opened',
    'click': 'clicked',
    'bounce': 'bounced',
    'dropped': 'bounced',
    'deferred': 'deferred',
    'unsubscribe': 'unsubscribed',
    'group_unsubscribe': 'unsubscribed',
    'spamreport': 'complained'
  }
  
  return eventMap[sendgridEvent] || sendgridEvent
}

// TODO: Implement signature verification
// function verifySignature(payload: string, signature: string, timestamp: string, publicKey: string): boolean {
//   // Implement SendGrid webhook signature verification
//   return true
// }