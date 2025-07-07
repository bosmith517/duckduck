import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InboundEmailWebhook {
  // SendGrid Inbound Parse webhook format
  headers?: string
  dkim?: string
  to?: string
  from?: string
  html?: string
  text?: string
  sender_ip?: string
  spam_report?: string
  envelope?: string
  attachments?: string
  subject?: string
  charsets?: string
  SPF?: string
  
  // Resend webhook format (for future compatibility)
  type?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[]
    subject?: string
    html?: string
    text?: string
    headers?: Record<string, string>
    attachments?: Array<{
      filename: string
      content_type: string
      size: number
      content_id?: string
    }>
  }
}

interface ParsedEmail {
  from_email: string
  from_name?: string
  to_email: string
  subject: string
  html_body?: string
  text_body?: string
  headers?: Record<string, string>
  attachments?: any[]
  spam_score?: number
  message_id?: string
  in_reply_to?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse the webhook payload
    const contentType = req.headers.get('content-type') || ''
    let webhookData: InboundEmailWebhook

    if (contentType.includes('application/json')) {
      // JSON payload (Resend or custom format)
      webhookData = await req.json()
    } else if (contentType.includes('multipart/form-data')) {
      // Form data (SendGrid Inbound Parse)
      const formData = await req.formData()
      webhookData = Object.fromEntries(formData.entries()) as any
    } else {
      // URL encoded form data
      const text = await req.text()
      const params = new URLSearchParams(text)
      webhookData = Object.fromEntries(params.entries()) as any
    }

    console.log('Received inbound email webhook:', JSON.stringify(webhookData, null, 2))

    // Parse email details based on provider format
    const parsedEmail = parseEmailWebhook(webhookData)

    // Extract domain from recipient email
    const recipientDomain = parsedEmail.to_email.split('@')[1]

    // Find the tenant by their verified email domain
    const { data: domainData, error: domainError } = await supabaseClient
      .from('tenant_email_domains')
      .select('tenant_id, domain_name')
      .eq('domain_name', recipientDomain)
      .eq('status', 'verified')
      .single()

    if (domainError || !domainData) {
      console.error('No verified domain found for:', recipientDomain)
      return new Response(
        JSON.stringify({ error: 'Unknown recipient domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = domainData.tenant_id

    // Check if email is spam
    if (parsedEmail.spam_score && parsedEmail.spam_score > 5) {
      console.log('Email marked as spam, not storing')
      return new Response(
        JSON.stringify({ success: true, message: 'Spam email rejected' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate thread_id if this is a reply
    let threadId = parsedEmail.message_id
    if (parsedEmail.in_reply_to) {
      // Try to find the original email thread
      const { data: originalEmail } = await supabaseClient
        .from('email_messages')
        .select('thread_id')
        .eq('message_id', parsedEmail.in_reply_to)
        .eq('tenant_id', tenantId)
        .single()

      if (originalEmail?.thread_id) {
        threadId = originalEmail.thread_id
      }
    }

    // Store the inbound email
    const { data: emailMessage, error: insertError } = await supabaseClient
      .from('email_messages')
      .insert({
        tenant_id: tenantId,
        to_email: parsedEmail.to_email,
        from_email: parsedEmail.from_email,
        from_name: parsedEmail.from_name,
        subject: parsedEmail.subject,
        html_body: parsedEmail.html_body,
        text_body: parsedEmail.text_body,
        direction: 'inbound',
        status: 'delivered',
        message_id: parsedEmail.message_id,
        in_reply_to: parsedEmail.in_reply_to,
        thread_id: threadId,
        delivered_at: new Date().toISOString(),
        attachments: parsedEmail.attachments || [],
        metadata: {
          headers: parsedEmail.headers,
          spam_score: parsedEmail.spam_score,
          webhook_source: contentType.includes('multipart') ? 'sendgrid' : 'resend'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing inbound email:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to link to contact automatically
    if (emailMessage) {
      await linkEmailToContact(supabaseClient, emailMessage.id, parsedEmail.from_email, tenantId)
    }

    // Create notification for the tenant (optional)
    await createEmailNotification(supabaseClient, tenantId, emailMessage)

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailMessage.id,
        message: 'Inbound email processed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing inbound email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Parse different webhook formats into a standard format
function parseEmailWebhook(webhook: InboundEmailWebhook): ParsedEmail {
  // Handle Resend webhook format
  if (webhook.type && webhook.data) {
    const data = webhook.data
    return {
      from_email: extractEmail(data.from || ''),
      from_name: extractName(data.from || ''),
      to_email: data.to?.[0] || '',
      subject: data.subject || 'No Subject',
      html_body: data.html,
      text_body: data.text,
      headers: data.headers,
      attachments: data.attachments?.map(att => ({
        name: att.filename,
        type: att.content_type,
        size: att.size,
        content_id: att.content_id
      })),
      message_id: data.email_id,
    }
  }

  // Handle SendGrid Inbound Parse webhook format
  const fromParsed = parseEmailAddress(webhook.from || '')
  const toParsed = parseEmailAddress(webhook.to || '')
  
  // Parse headers to extract Message-ID and In-Reply-To
  const headers = webhook.headers ? parseHeaders(webhook.headers) : {}
  const messageId = headers['Message-ID'] || headers['message-id'] || generateMessageId()
  const inReplyTo = headers['In-Reply-To'] || headers['in-reply-to']

  // Parse spam score from spam report
  let spamScore = 0
  if (webhook.spam_report) {
    const scoreMatch = webhook.spam_report.match(/score=(\d+\.?\d*)/i)
    if (scoreMatch) {
      spamScore = parseFloat(scoreMatch[1])
    }
  }

  // Parse attachments if present
  let attachments: any[] = []
  if (webhook.attachments) {
    try {
      attachments = JSON.parse(webhook.attachments)
    } catch (e) {
      console.error('Failed to parse attachments:', e)
    }
  }

  return {
    from_email: fromParsed.email,
    from_name: fromParsed.name,
    to_email: toParsed.email,
    subject: webhook.subject || 'No Subject',
    html_body: webhook.html,
    text_body: webhook.text,
    headers: headers,
    attachments: attachments,
    spam_score: spamScore,
    message_id: messageId,
    in_reply_to: inReplyTo
  }
}

// Parse email address string like "John Doe <john@example.com>"
function parseEmailAddress(emailString: string): { email: string; name?: string } {
  const match = emailString.match(/^(.+?)\s*<(.+?)>$/)
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim()
    }
  }
  return { email: emailString.trim() }
}

// Extract just the email from a string
function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+?)>/)
  return match ? match[1] : emailString.trim()
}

// Extract name from email string
function extractName(emailString: string): string | undefined {
  const match = emailString.match(/^(.+?)\s*</)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined
}

// Parse email headers string
function parseHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const lines = headersString.split('\n')
  
  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      headers[key] = value
    }
  }
  
  return headers
}

// Generate a message ID if not provided
function generateMessageId(): string {
  return `${Date.now()}.${Math.random().toString(36).substring(2, 9)}@inbound.email`
}

// Link email to contact based on email address
async function linkEmailToContact(
  supabaseClient: any,
  emailId: string,
  fromEmail: string,
  tenantId: string
): Promise<void> {
  try {
    // Try to find contact by email
    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('id, account_id')
      .eq('tenant_id', tenantId)
      .or(`email.eq.${fromEmail},secondary_email.eq.${fromEmail}`)
      .single()

    if (contact) {
      // Update email with contact and account IDs
      await supabaseClient
        .from('email_messages')
        .update({
          contact_id: contact.id,
          account_id: contact.account_id
        })
        .eq('id', emailId)
    }
  } catch (error) {
    console.error('Error linking email to contact:', error)
  }
}

// Create a notification for new inbound email
async function createEmailNotification(
  supabaseClient: any,
  tenantId: string,
  email: any
): Promise<void> {
  try {
    // This could be expanded to create actual notifications
    // For now, just log it
    console.log(`New inbound email for tenant ${tenantId}:`, {
      from: email.from_email,
      subject: email.subject,
      id: email.id
    })

    // You could add:
    // - Real-time notification via websocket
    // - Push notification
    // - In-app notification
    // - Email forwarding to specific users
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

/* 
Inbound Email Handler Edge Function

This function handles incoming email webhooks from email service providers (SendGrid, Resend, etc.)
and stores them in the email_messages table.

Setup Instructions:

1. SendGrid Inbound Parse Setup:
   - Configure your domain's MX records to point to SendGrid
   - Set up Inbound Parse webhook URL: https://your-project.supabase.co/functions/v1/handle-inbound-email
   - Configure which emails to forward (usually all emails to your domain)

2. Resend Inbound Email Setup:
   - Configure inbound email routing in Resend dashboard
   - Set webhook endpoint to: https://your-project.supabase.co/functions/v1/handle-inbound-email

3. Domain Configuration:
   - Ensure receiving domains are added to tenant_email_domains table
   - Domains must be verified for the system to accept emails

Features:
- Supports both SendGrid and Resend webhook formats
- Automatically links emails to contacts based on sender email
- Handles email threading (replies)
- Spam filtering
- Attachment metadata storage
- Multi-tenant isolation based on recipient domain

Security:
- Only accepts emails for verified domains
- Tenant isolation enforced
- Spam emails are rejected
- Service role key required for database access
*/