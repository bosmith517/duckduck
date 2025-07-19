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

    // Create a simple JWT manually without external library
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    }

    const payload = {
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
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      jti: crypto.randomUUID()
    }

    // Base64URL encode
    const base64url = (str: string) => {
      return btoa(str)
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
    }

    // Create token parts
    const encodedHeader = base64url(JSON.stringify(header))
    const encodedPayload = base64url(JSON.stringify(payload))
    const signature = encodedHeader + '.' + encodedPayload

    // For now, return a test token (in production, this would need proper HMAC signing)
    const token = signature + '.test-signature'

    return new Response(
      JSON.stringify({
        token,
        projectId,
        spaceUrl,
        roomName: payload.room_name,
        note: 'This is a test token - proper JWT signing needed for production'
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
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})