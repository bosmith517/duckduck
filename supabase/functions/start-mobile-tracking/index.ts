// Mobile-focused tracking without SMS requirements
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id, initial_latitude, initial_longitude } = await req.json()

    if (!job_id || initial_latitude == null || initial_longitude == null) {
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Generate tracking token
    const trackingToken = 'track_' + crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 4)

    // Create tracking session
    const { error: trackingError } = await supabaseAdmin
      .from('job_technician_locations')
      .insert({
        job_id: job_id,
        user_id: user.id,
        technician_id: userProfile.id,
        tracking_token: trackingToken,
        latitude: initial_latitude,
        longitude: initial_longitude,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        tenant_id: userProfile.tenant_id
      })

    if (trackingError) {
      console.error('Tracking error:', trackingError)
      throw new Error('Failed to create tracking session')
    }

    // Get job details for response
    const { data: jobData } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        job_number,
        contact_id,
        account_id,
        contacts (
          id,
          first_name,
          last_name
        ),
        accounts (
          id,
          name
        )
      `)
      .eq('id', job_id)
      .single()

    // Build customer portal URL
    const baseUrl = Deno.env.get('FRONTEND_URL') || 'https://your-app.com'
    const customerId = jobData?.contact_id || jobData?.account_id
    const customerPortalUrl = `${baseUrl}/customer/${customerId}/track/${trackingToken}`

    return new Response(JSON.stringify({ 
      success: true, 
      tracking_token: trackingToken,
      customer_portal_url: customerPortalUrl,
      message: 'Tracking started successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})