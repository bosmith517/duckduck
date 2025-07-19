import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SignalWire } from 'npm:@signalwire/realtime-api@4.1.2'
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

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    const { testimonialId, roomName, customerName } = await req.json()

    if (!testimonialId || !roomName) {
      throw new Error('Missing required parameters')
    }

    // Get tenant's SignalWire credentials
    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('signalwire_project_id, signalwire_project_token, signalwire_space_url')
      .single()

    if (tenantError || !tenant) {
      throw new Error('Unable to retrieve SignalWire credentials')
    }

    // Initialize SignalWire client
    const client = await SignalWire({
      project: tenant.signalwire_project_id,
      token: tenant.signalwire_project_token
    })

    // Create a video room using SignalWire REST API
    // Note: The Realtime API monitors rooms but doesn't create them
    // We need to use the REST API to create the room
    const roomResponse = await fetch(`https://${tenant.signalwire_space_url}/api/video/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${tenant.signalwire_project_id}:${tenant.signalwire_project_token}`)}`
      },
      body: JSON.stringify({
        name: roomName,
        display_name: roomName,
        max_participants: 2,
        enable_room_previews: true,
        video_layout: 'grid',
        quality: 'hd'
      })
    })

    if (!roomResponse.ok) {
      throw new Error(`Failed to create room: ${await roomResponse.text()}`)
    }

    const roomData = await roomResponse.json()

    // Update testimonial request with room details
    const { error: updateError } = await supabaseClient
      .from('testimonial_requests')
      .update({
        room_id: roomData.id,
        room_name: roomData.name,
        status: 'ready'
      })
      .eq('id', testimonialId)

    if (updateError) {
      throw updateError
    }

    // The room will be monitored via the Realtime API in the frontend
    return new Response(
      JSON.stringify({
        success: true,
        roomId: roomData.id,
        roomName: roomData.name,
        roomUrl: roomData.url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})