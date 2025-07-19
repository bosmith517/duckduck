import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { room_name, customer_name, session_id } = await req.json()

    // Get SignalWire credentials from environment
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN') 
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('SignalWire credentials not configured')
    }

    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const baseUrl = `https://${signalwireSpaceUrl}/api/video`

    console.log(`Creating room: ${room_name} for customer: ${customer_name}`)

    // Step 1: Create the video room using our proven REST API approach
    const roomResponse = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: room_name,
        display_name: `Video Estimate - ${customer_name}`,
        max_participants: 5,
        enable_recording: false
      })
    })

    if (!roomResponse.ok) {
      const errorText = await roomResponse.text()
      console.error('Room creation failed:', roomResponse.status, errorText)
      throw new Error(`Room creation failed: ${roomResponse.status} ${errorText}`)
    }

    const roomData = await roomResponse.json()
    console.log('Room created successfully:', roomData.name)

    // Step 2: Generate room token with join_as: 'member' (our working approach)
    const tokenResponse = await fetch(`${baseUrl}/room_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_name: customer_name || `Customer_${Date.now()}`,
        room_name: room_name,
        join_as: 'member', // This is the key setting that works
        permissions: [
          'room.self.audio_mute',
          'room.self.audio_unmute',
          'room.self.video_mute',
          'room.self.video_unmute'
        ],
        expires_in: 3600 // 1 hour
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token generation failed:', tokenResponse.status, errorText)
      throw new Error(`Token generation failed: ${tokenResponse.status} ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Token generated successfully, length:', tokenData.token.length)

    // Step 3: Store room info in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (session_id) {
      await supabase
        .from('video_sessions')
        .update({
          signalwire_room_id: roomData.id,
          signalwire_room_name: roomData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        room: roomData,
        token: tokenData.token,
        room_name: roomData.name,
        room_id: roomData.id,
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )

  } catch (error) {
    console.error('Error in create-signalwire-room:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to create SignalWire room and token'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }, 
        status: 500 
      }
    )
  }
})