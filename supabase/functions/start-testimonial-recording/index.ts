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

    const { testimonialId, roomSessionId, roomName } = await req.json()

    if (!testimonialId || !roomSessionId) {
      throw new Error('Missing required parameters')
    }

    // Get tenant's SignalWire credentials
    const { data: testimonial, error: testimonialError } = await supabaseClient
      .from('testimonial_requests')
      .select('*, tenant:tenants(*)')
      .eq('id', testimonialId)
      .single()

    if (testimonialError || !testimonial) {
      throw new Error('Testimonial not found')
    }

    const tenant = testimonial.tenant

    // Initialize SignalWire client
    const client = await SignalWire({
      project: tenant.signalwire_project_id,
      token: tenant.signalwire_project_token
    })

    const videoClient = client.video

    // Get the room session
    const { roomSession } = await videoClient.getRoomSessionById(roomSessionId)

    if (!roomSession) {
      throw new Error('Room session not found')
    }

    // Start recording
    const recording = await roomSession.startRecording()

    // Store recording info
    const { error: updateError } = await supabaseClient
      .from('testimonial_requests')
      .update({
        recording_id: recording.id,
        recording_started_at: new Date().toISOString(),
        status: 'recording'
      })
      .eq('id', testimonialId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        recordingId: recording.id
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