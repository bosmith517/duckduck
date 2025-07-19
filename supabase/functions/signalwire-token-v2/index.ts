import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { roomName, userName } = await req.json()

    // Get SignalWire credentials from environment
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured')
    }

    const auth = btoa(`${projectId}:${apiToken}`)
    const baseUrl = `https://${spaceUrl}/api/video`
    const room_name = roomName || `test-room-${Date.now()}`

    console.log(`Creating room with two-step process: ${room_name}`)

    // STEP 1: Create the room first
    // This ensures the room exists before we generate a token for it
    const roomResponse = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name: room_name
      })
    })

    // Check if room already exists (409 Conflict is OK)
    if (!roomResponse.ok && roomResponse.status !== 409) {
      const errorText = await roomResponse.text()
      console.error('Room creation failed:', roomResponse.status, errorText)
      throw new Error(`Room creation failed: ${roomResponse.status}`)
    }

    if (roomResponse.ok) {
      console.log('Room created successfully')
    } else {
      console.log('Room already exists, proceeding with token generation')
    }

    // STEP 2: Create a token for the existing room
    // This standard method correctly includes the default ICE servers in the token
    const tokenEndpoint = `${baseUrl}/room_tokens`
    
    const tokenRequest = {
      room_name: room_name,
      user_name: userName || 'Guest',
      permissions: [
        'room.self.audio_mute',
        'room.self.audio_unmute',
        'room.self.video_mute', 
        'room.self.video_unmute',
        'room.self.set_input_volume',
        'room.self.set_output_volume',
        'room.self.set_input_sensitivity',
        'room.recording'
      ]
    }

    console.log('Requesting token from SignalWire:', tokenEndpoint)
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(tokenRequest)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()

    return new Response(
      JSON.stringify({
        token: tokenData.token,
        projectId,
        spaceUrl,
        roomName: room_name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error generating token:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})