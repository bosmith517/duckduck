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
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    const auth = btoa(`${projectId}:${apiToken}`)
    const baseUrl = `https://${spaceUrl}/api/video`
    const room_name = `ice-test-${Date.now()}`
    
    const results: any = {}
    
    // Test 1: auto_create_room approach
    console.log('Testing auto_create_room approach...')
    try {
      const response1 = await fetch(`${baseUrl}/room_tokens`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          room_name: room_name + '-auto',
          user_name: 'Test User',
          auto_create_room: true,
          permissions: [
            "room.self.audio_mute",
            "room.self.audio_unmute",
            "room.self.video_mute",
            "room.self.video_unmute"
          ]
        })
      })
      
      if (response1.ok) {
        const data = await response1.json()
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        results.autoCreateRoom = {
          success: true,
          hasIceServers: !!(payload.ice_servers || payload.s?.ice_servers || payload.video?.ice_servers),
          tokenLength: data.token.length
        }
      } else {
        results.autoCreateRoom = {
          success: false,
          error: await response1.text()
        }
      }
    } catch (e: any) {
      results.autoCreateRoom = { error: e.message }
    }
    
    // Test 2: Two-step approach
    console.log('Testing two-step approach...')
    try {
      // Create room first
      const roomResponse = await fetch(`${baseUrl}/rooms`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          name: room_name + '-twostep'
        })
      })
      
      // Then create token
      const response2 = await fetch(`${baseUrl}/room_tokens`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          room_name: room_name + '-twostep',
          user_name: 'Test User',
          permissions: [
            "room.self.audio_mute",
            "room.self.audio_unmute",
            "room.self.video_mute",
            "room.self.video_unmute"
          ]
        })
      })
      
      if (response2.ok) {
        const data = await response2.json()
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        results.twoStep = {
          success: true,
          hasIceServers: !!(payload.ice_servers || payload.s?.ice_servers || payload.video?.ice_servers),
          tokenLength: data.token.length,
          tokenPayload: payload
        }
      } else {
        results.twoStep = {
          success: false,
          error: await response2.text()
        }
      }
    } catch (e: any) {
      results.twoStep = { error: e.message }
    }
    
    // Test 3: With room.join permission (as shown in PRP)
    console.log('Testing with room.join permission...')
    try {
      const response3 = await fetch(`${baseUrl}/room_tokens`, {
        method: 'POST',
        headers: { 
          'Authorization': `Basic ${auth}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          room_name: room_name + '-twostep', // Use existing room
          user_name: 'Test User Join',
          permissions: [
            "room.join",
            "room.self.audio_mute",
            "room.self.audio_unmute",
            "room.self.video_mute",
            "room.self.video_unmute"
          ]
        })
      })
      
      if (response3.ok) {
        const data = await response3.json()
        results.withRoomJoin = { success: true }
      } else {
        const errorText = await response3.text()
        results.withRoomJoin = {
          success: false,
          status: response3.status,
          error: errorText
        }
      }
    } catch (e: any) {
      results.withRoomJoin = { error: e.message }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})