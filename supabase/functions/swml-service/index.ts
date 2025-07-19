// supabase/functions/swml-service/index.ts
//
// SWML Service endpoint for AI estimator
// This serves SWML scripts based on request parameters
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
    const url = new URL(req.url)
    const scriptName = url.searchParams.get('script') || 'ai-estimator'
    
    // Get room_id from various sources
    let roomId = url.searchParams.get('room_id') || 
                 url.searchParams.get('room_name') || 
                 url.searchParams.get('roomName') || ''
    
    // Also check request body for POST requests
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        roomId = roomId || body.room_id || body.room_name || body.roomName || ''
      } catch {
        // Ignore JSON parse errors
      }
    }

    console.log('SWML Service request:', { scriptName, roomId })

    // Build the SWML based on the script name
    if (scriptName === 'ai-estimator') {
      const swml = {
        "version": "1.0.0",
        "sections": {
          "main": [
            {
              "video": {
                "join_room": {
                  "name": roomId || "{{room_id}}",
                  "display_name": "AI Estimator Alex",
                  "permissions": [
                    "room.subscribe",
                    "room.publish",
                    "room.speak",
                    "room.video_muted",
                    "room.audio_muted"
                  ],
                  "join_existing": true
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
                  "text": "You are **Estimator Alex**, a friendly but expert remote estimator for TradeWorks Pro.\n1. Greet the customer and confirm the trade (roofing, plumbing, HVAC, electrical, etc.).\n2. Guide them to show each problem area on camera.\n3. Call get_visual_input whenever you need a frame.\n4. For EVERY defect, call capture_issue.\n5. Finish by calling complete_inspection.\nNever promise exact prices; these are preliminary AI-assisted figures pending human review."
                },
                "SWAIG": {
                  "functions": [
                    {
                      "function": "get_visual_input",
                      "purpose": "Analyse the current video frame.",
                      "arguments": {
                        "type": "object",
                        "properties": {
                          "focus_area": {
                            "type": "string"
                          }
                        }
                      }
                    },
                    {
                      "function": "capture_issue",
                      "purpose": "Log an identified defect.",
                      "arguments": {
                        "type": "object",
                        "properties": {
                          "location": {
                            "type": "string"
                          },
                          "issue_type": {
                            "type": "string"
                          },
                          "severity": {
                            "type": "string",
                            "enum": ["minor", "moderate", "major", "critical"]
                          },
                          "visual_description": {
                            "type": "string"
                          },
                          "estimated_cost_range": {
                            "type": "string"
                          }
                        },
                        "required": ["location", "issue_type", "severity", "visual_description"]
                      },
                      "web_hook_url": `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
                      "web_hook_auth": `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                    },
                    {
                      "function": "complete_inspection",
                      "purpose": "Send a final summary with totals.",
                      "arguments": {
                        "type": "object",
                        "properties": {
                          "summary": {
                            "type": "string"
                          },
                          "total_issues": {
                            "type": "integer"
                          },
                          "estimated_total": {
                            "type": "string"
                          }
                        },
                        "required": ["summary", "total_issues", "estimated_total"]
                      },
                      "web_hook_url": `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-summary`,
                      "web_hook_auth": `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                    }
                  ]
                }
              }
            }
          ]
        }
      }

      return new Response(JSON.stringify(swml, null, 2), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/swml+json'
        },
      })
    }

    // Return 404 for unknown scripts
    return new Response(
      JSON.stringify({ error: 'Script not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      }
    )
  } catch (error: any) {
    console.error('SWML Service error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})