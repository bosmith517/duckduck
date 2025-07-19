// supabase/functions/add-ai-assistant-to-room/index.ts
//
// Adds AI assistant to video room using SignalWire AI Agent API
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

    console.log('Adding AI assistant to room:', room_name)

    // Create SWML (SignalWire Markup Language) for the AI agent
    const swml = {
      version: "1.0.0",
      sections: {
        main: [
          {
            connect: {
              to: `video:${room_name}`,
              codecs: ["opus", "h264"]
            }
          },
          {
            ai: {
              voice: "en-US-Standard-C",
              prompt: {
                text: `You are Alex, an AI ${trade_type?.toLowerCase() || 'home services'} estimation assistant.

Your role in this video estimation session is to:
1. Greet the customer warmly and introduce yourself
2. Explain that you'll guide them through showing areas that need service
3. Ask them to use their phone's rear camera for better quality
4. Guide them to show specific areas based on the ${trade_type} service needed
5. Point out any issues you observe and explain their severity
6. Ask for closer views or different angles when needed
7. Keep the inspection moving efficiently while being thorough
8. Thank them at the end and let them know they'll receive a detailed estimate

Start by greeting them and asking them to switch to their rear camera.`,
                temperature: 0.7
              },
              post_prompt: {
                text: "Summarize the key issues found and next steps for the estimate."
              },
              params: {
                language: "en-US",
                direction: "both",
                wait_for_user: true,
                end_of_speech_timeout: 2000,
                attention_timeout: 15000,
                local_tz: "America/Chicago",
                conscience: true,
                save_conversation: true,
                conversation_id: session_id || `estimate_${Date.now()}`
              },
              SWAIG: {
                defaults: {
                  web_hook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
                  web_hook_auth_user: "supabase",
                  web_hook_auth_password: Deno.env.get('WEBHOOK_SECRET')
                },
                functions: [
                  {
                    function: "capture_issue",
                    purpose: "Document an issue found during inspection",
                    argument: {
                      type: "object",
                      properties: {
                        description: { type: "string", description: "Description of the issue" },
                        severity: { type: "string", enum: ["minor", "moderate", "major", "critical"] },
                        location: { type: "string", description: "Where the issue is located" }
                      }
                    }
                  },
                  {
                    function: "request_view",
                    purpose: "Ask customer to show a specific area or angle",
                    argument: {
                      type: "object", 
                      properties: {
                        area: { type: "string", description: "What area to show" },
                        reason: { type: "string", description: "Why this view is needed" }
                      }
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    }

    // Make the API call to execute SWML
    const swmlUrl = `https://${signalwireSpaceUrl}/api/video/swml`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    const swmlResponse = await fetch(swmlUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        swml: swml,
        call_params: {
          to: `video:${room_name}`,
          from: "AI Estimator"
        }
      })
    })

    const responseText = await swmlResponse.text()
    console.log('SWML execution response:', swmlResponse.status, responseText)

    if (!swmlResponse.ok) {
      // Try alternative approach: Create an AI session
      console.log('SWML failed, trying AI session approach...')
      
      const aiSessionUrl = `https://${signalwireSpaceUrl}/api/ai/sessions`
      const aiSessionResponse = await fetch(aiSessionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistant: {
            name: "Alex",
            voice: "en-US-Standard-C",
            first_message: "Hello! I'm Alex, your AI estimation assistant. I'm here to help document issues for your estimate. Could you please switch to your rear camera so I can see what you're showing me?",
            prompt: swml.sections.main[1].ai.prompt.text
          },
          channel: {
            type: "video",
            room_name: room_name
          }
        })
      })

      if (aiSessionResponse.ok) {
        const aiSessionData = await aiSessionResponse.json()
        
        if (session_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          
          await supabase
            .from('video_sessions')
            .update({
              ai_session_id: aiSessionData.id,
              ai_agent_status: 'active'
            })
            .eq('id', session_id)
        }

        return new Response(
          JSON.stringify({
            success: true,
            method: 'ai_session',
            session_id: aiSessionData.id,
            message: 'AI assistant session created'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    let swmlData
    try {
      swmlData = JSON.parse(responseText)
    } catch {
      swmlData = { response: responseText }
    }

    // Update session if provided
    if (session_id && swmlResponse.ok) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('video_sessions')
        .update({
          ai_agent_status: 'active',
          ai_swml_execution: swmlData,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: swmlResponse.ok,
        method: 'swml',
        execution_result: swmlData,
        message: swmlResponse.ok ? 'AI assistant is joining the room' : 'Failed to add AI assistant'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error adding AI assistant:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to add AI assistant to room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})