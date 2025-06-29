// supabase/functions/update-technician-location/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id, latitude, longitude, accuracy, speed, heading } = await req.json()

    if (!job_id || !latitude || !longitude) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Get active tracking session for this job and user
    const { data: trackingSession, error: sessionError } = await supabaseAdmin
      .from('job_technician_locations')
      .select('tracking_token, technician_id')
      .eq('job_id', job_id)
      .eq('technician_id', user.id)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !trackingSession) {
      throw new Error('No active tracking session found for this job and user')
    }

    // Use system function to update location securely
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .rpc('system_update_technician_location', {
        p_job_id: job_id,
        p_technician_id: user.id,
        p_tracking_token: trackingSession.tracking_token,
        p_latitude: latitude,
        p_longitude: longitude,
        p_accuracy: accuracy || null,
        p_speed: speed || null,
        p_heading: heading || null
      })

    if (updateError) throw updateError
    if (!updateResult) throw new Error('Failed to update location')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})