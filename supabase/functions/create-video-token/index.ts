// supabase/functions/create-video-token/index.ts
//
// Creates a SignalWire token with ICE servers for fast connection
// Solves the 45-second delay issue
//

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
    const body = await req.json().catch(() => ({}))
    const room_name = body.room_name || `default-room-${Date.now()}`
    const user_name = body.user_name || 'Default User'

    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    console.log('Using credentials:', {
      projectId: projectId ? `${projectId.substring(0, 8)}...` : 'missing',
      apiToken: apiToken ? `${apiToken.substring(0, 5)}...` : 'missing',
      spaceUrl: spaceUrl || 'missing'
    })
    
    const auth = btoa(`${projectId}:${apiToken}`)
    const baseUrl = `https://${spaceUrl}/api/video`

    // Step 1: Get ICE servers from SignalWire
    let iceServers = []
    try {
      const turnUrl = `https://${spaceUrl}/api/relay/rest/turn/credentials`
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
        { urls: `stun:${spaceUrl}:443` },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }

    console.log(`Using ${iceServers.length} ICE servers`)

    // Step 2: First create the room to ensure it exists
    console.log('Creating room:', room_name)
    const roomResponse = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: room_name,
        // No special room config needed here
      }),
    })
    
    // If room already exists (409), that's fine
    if (!roomResponse.ok && roomResponse.status !== 409) {
      const roomError = await roomResponse.text()
      console.error('Room creation failed:', roomError)
    } else if (roomResponse.status === 201) {
      // Room was just created, give it a moment to fully initialize
      console.log('Room created successfully, waiting for initialization...')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Step 3: Create a token with explicit auto_create_room: false
    console.log('Creating token for existing room:', room_name, 'user:', user_name)
    const tokenPayload = {
      room_name: room_name,
      user_name: user_name,
      auto_create_room: false,  // Explicitly false since room exists
      audio: true,  // Preload audio
      video: true,  // Preload video
      permissions: [
        "room.list_available_layouts",
        "room.set_layout", 
        "room.self.audio_mute",
        "room.self.audio_unmute",
        "room.self.video_mute",
        "room.self.video_unmute",
        "room.self.set_input_volume",
        "room.self.set_output_volume",
        "room.self.set_input_sensitivity"
      ]
    }
    console.log('Token request payload:', JSON.stringify(tokenPayload))
    
    const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenPayload),
    })

    if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text()
        console.error('Token creation failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorBody
        })
        throw new Error(`Failed to create token: ${errorBody}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token generated successfully')
    
    // Return token AND ICE servers for the client to use
    return new Response(
      JSON.stringify({ 
        token: tokenData.token,
        iceServers: iceServers,  // Client must configure these!
        room_name: room_name,
        note: 'Use the provided iceServers in your WebRTC configuration'
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})