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

    // Get auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create clients
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) throw new Error(`Auth error: ${authError.message}`)
    if (!user) throw new Error('No user found')

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError) throw new Error(`Profile error: ${profileError.message}`)
    if (!userProfile) throw new Error('No user profile found')

    // Check if job exists
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, status, tenant_id')
      .eq('id', job_id)
      .single()

    if (jobError) throw new Error(`Job error: ${jobError.message}`)
    if (!job) throw new Error('Job not found')

    // Check if tracking session table exists
    const { data: tableCheck, error: tableError } = await supabaseAdmin
      .from('job_technician_locations')
      .select('id')
      .limit(1)

    const debugInfo = {
      user_id: user.id,
      user_profile: userProfile,
      job_exists: !!job,
      job_data: job,
      table_accessible: !tableError,
      table_error: tableError?.message,
      env_vars: {
        has_url: !!Deno.env.get('SUPABASE_URL'),
        has_anon_key: !!Deno.env.get('SUPABASE_ANON_KEY'),
        has_service_key: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        has_signalwire: !!Deno.env.get('SIGNALWIRE_PROJECT_ID'),
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      debug: debugInfo 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})