import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { testimonialId, roomName } = await req.json()

    if (!roomName) {
      throw new Error('Missing required parameter: roomName')
    }

    // Get tenant
    let tenant: any = null
    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (user) {
      const { data: userData } = await supabaseClient
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      
      if (userData?.tenant_id) {
        const { data: tenantData } = await supabaseClient
          .from('tenants')
          .select('*')
          .eq('id', userData.tenant_id)
          .single()
        tenant = tenantData
      }
    }
    
    if (!tenant) {
      const { data: tenants } = await supabaseClient
        .from('tenants')
        .select('*')
        .limit(1)
      
      if (tenants && tenants.length > 0) {
        tenant = tenants[0]
      }
    }

    if (!tenant) {
      throw new Error('No tenant found')
    }

    if (!tenant.signalwire_project_id || !tenant.signalwire_project_token || !tenant.signalwire_space_url) {
      throw new Error('SignalWire credentials not configured')
    }

    // Use SignalWire REST API to start recording
    const response = await fetch(
      `https://${tenant.signalwire_space_url}/api/video/rooms/${roomName}/recordings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${tenant.signalwire_project_id}:${tenant.signalwire_project_token}`)}`
        },
        body: JSON.stringify({
          format: 'mp4'
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`Failed to start recording: ${response.status}`)
    }

    const recordingData = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        recordingId: recordingData.id || 'recording-started'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in start-testimonial-recording:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})