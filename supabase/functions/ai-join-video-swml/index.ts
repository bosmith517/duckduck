// supabase/functions/ai-join-video-swml/index.ts
//
// Joins AI to video room using SWML execution
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
    const { room_name, session_id, trade_type } = await req.json()

    if (!room_name) {
      throw new Error('room_name is required')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    
    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log('Executing SWML to join AI to video room:', room_name)

    // Build the SWML directly for video room
    // Note: SignalWire requires the exact room name that was used when creating the room
    console.log(`Building SWML to join room with name: ${room_name}`)
    
    const swml = {
      "version": "1.0.0",
      "sections": {
        "main": [
          {
            "video": {
              "join_room": {
                "name": room_name,  // This must match the room name used in room creation
                "display_name": "AI Estimator Alex",
                "permissions": [
                  "room.subscribe",
                  "room.publish",
                  "room.speak",
                  "room.video_muted",
                  "room.audio_muted"
                ],
                "join_existing": true  // Important: join existing session
              }
            }
          },
          {
            "ai": {
              "voice": "rachel",
              "engine": "elevenlabs",
              "params": {
                "enable_vision": true,
                "vision_model": "gpt-4o-mini",
                "language": "en-US",
                "temperature": 0.4
              },
              "prompt": {
                "role": "system",
                "text": `You are **AI Estimator Alex**, a friendly but expert remote estimator for TradeWorks Pro.
You are helping with a ${trade_type || 'general'} estimate.
1. Start by saying: "Hello! I'm Alex, your AI estimator. I can see you've joined the video session. Can you hear me clearly?"
2. Confirm what type of work they need estimated.
3. Guide them to show each problem area on camera - be specific about angles needed.
4. Use your vision capabilities to analyze what you see.
5. For EVERY issue you identify, document it thoroughly.
6. Provide preliminary cost estimates based on what you observe.
7. Be professional but conversational. Build rapport while gathering information.
Remember: These are preliminary estimates pending human review. Always mention this.`
              }
            }
          }
        ]
      }
    }

    // Execute the SWML using SignalWire's execute endpoint
    const executeUrl = `https://${signalwireSpaceUrl}/api/relay/rest/execute`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'execute',
        params: {
          swml: swml,
          context: {
            room_name: room_name,
            session_id: session_id,
            trade_type: trade_type
          }
        }
      })
    })

    const responseText = await executeResponse.text()
    console.log('SWML execution response:', executeResponse.status, responseText)

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { 
        status: executeResponse.status,
        response: responseText 
      }
    }

    if (!executeResponse.ok) {
      console.error('SWML execution failed:', responseData)
      
      // Try alternative approach using relay bin if available
      const relayBinUrl = Deno.env.get('SIGNALWIRE_AI_RELAY_BIN_URL')
      if (relayBinUrl) {
        console.log('Trying relay bin fallback:', relayBinUrl)
        
        const relayResponse = await fetch(relayBinUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            swml: swml,
            room_name: room_name,
            room_id: room_name,  // Some relay bins expect room_id
            metadata: {
              session_id: session_id,
              trade_type: trade_type,
              room_name: room_name
            }
          })
        })
        
        if (relayResponse.ok) {
          const relayData = await relayResponse.text()
          
          if (session_id) {
            const supabase = createClient(
              Deno.env.get('SUPABASE_URL')!,
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            )
            
            await supabase
              .from('video_sessions')
              .update({
                ai_agent_status: 'relay_bin_triggered',
                updated_at: new Date().toISOString()
              })
              .eq('id', session_id)
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              method: 'relay_bin_fallback',
              message: 'AI triggered via relay bin'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to execute SWML',
          details: responseData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Update session if provided
    if (session_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('video_sessions')
        .update({
          ai_agent_status: 'swml_executed',
          ai_execution_id: responseData.id || responseData.execution_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        method: 'swml_direct_execution',
        execution_id: responseData.id || responseData.execution_id,
        message: 'AI SWML executed for video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error executing video SWML:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to execute AI SWML for video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})