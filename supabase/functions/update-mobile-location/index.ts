// Mobile-focused location update without database functions
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
    const { job_id, latitude, longitude, accuracy, speed, heading } = await req.json()

    if (!job_id || latitude == null || longitude == null) {
      throw new Error('Missing required parameters: job_id, latitude, or longitude.')
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

    // Check for active tracking session using user.id directly
    const { data: trackingSession, error: sessionError } = await supabaseAdmin
      .from('job_technician_locations')
      .select('id, tracking_token, tenant_id')
      .eq('job_id', job_id)
      .eq('user_id', user.id)  // Use user_id instead of technician_id
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !trackingSession) {
      throw new Error('No active tracking session found')
    }

    // Update the location directly
    const { error: updateError } = await supabaseAdmin
      .from('job_technician_locations')
      .update({
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy || null,
        speed: speed || null,
        heading: heading || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', trackingSession.id)

    if (updateError) {
      console.error('Update error:', updateError)
      throw new Error('Failed to update location')
    }

    // Also insert into location history if table exists
    try {
      await supabaseAdmin
        .from('job_location_history')
        .insert({
          job_id: job_id,
          technician_id: user.id,
          tracking_token: trackingSession.tracking_token,
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy || null,
          speed: speed || null,
          heading: heading || null,
          recorded_at: new Date().toISOString(),
          tenant_id: trackingSession.tenant_id
        })
    } catch (historyError) {
      // Don't fail if history table doesn't exist
      console.log('History insert skipped:', historyError)
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Location updated successfully'
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