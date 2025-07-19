// supabase/functions/ai-video-swml/index.ts
//
// SWML endpoint for AI agent to join video rooms
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
    // Get room name from query parameters or request body
    const url = new URL(req.url)
    let roomName = url.searchParams.get('room') || ''
    
    // If POST request, also check body
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        roomName = roomName || body.room_name || body.room || ''
      } catch {
        // If not JSON, try form data
        try {
          const formData = await req.formData()
          roomName = roomName || formData.get('room_name') || formData.get('room') || ''
        } catch {
          // Ignore parsing errors
        }
      }
    }
    
    console.log('AI Video SWML called for room:', roomName)
    
    if (!roomName) {
      return new Response(
        JSON.stringify({ error: 'Room name is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
    
    // Generate SWML for AI agent
    const swml = {
      version: "1.0.0",
      sections: {
        main: [
          {
            answer: {}
          },
          {
            record_call: {
              stereo: true,
              format: "mp3"
            }
          },
          {
            join_room: {
              name: roomName
            }
          },
          {
            ai: {
              voice: "en-US-Standard-C",
              params: {
                language: "en-US",
                direction: "both",
                wait_for_user: true,
                end_of_speech_timeout: 2000,
                attention_timeout: 15000,
                inactivity_timeout: 120,
                barge: true,
                conscience: true,
                save_conversation: true,
                conversation_id: `estimate_${roomName}_${Date.now()}`
              },
              prompt: {
                temperature: 0.7,
                top_p: 0.9,
                text: `You are Alex, an AI estimation assistant for a home services company.

You are joining a video estimation session to help analyze and document issues.

Your role is to:
1. Greet the customer warmly and introduce yourself
2. Ask them to use their phone's rear camera for better video quality
3. Guide them through showing different areas that need service
4. Point out any issues you observe and explain their severity
5. Ask for closer views or different angles when needed
6. Keep the inspection moving efficiently while being thorough
7. Document everything for the estimate

Important guidelines:
- Be professional, friendly, and patient
- Speak clearly and avoid technical jargon
- If you can't see something clearly, ask them to move the camera
- Acknowledge what you see before asking them to show the next area
- Thank them for their time when finishing

Start by greeting them and asking them to switch to their rear camera.`
              },
              post_prompt: {
                text: "Summarize the key issues found during the inspection and thank the customer for their time. Let them know they'll receive a detailed estimate shortly."
              },
              SWAIG: {
                defaults: {
                  web_hook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
                  web_hook_auth_user: "supabase",
                  web_hook_auth_password: Deno.env.get('WEBHOOK_SECRET') || ""
                },
                functions: [
                  {
                    function: "capture_issue",
                    purpose: "Document an issue found during inspection",
                    argument: {
                      type: "object",
                      properties: {
                        description: { 
                          type: "string", 
                          description: "Detailed description of the issue observed" 
                        },
                        severity: { 
                          type: "string", 
                          enum: ["minor", "moderate", "major", "critical"],
                          description: "How severe is this issue"
                        },
                        location: { 
                          type: "string", 
                          description: "Where is the issue located" 
                        }
                      },
                      required: ["description", "severity", "location"]
                    }
                  },
                  {
                    function: "request_view",
                    purpose: "Ask customer to show a specific area or angle",
                    argument: {
                      type: "object", 
                      properties: {
                        area: { 
                          type: "string", 
                          description: "What area or angle to show" 
                        },
                        reason: { 
                          type: "string", 
                          description: "Why this view is needed" 
                        }
                      },
                      required: ["area"]
                    }
                  },
                  {
                    function: "mark_inspection_complete",
                    purpose: "Mark the video inspection as complete",
                    argument: {
                      type: "object",
                      properties: {
                        summary: {
                          type: "string",
                          description: "Summary of all issues found"
                        },
                        next_steps: {
                          type: "string",
                          description: "Recommended next steps"
                        }
                      },
                      required: ["summary"]
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    }
    
    console.log('Returning SWML for room:', roomName)
    
    return new Response(JSON.stringify(swml), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/swml+json' 
      },
    })
  } catch (error: any) {
    console.error('Error in AI Video SWML:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})