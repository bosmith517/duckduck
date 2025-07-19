// signalwire-token-fixed - Uses proper SignalWire API to get tokens WITH ICE servers
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { roomName, userName, testimonialId } = await req.json()

    // Get SignalWire credentials from environment
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured')
    }

    // Use SignalWire's REST API properly
    const tokenEndpoint = `https://${spaceUrl}/api/video/room_tokens`
    
    // This is what the old working version did - single API call with auto_create_room
    const tokenRequest = {
      room_name: roomName || `test-room-${Date.now()}`,
      user_name: userName || 'Guest',
      auto_create_room: true,
      permissions: [
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
    }

    console.log('Requesting token from SignalWire:', tokenEndpoint)
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`
      },
      body: JSON.stringify(tokenRequest)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', errorText)
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()

    // Log token info for debugging
    try {
      const payload = JSON.parse(atob(tokenData.token.split('.')[1]))
      console.log('Token generated. Has ICE servers:', !!(payload.ice_servers || payload.s?.ice_servers))
    } catch (e) {
      console.log('Could not decode token for debugging')
    }

    return new Response(
      JSON.stringify({
        token: tokenData.token,
        projectId,
        spaceUrl,
        roomName: tokenRequest.room_name
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