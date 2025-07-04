import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SendEmailRequest {
  to: string
  subject: string
  html?: string
  text?: string
  template_id?: string
  template_variables?: Record<string, any>
  priority?: number
  scheduled_at?: string
  tags?: Record<string, any>
}

interface ResendEmailRequest {
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  reply_to?: string
  tags?: Array<{ name: string; value: string }>
}

interface ResendResponse {
  id: string
  from: string
  to: string[]
  created_at: string
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

    // Get user context and tenant
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's tenant
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User tenant not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = userProfile.tenant_id

    // Parse request body
    const emailRequest: SendEmailRequest = await req.json()

    // Validate required fields
    if (!emailRequest.to || !emailRequest.subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!emailRequest.html && !emailRequest.text && !emailRequest.template_id) {
      return new Response(
        JSON.stringify({ error: 'Must provide either html/text content or template_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get tenant's verified domain
    const { data: domainData, error: domainError } = await supabaseClient
      .rpc('get_tenant_verified_domain', { p_tenant_id: tenantId })

    if (domainError || !domainData || domainData.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No verified email domain found for tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const domain = domainData[0]
    let htmlContent = emailRequest.html || ''
    let textContent = emailRequest.text || ''
    let subject = emailRequest.subject

    // If template_id is provided, render template
    if (emailRequest.template_id) {
      const { data: template, error: templateError } = await supabaseClient
        .from('email_template_versions')
        .select('*')
        .eq('id', emailRequest.template_id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single()

      if (templateError || !template) {
        return new Response(
          JSON.stringify({ error: 'Template not found or not active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Simple template variable replacement
      const variables = emailRequest.template_variables || {}
      
      // Replace variables in subject
      subject = template.subject_template
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        subject = subject.replace(regex, String(value))
      })

      // Replace variables in HTML template
      if (template.html_template) {
        htmlContent = template.html_template
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
          htmlContent = htmlContent.replace(regex, String(value))
        })
      }

      // Replace variables in text template
      if (template.text_template) {
        textContent = template.text_template
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
          textContent = textContent.replace(regex, String(value))
        })
      }
    }

    // Check if email is suppressed
    const { data: isSupPressed, error: suppressError } = await supabaseClient
      .rpc('is_email_suppressed', { 
        p_tenant_id: tenantId, 
        p_email: emailRequest.to 
      })

    if (suppressError) {
      console.error('Error checking suppression:', suppressError)
      return new Response(
        JSON.stringify({ error: 'Error checking email suppression' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (isSupPressed) {
      return new Response(
        JSON.stringify({ error: 'Email address is suppressed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Queue email for sending
    try {
      const { data: queueId, error: queueError } = await supabaseClient
        .rpc('queue_email_with_suppression_check', {
          p_tenant_id: tenantId,
          p_to_email: emailRequest.to,
          p_subject: subject,
          p_html_body: htmlContent,
          p_text_body: textContent,
          p_template_id: emailRequest.template_id || null,
          p_template_variables: emailRequest.template_variables || {},
          p_priority: emailRequest.priority || 5,
          p_scheduled_at: emailRequest.scheduled_at || new Date().toISOString()
        })

      if (queueError) {
        console.error('Error queuing email:', queueError)
        return new Response(
          JSON.stringify({ error: queueError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // If scheduled for immediate sending, try to send now
      const isImmediate = !emailRequest.scheduled_at || new Date(emailRequest.scheduled_at) <= new Date()
      
      if (isImmediate) {
        try {
          await sendEmailViaResend(
            queueId,
            {
              to: emailRequest.to,
              from: `${domain.default_from_name} <${domain.default_from_email}>`,
              subject: subject,
              html: htmlContent || undefined,
              text: textContent || undefined,
              reply_to: domain.reply_to_email || undefined,
              tags: emailRequest.tags
            },
            supabaseClient
          )
        } catch (sendError) {
          console.error('Error sending email immediately:', sendError)
          // Email is still queued, background worker will retry
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          queue_id: queueId,
          status: isImmediate ? 'sent_immediately' : 'scheduled',
          scheduled_at: emailRequest.scheduled_at || new Date().toISOString()
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (error) {
      console.error('Error in email processing:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to process email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in send-email function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to send email via Resend
async function sendEmailViaResend(
  queueId: string,
  emailData: ResendEmailRequest,
  supabaseClient: any
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable not set')
  }

  // Mark email as processing
  await supabaseClient.rpc('mark_email_processing', { p_queue_id: queueId })

  try {
    // Convert tags to Resend format
    const resendTags = emailData.tags ? 
      Object.entries(emailData.tags).map(([name, value]) => ({ name, value: String(value) })) : 
      undefined

    const resendPayload: ResendEmailRequest = {
      from: emailData.from,
      to: [emailData.to],
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      reply_to: emailData.reply_to,
      tags: resendTags
    }

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Resend API error: ${response.status} - ${errorData}`)
    }

    const resendResponse: ResendResponse = await response.json()

    // Update queue record with success
    await supabaseClient
      .from('email_queue')
      .update({
        status: 'sent',
        resend_email_id: resendResponse.id,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId)

    // Record event for tracking
    await supabaseClient
      .from('email_events')
      .insert({
        tenant_id: (await supabaseClient.from('email_queue').select('tenant_id').eq('id', queueId).single()).data?.tenant_id,
        resend_email_id: resendResponse.id,
        message_id: resendResponse.id,
        event_type: 'sent',
        to_email: emailData.to,
        from_email: emailData.from,
        subject: emailData.subject,
        event_data: {
          resend_response: resendResponse,
          sent_via: 'edge_function'
        },
        event_timestamp: new Date().toISOString()
      })

    console.log('Email sent successfully:', resendResponse.id)

  } catch (error) {
    console.error('Error sending via Resend:', error)

    // Mark email as failed with retry logic
    await supabaseClient.rpc('mark_email_failed', {
      p_queue_id: queueId,
      p_error_message: error.message
    })

    throw error
  }
}

/* 
Send Email Edge Function

This function provides a secure API for sending emails through the multi-tenant email system.

Features:
- JWT authentication and tenant isolation
- Template rendering with variable substitution
- Email suppression checking
- Immediate sending with queue fallback
- Integration with Resend API
- Comprehensive error handling and retry logic

API Usage:
POST /functions/v1/send-email
Headers:
  Authorization: Bearer <jwt_token>
  Content-Type: application/json

Body:
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "html": "<p>HTML content</p>", // Optional if using template
  "text": "Plain text content", // Optional
  "template_id": "uuid", // Optional, use instead of html/text
  "template_variables": { // Optional, for template rendering
    "name": "John",
    "company": "Acme Corp"
  },
  "priority": 1, // Optional, 1-10 (1 = highest)
  "scheduled_at": "2024-07-03T10:00:00Z", // Optional, for scheduling
  "tags": { // Optional, for analytics
    "campaign": "welcome",
    "type": "transactional"
  }
}

Response:
{
  "success": true,
  "queue_id": "uuid",
  "status": "sent_immediately" | "scheduled",
  "scheduled_at": "2024-07-03T10:00:00Z"
}

Environment Variables Required:
- RESEND_API_KEY: Your Resend API key
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
*/