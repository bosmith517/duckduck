// supabase/functions/create-room-with-ice/index.ts
//
// Creates a SignalWire room and token WITH proper ICE servers
// This solves the 45-second connection delay
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
    const { room_name, user_name, session_id } = await req.json()

    // Get SignalWire credentials from environment
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    
    if (!signalwireProjectId || !signalwireApiToken) {
      console.error('SignalWire credentials missing')
      throw new Error('SignalWire credentials not configured')
    }

    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const baseUrl = `https://${signalwireSpaceUrl}/api/video`

    console.log(`Creating room with ICE servers: ${room_name}`)

    // STEP 1: Get ICE servers from SignalWire
    let iceServers = []
    try {
      const turnUrl = `https://${signalwireSpaceUrl}/api/relay/rest/turn/credentials`
      console.log('Getting TURN credentials from:', turnUrl)
      
      const turnResponse = await fetch(turnUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      })
      
      if (turnResponse.ok) {
        const turnData = await turnResponse.json()
        console.log('Got TURN credentials from SignalWire')
        if (turnData.ice_servers) {
          iceServers = turnData.ice_servers
        }
      } else {
        console.log('Could not get TURN credentials, will use fallback servers')
      }
    } catch (turnError) {
      console.log('Error getting TURN credentials:', turnError.message)
    }

    // If no ICE servers from SignalWire, use reliable fallbacks
    if (iceServers.length === 0) {
      iceServers = [
        // SignalWire STUN servers
        { urls: `stun:${signalwireSpaceUrl}:443` },
        
        // Public STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // Public TURN servers
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }

    console.log(`Using ${iceServers.length} ICE servers`)

    // STEP 2: Create room and token with auto_create_room
    // But we'll return the ICE servers separately for the client to use
    const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: room_name,
        user_name: user_name || 'Guest',
        auto_create_room: true,
        permissions: [
          'room.join',              // CRITICAL: Without this, users can't join!
          'room.list_available_layouts',
          'room.set_layout',
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute',
          'room.self.set_input_volume',
          'room.self.set_output_volume',
          'room.self.set_input_sensitivity',
          'room.recording'
        ],
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token generation failed:', tokenResponse.status, errorText)
      throw new Error(`Token generation failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token generated successfully')

    // Store room info in database if session_id provided
    if (session_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase
        .from('video_sessions')
        .update({
          signalwire_room_id: room_name,
          signalwire_room_name: room_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    // Return token AND ICE servers for the client to use
    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData.token,
        room_name: room_name,
        iceServers: iceServers,  // Client must use these!
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        note: 'Use the provided iceServers in your WebRTC configuration'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )

  } catch (error) {
    console.error('Error in create-room-with-ice:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to create room with ICE servers'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 400,
      }
    )
  }
})