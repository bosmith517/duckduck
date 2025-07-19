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

    const { recordingId, testimonialId } = await req.json()

    if (!recordingId || !testimonialId) {
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

    // Stop recording using REST API
    const stopResponse = await fetch(
      `https://${tenant.signalwire_space_url}/api/video/room_sessions/${testimonial.room_id}/recordings/${recordingId}/stop`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${tenant.signalwire_project_id}:${tenant.signalwire_project_token}`)}`
        }
      }
    )

    if (!stopResponse.ok) {
      throw new Error(`Failed to stop recording: ${await stopResponse.text()}`)
    }

    const recordingData = await stopResponse.json()

    // Update testimonial with recording details
    const { error: updateError } = await supabaseClient
      .from('testimonial_requests')
      .update({
        recording_stopped_at: new Date().toISOString(),
        recording_url: recordingData.url,
        status: 'processing'
      })
      .eq('id', testimonialId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: recordingData.url
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