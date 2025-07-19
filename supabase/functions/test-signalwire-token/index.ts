import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { create } from 'https://esm.sh/jsonwebtoken@9.0.0'

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

    // Check if SignalWire credentials are available
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const projectToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    if (!projectId || !projectToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured in environment variables')
    }

    // Create a proper JWT token for SignalWire video room
    const tokenPayload = {
      room_name: roomName || 'test-room',
      user_name: userName || 'Guest',
      auto_create_room: true,
      permissions: [
        'room.self.audio_mute',
        'room.self.audio_unmute',
        'room.self.video_mute', 
        'room.self.video_unmute',
        'room.self.set_input_volume',
        'room.self.set_output_volume'
      ]
    }

    // Create JWT token properly signed
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        ...tokenPayload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        jti: crypto.randomUUID()
      },
      projectToken
    )

    return new Response(
      JSON.stringify({
        token,
        projectId,
        spaceUrl,
        roomName: roomName || 'test-room',
        debug: {
          hasProjectId: !!projectId,
          hasProjectToken: !!projectToken,
          hasSpaceUrl: !!spaceUrl
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in test-signalwire-token:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})