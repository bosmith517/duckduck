import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendGridEmailRequest {
  personalizations: Array<{
    to: Array<{ email: string; name?: string }>
    cc?: Array<{ email: string; name?: string }>
    bcc?: Array<{ email: string; name?: string }>
    subject?: string
    dynamic_template_data?: Record<string, any>
  }>
  from: { email: string; name?: string }
  reply_to?: { email: string; name?: string }
  subject?: string
  content?: Array<{ type: string; value: string }>
  template_id?: string
  categories?: string[]
  custom_args?: Record<string, any>
  send_at?: number
  batch_id?: string
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

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's tenant
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestData = await req.json()

    // Get SendGrid API key from Edge Function secrets
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY')
    
    if (!sendgridApiKey) {
      return new Response(
        JSON.stringify({ error: 'SendGrid API key not configured in Edge Function secrets' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant's verified domain for from address
    const { data: domain } = await supabaseClient
      .from('tenant_email_domains')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'verified')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .single()

    // Use default sender if no domain configured (for testing)
    const fromEmail = domain?.default_from_email || 'noreply@yourdomain.com'
    const fromName = domain?.default_from_name || 'TaurusTech System'
    const replyToEmail = domain?.reply_to_email

    // Build SendGrid email payload
    const sendGridPayload: SendGridEmailRequest = {
      personalizations: [],
      from: {
        email: fromEmail,
        name: fromName
      },
      reply_to: replyToEmail ? {
        email: replyToEmail
      } : undefined
    }

    // Handle different input formats
    if (requestData.personalizations) {
      // Direct SendGrid format
      sendGridPayload.personalizations = requestData.personalizations
      sendGridPayload.template_id = requestData.sendgrid_template_id || requestData.template_id
      sendGridPayload.subject = requestData.subject
      sendGridPayload.content = requestData.html || requestData.text ? [
        ...(requestData.html ? [{ type: 'text/html', value: requestData.html }] : []),
        ...(requestData.text ? [{ type: 'text/plain', value: requestData.text }] : [])
      ] : undefined
    } else {
      // Simple format - convert to SendGrid format
      const toEmails = Array.isArray(requestData.to) ? requestData.to : [requestData.to]
      const ccEmails = requestData.cc ? (Array.isArray(requestData.cc) ? requestData.cc : [requestData.cc]) : []
      const bccEmails = requestData.bcc ? (Array.isArray(requestData.bcc) ? requestData.bcc : [requestData.bcc]) : []

      sendGridPayload.personalizations = [{
        to: toEmails.map((email: string) => ({ email })),
        ...(ccEmails.length > 0 && { cc: ccEmails.map((email: string) => ({ email })) }),
        ...(bccEmails.length > 0 && { bcc: bccEmails.map((email: string) => ({ email })) }),
        subject: requestData.subject,
        ...(requestData.template_variables && { dynamic_template_data: requestData.template_variables })
      }]

      if (requestData.sendgrid_template_id) {
        sendGridPayload.template_id = requestData.sendgrid_template_id
      } else if (requestData.html || requestData.text) {
        sendGridPayload.content = [
          ...(requestData.html ? [{ type: 'text/html', value: requestData.html }] : []),
          ...(requestData.text ? [{ type: 'text/plain', value: requestData.text }] : [])
        ]
      }
    }

    // Add optional fields
    if (requestData.categories) sendGridPayload.categories = requestData.categories
    if (requestData.custom_args) sendGridPayload.custom_args = requestData.custom_args
    if (requestData.send_at) sendGridPayload.send_at = requestData.send_at

    // Send via SendGrid API
    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sendGridPayload)
    })

    if (!sendGridResponse.ok) {
      const errorData = await sendGridResponse.text()
      console.error('SendGrid API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email via SendGrid', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get SendGrid message ID from response headers
    const messageId = sendGridResponse.headers.get('X-Message-Id')

    // Skip database logging for now to test SendGrid connection
    console.log('Email sent successfully via SendGrid, messageId:', messageId)

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        status: 'sent'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sendgrid-send-email function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        stack: error.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})