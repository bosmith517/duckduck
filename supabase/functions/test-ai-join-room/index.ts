// supabase/functions/test-ai-join-room/index.ts
//
// Test function to join AI to video room using various methods
//

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { room_name, method = 'relay' } = await req.json()

    if (!room_name) {
      throw new Error('room_name is required')
    }

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    if (!projectId || !apiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log(`Testing AI join to room: ${room_name} using method: ${method}`)
    const auth = btoa(`${projectId}:${apiToken}`)

    let result: any = {}

    // Method 1: Direct Relay Call (Voice/Video)
    if (method === 'relay') {
      const relayUrl = `https://${spaceUrl}/api/relay/rest/calls`
      
      const payload = {
        to: [{
          type: "sip",
          uri: `sip:${room_name}@${spaceUrl}`
        }],
        from: {
          type: "phone",
          number: "+1234567890" // Or use a valid SignalWire number
        },
        call_type: "video", // Specify video call
        layout: "grid",
        region: "us",
        codecs: ["PCMU", "PCMA", "OPUS", "G722", "VP8", "H264"]
      }

      console.log('Relay payload:', payload)

      const response = await fetch(relayUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const responseText = await response.text()
      console.log('Relay response:', response.status, responseText)

      if (response.ok) {
        result = {
          success: true,
          method: 'relay',
          response: JSON.parse(responseText)
        }
      } else {
        result = {
          success: false,
          method: 'relay',
          error: responseText,
          status: response.status
        }
      }
    }

    // Method 2: LAML Call with Video
    else if (method === 'laml') {
      const lamlUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls`
      
      const formData = new URLSearchParams({
        To: `sip:${room_name}@${spaceUrl}`,
        From: 'ai-assistant',
        Url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-video-swml?room=${room_name}`,
        Method: 'POST',
        Record: 'false',
        MediaStreams: 'video' // Enable video for LAML
      })

      console.log('LAML form data:', formData.toString())

      const response = await fetch(lamlUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      })

      const responseText = await response.text()
      console.log('LAML response:', response.status, responseText)

      if (response.ok) {
        result = {
          success: true,
          method: 'laml',
          response: JSON.parse(responseText)
        }
      } else {
        result = {
          success: false,
          method: 'laml',
          error: responseText,
          status: response.status
        }
      }
    }

    // Method 3: Video Room Token for AI
    else if (method === 'token') {
      const tokenUrl = `https://${spaceUrl}/api/video/room_tokens`
      
      const tokenPayload = {
        room_name: room_name,
        user_name: "AI Assistant Alex",
        permissions: [
          "room.subscribe",
          "room.publish",
          "room.speak"
        ],
        join_as: "member",
        auto_join: true,
        join_audio_muted: false,
        join_video_muted: false
      }

      console.log('Token payload:', tokenPayload)

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tokenPayload)
      })

      const responseText = await response.text()
      console.log('Token response:', response.status, responseText)

      if (response.ok) {
        const tokenData = JSON.parse(responseText)
        
        // Now we need to use this token to join - this would typically be done by an AI agent
        result = {
          success: true,
          method: 'token',
          token: tokenData.token,
          message: 'Token generated - AI agent needs to use this to join',
          room_url: `https://${spaceUrl}/room/${room_name}?token=${tokenData.token}`
        }
      } else {
        result = {
          success: false,
          method: 'token',
          error: responseText,
          status: response.status
        }
      }
    }

    console.log('Test result:', result)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error in test-ai-join-room:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  }
})