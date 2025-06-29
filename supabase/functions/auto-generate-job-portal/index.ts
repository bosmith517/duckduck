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

    const { job_id, tenant_id, contact_id, account_id } = await req.json()

    if (!job_id || !tenant_id) {
      throw new Error('Missing required parameters: job_id and tenant_id')
    }

    // Get job details with customer information
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select(`
        *,
        accounts:account_id(name, phone, email),
        contacts:contact_id(first_name, last_name, phone, email),
        tenants:tenant_id(company_name, phone, website)
      `)
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      console.error('Job not found:', jobError)
      throw new Error('Job not found')
    }

    // Determine customer ID and info
    const customerId = contact_id || account_id
    const customerName = job.contacts?.first_name 
      ? `${job.contacts.first_name} ${job.contacts.last_name || ''}`.trim()
      : job.accounts?.name || 'Valued Customer'
    
    const customerPhone = job.contacts?.phone || job.accounts?.phone
    const customerEmail = job.contacts?.email || job.accounts?.email

    if (!customerId || !customerPhone) {
      console.log('Missing customer information for portal generation')
      return new Response(
        JSON.stringify({ success: false, message: 'Missing customer information' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if portal token already exists for this job
    const { data: existingToken } = await supabaseClient
      .from('client_portal_tokens')
      .select('id, token')
      .eq('job_id', job_id)
      .eq('is_active', true)
      .maybeSingle()

    let portalToken = existingToken

    // Generate new token if none exists
    if (!existingToken) {
      // Generate a secure token
      const token = crypto.randomUUID() + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9)
      
      // Set expiration to 90 days from now
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 90)

      const { data: newToken, error: tokenError } = await supabaseClient
        .from('client_portal_tokens')
        .insert({
          job_id: job_id,
          customer_id: customerId,
          tenant_id: tenant_id,
          contact_id: contact_id,
          token: token,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          access_count: 0
        })
        .select()
        .single()

      if (tokenError) {
        console.error('Error creating portal token:', tokenError)
        throw tokenError
      }

      portalToken = newToken
    }

    // Generate portal URL
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('/api/', '') || 'https://app.tradeworkspro.com'
    const portalUrl = `${baseUrl}/portal/${portalToken.token}`
    const companyName = job.tenants?.company_name || 'TradeWorks Pro'

    // Send welcome SMS with portal link
    const smsMessage = `Hi ${customerName}! Here is your private portal for your ${job.service_type || 'service'} with ${companyName}: ${portalUrl}. Track progress, view invoices, and communicate with us securely.`

    try {
      await supabaseClient.functions.invoke('send-sms', {
        body: {
          to: customerPhone,
          body: smsMessage,
          tenant_id: tenant_id
        }
      })
    } catch (smsError) {
      console.error('Error sending portal SMS:', smsError)
      // Don't fail the entire process if SMS fails
    }

    // Send welcome email if email available
    if (customerEmail) {
      const emailSubject = `Your Private Portal - ${companyName}`
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Your Private Customer Portal</h2>
          <p>Hi ${customerName},</p>
          <p>We've created a secure portal where you can:</p>
          <ul style="color: #666;">
            <li>Track real-time progress on your ${job.service_type || 'service'}</li>
            <li>View and approve estimates</li>
            <li>See invoices and make payments</li>
            <li>Communicate directly with our team</li>
            <li>Access all project documents</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Access Your Portal</a>
          </div>
          <p style="color: #666; font-size: 14px;">Your portal link: <a href="${portalUrl}">${portalUrl}</a></p>
          <p>Best regards,<br>${companyName}</p>
        </div>
      `

      try {
        await supabaseClient.functions.invoke('send-email', {
          body: {
            to: customerEmail,
            subject: emailSubject,
            html: emailBody,
            tenant_id: tenant_id
          }
        })
      } catch (emailError) {
        console.error('Error sending portal email:', emailError)
        // Don't fail if email fails
      }
    }

    // Log the portal creation activity
    await supabaseClient
      .from('portal_activity_log')
      .insert({
        portal_token_id: portalToken.id,
        activity_type: 'login',
        metadata: {
          activity_description: 'Portal token generated and welcome message sent',
          customer_name: customerName,
          job_id: job_id,
          automated: true
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        portal_token: portalToken.token,
        portal_url: portalUrl,
        message: 'Portal generated and notifications sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in auto-generate-job-portal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})