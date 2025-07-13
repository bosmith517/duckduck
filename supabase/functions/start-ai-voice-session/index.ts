// supabase/functions/start-ai-voice-session/index.ts
//
// Starts an AI voice session that connects to the video room
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
    const { session_id, room_id, room_url } = await req.json()

    if (!session_id || !room_id) {
      throw new Error('session_id and room_id are required')
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Create a phone call that connects to the video room using SWML
    const callUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/calls`
    
    // SWML script URL - we'll use the inline version
    const swmlScript = {
      version: "1.0.0",
      sections: {
        main: [
          {
            ai: {
              prompt: {
                text: `You are a professional ${session.trade_type.toLowerCase()} estimator assistant conducting a video estimate inspection.
                
Your name is Alex, and you're here to help create an accurate estimate. Your role is to:
1. Greet the customer warmly and explain you'll guide them through the inspection
2. Ask them to use their phone's rear camera to show the areas that need inspection
3. Guide them to show specific areas based on ${session.trade_type} inspection requirements
4. Point out any issues you notice and explain their severity
5. Request closer views when you need more detail
6. Keep the inspection moving efficiently while being thorough

Start by introducing yourself and asking what specific ${session.trade_type.toLowerCase()} issues they're experiencing.`
              },
              params: {
                temperature: 0.7,
                top_p: 0.9
              },
              voice: "rachel",
              languages: ["en-US"],
              post_prompt: {
                text: "Summarize what was discussed and let them know you'll prepare their estimate."
              }
            }
          },
          {
            connect: {
              to: room_url || `https://${signalwireSpaceUrl}/public/video/${room_id}`,
              codecs: ["PCMU", "PCMA", "VP8"]
            }
          }
        ]
      }
    }

    // Make outbound call to connect AI to video room
    const callPayload = {
      to: room_url || `sip:${room_id}@${signalwireSpaceUrl}`,
      from: "+19999999999", // Virtual number for AI
      url: `data:application/json;base64,${btoa(JSON.stringify(swmlScript))}`,
      method: "POST",
      timeout: 30
    }

    console.log('Starting AI voice call with payload:', callPayload)

    const callResponse = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload)
    })

    if (!callResponse.ok) {
      const errorData = await callResponse.text()
      console.error('SignalWire call API error:', errorData)
      
      // Fallback: Try using the video room token approach
      console.log('Trying video room token approach...')
      
      // Generate a token for the AI to join as a participant
      const tokenUrl = `https://${signalwireSpaceUrl}/api/video/room_tokens`
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: room_id,
          user_name: 'AI Estimator Assistant',
          permissions: [
            'room.self.audio_mute',
            'room.self.audio_unmute', 
            'room.self.video_mute',
            'room.self.video_unmute',
            'room.member.audio_mute',
            'room.member.audio_unmute'
          ],
          auto_join: false,
          expires_in: 3600
        })
      })

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        
        // Store the AI token for manual agent connection
        await supabase
          .from('video_sessions')
          .update({
            ai_agent_token: tokenData.token,
            ai_agent_status: 'ready',
            status: 'active'
          })
          .eq('id', session_id)

        return new Response(
          JSON.stringify({
            success: true,
            method: 'token',
            ai_token: tokenData.token,
            message: 'AI token generated. Agent will join shortly.'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
      
      throw new Error('Failed to start AI voice session')
    }

    const callData = await callResponse.json()
    console.log('AI voice call started:', callData)

    // Update session with call info
    await supabase
      .from('video_sessions')
      .update({
        ai_call_id: callData.call_id,
        ai_agent_status: 'calling',
        status: 'active'
      })
      .eq('id', session_id)

    return new Response(
      JSON.stringify({
        success: true,
        method: 'call',
        call_id: callData.call_id,
        message: 'AI voice assistant is connecting...'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error starting AI voice session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})