// supabase/functions/start-technician-tracking/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize a new Supabase client for interacting with the database
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id, initial_latitude, initial_longitude } = await req.json()

    if (!job_id || !initial_latitude || !initial_longitude) {
      throw new Error('Missing required parameters: job_id, initial_latitude, or initial_longitude.')
    }

    // Authenticate user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get user profile for technician_id
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Start tracking session using system function
    const { data: trackingResult, error: trackingError } = await supabaseAdmin
      .rpc('system_start_tracking_session', {
        p_job_id: job_id,
        p_technician_id: userProfile.id,
        p_initial_latitude: initial_latitude,
        p_initial_longitude: initial_longitude,
        p_duration_hours: 4
      })

    if (trackingError) throw trackingError
    if (!trackingResult) throw new Error("Failed to create tracking session.")

    const trackingToken = trackingResult

    // --- Get Customer Info for SMS ---
    const { data: jobData, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select(`
        contact_id,
        contacts!inner(
          id,
          first_name,
          last_name,
          phone
        )
      `)
      .eq('id', job_id)
      .single()

    if (jobError) throw jobError
    if (!jobData || !jobData.contacts) throw new Error("Job not found or no contact associated with job.")

    const contact = jobData.contacts
    const customerPhoneNumber = contact.phone
    const customerName = `${contact.first_name} ${contact.last_name}`

    // Create customer portal URL with tracking
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://your-app-domain.com'
    const customerPortalUrl = `${baseUrl}/customer/${contact.id}/track/${trackingToken}`

    // --- Send SMS via SignalWire ---
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const fromNumber = Deno.env.get('SIGNALWIRE_FROM_NUMBER')! 

    const smsBody = `Hi ${contact.first_name}! Your TradeWorks Pro technician is on the way. View your service details and track their arrival: ${customerPortalUrl}`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)

    try {
      const smsResponse = await fetch(`https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: customerPhoneNumber,
          From: fromNumber,
          Body: smsBody
        })
      })

      if (!smsResponse.ok) {
        console.error('SMS sending failed:', await smsResponse.text())
        // Don't fail the whole operation if SMS fails
      }
    } catch (smsError) {
      console.error('SMS error:', smsError)
      // Don't fail the whole operation if SMS fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      tracking_token: trackingToken,
      customer_portal_url: customerPortalUrl,
      customer_name: customerName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})