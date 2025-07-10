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
    
    // Get auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('No auth')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Get user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No user')
    
    // Simple tracking token
    const trackingToken = 'track_' + Date.now()
    
    // Try to insert directly into the table
    const { data, error } = await supabaseAdmin
      .from('job_technician_locations')
      .insert({
        job_id: job_id,
        user_id: user.id,
        technician_id: user.id,
        tracking_token: trackingToken,
        latitude: initial_latitude,
        longitude: initial_longitude,
        is_active: true,
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      tracking_token: trackingToken,
      message: 'Simple tracking started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})