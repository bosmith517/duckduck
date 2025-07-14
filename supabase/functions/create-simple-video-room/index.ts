// supabase/functions/create-simple-video-room/index.ts
// Minimal video room creation for debugging

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
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    // Create a simple room with minimal configuration
    const roomName = `test_room_${Date.now()}`
    const roomConfig = {
      name: roomName,
      display_name: 'Test Video Room',
      max_members: 10,
      join_audio_muted: false,
      join_video_muted: false
    }

    console.log('Creating room:', roomConfig)

    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const roomResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomConfig),
    })

    if (!roomResponse.ok) {
      const errorText = await roomResponse.text()
      console.error('Room creation failed:', errorText)
      throw new Error(`Failed to create room: ${roomResponse.status}`)
    }

    const roomData = await roomResponse.json()
    console.log('Room created:', roomData)

    // Generate a simple customer token
    const tokenResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/room_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: roomName,
        user_name: 'Test Customer',
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute',
          'room.self.deaf',
          'room.self.undeaf',
          'room.list_available_layouts',
          'room.set_layout',
          'room.member.video_mute',
          'room.member.audio_mute'
        ]
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token generation failed:', errorText)
      throw new Error(`Failed to generate token: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token generated successfully')

    return new Response(JSON.stringify({
      room: {
        id: roomData.id,
        name: roomName,
        url: roomData.url || `https://${signalwireSpaceUrl}/room/${roomData.id}`
      },
      token: tokenData.token,
      debug_url: `/test-video-debug?sw_token=${encodeURIComponent(tokenData.token)}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})