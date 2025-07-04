import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailQueueItem {
  queue_id: string
  tenant_id: string
  to_email: string
  from_email: string
  from_name: string
  reply_to: string
  subject: string
  html_body: string
  text_body: string
  priority: number
  retry_count: number
  scheduled_at: string
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
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get batch size from query params (default 10)
    const url = new URL(req.url)
    const batchSize = parseInt(url.searchParams.get('batch_size') || '10')
    const maxBatchSize = 50 // Safety limit

    const actualBatchSize = Math.min(batchSize, maxBatchSize)

    console.log(`Processing email queue batch of ${actualBatchSize} emails`)

    // Get next emails to process
    const { data: emailsToProcess, error: queueError } = await supabaseClient
      .rpc('get_next_emails_for_processing', { p_limit: actualBatchSize })

    if (queueError) {
      console.error('Error fetching emails from queue:', queueError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch emails from queue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!emailsToProcess || emailsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No emails to process',
          processed_count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${emailsToProcess.length} emails to process`)

    const results = {
      processed_count: 0,
      success_count: 0,
      failed_count: 0,
      errors: [] as string[]
    }

    // Process each email
    for (const email of emailsToProcess as EmailQueueItem[]) {
      try {
        console.log(`Processing email ${email.queue_id} for tenant ${email.tenant_id}`)
        
        await processEmail(email, supabaseClient)
        results.success_count++
        
      } catch (error) {
        console.error(`Failed to process email ${email.queue_id}:`, error)
        results.failed_count++
        results.errors.push(`Email ${email.queue_id}: ${error.message}`)
        
        // Mark email as failed in database
        try {
          await supabaseClient.rpc('mark_email_failed', {
            p_queue_id: email.queue_id,
            p_error_message: error.message
          })
        } catch (markError) {
          console.error('Error marking email as failed:', markError)
        }
      }
      
      results.processed_count++
    }

    // Reset any stuck emails
    try {
      const { data: resetCount } = await supabaseClient.rpc('reset_stuck_emails')
      console.log(`Reset ${resetCount || 0} stuck emails`)
    } catch (resetError) {
      console.error('Error resetting stuck emails:', resetError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: `Processed ${results.processed_count} emails: ${results.success_count} successful, ${results.failed_count} failed`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in process-email-queue function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processEmail(email: EmailQueueItem, supabaseClient: any): Promise<void> {
  console.log(`Processing email: ${email.subject} to ${email.to_email}`)

  // Mark as processing
  await supabaseClient.rpc('mark_email_processing', { p_queue_id: email.queue_id })

  // Get Resend API key
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY environment variable not set')
  }

  // Prepare email payload for Resend
  const fromAddress = email.from_name ? 
    `${email.from_name} <${email.from_email}>` : 
    email.from_email

  const resendPayload: ResendEmailRequest = {
    from: fromAddress,
    to: [email.to_email],
    subject: email.subject,
    html: email.html_body || undefined,
    text: email.text_body || undefined,
    reply_to: email.reply_to || undefined,
    tags: [
      { name: 'tenant_id', value: email.tenant_id },
      { name: 'queue_id', value: email.queue_id },
      { name: 'priority', value: email.priority.toString() },
      { name: 'retry_count', value: email.retry_count.toString() },
      { name: 'source', value: 'background_worker' }
    ]
  }

  try {
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
      
      // Handle specific Resend errors
      if (response.status === 429) {
        throw new Error(`Rate limited by Resend: ${errorData}`)
      } else if (response.status === 422) {
        throw new Error(`Invalid email data: ${errorData}`)
      } else {
        throw new Error(`Resend API error: ${response.status} - ${errorData}`)
      }
    }

    const resendResponse: ResendResponse = await response.json()
    console.log(`Email sent successfully via Resend: ${resendResponse.id}`)

    // Update queue record with success
    await supabaseClient
      .from('email_queue')
      .update({
        status: 'sent',
        resend_email_id: resendResponse.id,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', email.queue_id)

    // Record sent event for tracking
    await supabaseClient
      .from('email_events')
      .insert({
        tenant_id: email.tenant_id,
        resend_email_id: resendResponse.id,
        message_id: resendResponse.id,
        event_type: 'sent',
        to_email: email.to_email,
        from_email: email.from_email,
        subject: email.subject,
        event_data: {
          resend_response: resendResponse,
          sent_via: 'background_worker',
          queue_id: email.queue_id,
          retry_count: email.retry_count
        },
        event_timestamp: new Date().toISOString()
      })

    console.log(`Email processing completed for queue ID: ${email.queue_id}`)

  } catch (error) {
    console.error(`Error sending email ${email.queue_id}:`, error)
    
    // For rate limiting errors, don't increment retry count - just reschedule
    if (error.message.includes('Rate limited')) {
      await supabaseClient
        .from('email_queue')
        .update({
          status: 'pending',
          error_message: error.message,
          last_attempted_at: new Date().toISOString(),
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Retry in 5 minutes
          updated_at: new Date().toISOString()
        })
        .eq('id', email.queue_id)
      
      throw new Error(`Rate limited - rescheduled: ${error.message}`)
    }

    // For other errors, use the standard retry logic
    await supabaseClient.rpc('mark_email_failed', {
      p_queue_id: email.queue_id,
      p_error_message: error.message
    })

    throw error
  }
}

/* 
Email Queue Processing Background Worker

This Edge Function processes queued emails in batches, sending them via Resend.
It's designed to be called by a cron job or external scheduler.

Features:
- Batch processing with configurable size
- Proper error handling and retry logic
- Rate limiting awareness
- Comprehensive logging and monitoring
- Stuck email recovery
- Database transaction safety with FOR UPDATE SKIP LOCKED

Usage:
1. Manual trigger: POST /functions/v1/process-email-queue
2. With batch size: POST /functions/v1/process-email-queue?batch_size=20
3. Cron job: Set up to call this function every 1-5 minutes

Response:
{
  "success": true,
  "processed_count": 15,
  "success_count": 14,
  "failed_count": 1,
  "errors": ["Email abc123: Invalid recipient address"],
  "message": "Processed 15 emails: 14 successful, 1 failed"
}

Environment Variables Required:
- RESEND_API_KEY: Your Resend API key
- SUPABASE_URL: Supabase project URL  
- SUPABASE_SERVICE_ROLE_KEY: Service role key for database access

Monitoring:
- Check function logs for processing details
- Use get_email_system_health() to monitor queue size
- Set up alerts for high error rates or stuck emails

Best Practices:
- Run every 1-5 minutes depending on volume
- Use batch_size=10-50 based on your Resend rate limits
- Monitor Resend API rate limits and adjust accordingly
- Set up dead letter queue for emails that fail max retries
*/