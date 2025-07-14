// supabase/functions/generate-customer-token/index.ts
// Generates tokens for customer to access video estimate

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, room_id } = await req.json()

    if (!session_id || !room_id) {
      throw new Error('session_id and room_id are required')
    }

    // Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    // Generate portal access token (simple JWT-like token for session access)
    const portalToken = btoa(JSON.stringify({
      session_id: session_id,
      room_id: room_id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      created: new Date().toISOString()
    }))

    // Generate SignalWire room token
    const tokenResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/room_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: room_id, // Use the actual room name/ID from SignalWire
        user_name: 'Customer',
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute',
          'room.self.deaf',
          'room.self.undeaf',
          'room.list_available_layouts',
          'room.set_layout'
        ],
        auto_join: true,
        expires_in: 86400 // 24 hours
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('SignalWire token error:', error)
      throw new Error(`Failed to generate SignalWire token: ${error}`)
    }

    const tokenData = await tokenResponse.json()

    // Update session with token info (optional - for tracking)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    await supabase
      .from('video_sessions')
      .update({
        metadata: {
          ...((await supabase.from('video_sessions').select('metadata').eq('id', session_id).single()).data?.metadata || {}),
          last_token_generated: new Date().toISOString(),
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      })
      .eq('id', session_id)

    return new Response(
      JSON.stringify({
        portal_token: portalToken,
        signalwire_token: tokenData.token,
        expires_at: tokenData.expires_at,
        room_id: room_id,
        session_id: session_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error generating customer token:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})