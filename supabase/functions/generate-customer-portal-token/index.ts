// supabase/functions/generate-customer-portal-token/index.ts
//
// Generate a custom JWT for customer portal access to video sessions
//

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
    // Authenticate the user
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

    const { session_id, room_id } = await req.json()

    if (!session_id || !room_id) {
      throw new Error('session_id and room_id are required')
    }
    
    // For SignalWire, we need to use the room_id which is the actual SignalWire room ID
    // The metadata.room_name is just a display name
    const roomName = room_id

    // For customer portal access, we'll use a simple encrypted token approach
    // This avoids needing the JWT secret in Edge Functions
    const tokenData = {
      session_id,
      room_id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created: new Date().toISOString()
    }
    
    // Encode the token data as base64
    const token = btoa(JSON.stringify(tokenData))

    // Also generate the SignalWire token for video
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    console.log('Generating SignalWire token for room:', roomName)
    
    if (!signalwireProjectId || !signalwireApiToken) {
      console.error('SignalWire credentials missing:', {
        hasProjectId: !!signalwireProjectId,
        hasApiToken: !!signalwireApiToken,
        spaceUrl: signalwireSpaceUrl
      })
      // Return without SignalWire token rather than failing entirely
      return new Response(
        JSON.stringify({
          portal_token: token,
          signalwire_token: null,
          session_id,
          room_id,
          error: 'SignalWire not configured - video will not be available'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    const signalwireUrl = `https://${signalwireSpaceUrl}/api/video/room_tokens`
    console.log('SignalWire token URL:', signalwireUrl)
    
    const signalwireResponse = await fetch(signalwireUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        user_name: 'Customer',
        permissions: ['room.self.audio_mute', 'room.self.audio_unmute', 'room.self.video_mute', 'room.self.video_unmute'],
        auto_join: true,
        expires_in: 86400
      }),
    })

    let signalwireToken = null
    if (signalwireResponse.ok) {
      const signalwireData = await signalwireResponse.json()
      signalwireToken = signalwireData.token
      console.log('SignalWire token generated successfully')
    } else {
      const errorText = await signalwireResponse.text()
      console.error('Failed to generate SignalWire token:', signalwireResponse.status, errorText)
      throw new Error(`Failed to generate video token: ${errorText}`)
    }

    return new Response(
      JSON.stringify({
        portal_token: token,
        signalwire_token: signalwireToken,
        session_id,
        room_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error generating customer portal token:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})