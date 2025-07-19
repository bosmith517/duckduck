// supabase/functions/create-signalwire-room-fast/index.ts
//
// FIXED version - uses two-step process to ensure ICE servers are included
// This prevents the 45-second connection delay
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
    const { room_name, customer_name, session_id } = await req.json()

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

    console.log(`Creating room with two-step process: ${room_name}, customer: ${customer_name}`)

    // STEP 1: Create the room first
    // This ensures the room exists before we generate a token for it
    const roomResponse = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        name: room_name,
        display_name: room_name,
        max_participants: 10,
        quality: 'HD'
      })
    })

    // Check if room already exists (409 Conflict is OK)
    if (!roomResponse.ok && roomResponse.status !== 409) {
      const errorText = await roomResponse.text()
      console.error('Room creation failed:', roomResponse.status, errorText)
      throw new Error(`Room creation failed: ${roomResponse.status}`)
    }

    let roomData = null
    if (roomResponse.ok) {
      roomData = await roomResponse.json()
      console.log('Room created successfully:', roomData.id)
    } else {
      console.log('Room already exists, proceeding with token generation')
    }

    // STEP 2: Create a token for the existing room
    // This standard method correctly includes the default ICE servers in the token
    const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: room_name,
        user_name: customer_name || 'Guest',
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute',
          'room.self.set_input_volume',
          'room.self.set_output_volume',
          'room.self.set_input_sensitivity'
        ],
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token generation failed:', tokenResponse.status, errorText)
      throw new Error(`Token generation failed: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token generated successfully, length:', tokenData.token.length)

    // Extract room info from token (if needed for database)
    let roomInfo = { id: room_name, name: room_name }
    try {
      // Decode token to get room details
      const payload = JSON.parse(atob(tokenData.token.split('.')[1]))
      if (payload.r) {
        roomInfo.name = payload.r
      }
      console.log('Token room info:', roomInfo)
    } catch (e) {
      console.log('Could not decode token payload')
    }

    // Store room info in database if session_id provided
    if (session_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase
        .from('video_sessions')
        .update({
          signalwire_room_id: roomInfo.id,
          signalwire_room_name: roomInfo.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: tokenData.token,
        room_name: roomInfo.name,
        room_id: roomInfo.id,
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )

  } catch (error) {
    console.error('Error in create-signalwire-room-fast:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to create SignalWire token'
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