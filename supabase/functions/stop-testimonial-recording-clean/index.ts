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

    // For now, just return success
    // In production, you would:
    // 1. Get the actual recording ID from your database
    // 2. Call SignalWire API to stop the specific recording
    // 3. Wait for the recording to be processed
    // 4. Return the video URL

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: `https://example.com/testimonial-${testimonialId}.mp4` // Placeholder
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in stop-testimonial-recording:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})