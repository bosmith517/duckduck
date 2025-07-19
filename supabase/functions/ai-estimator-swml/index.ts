// supabase/functions/ai-estimator-swml/index.ts
//
// Returns the AI estimator SWML configuration in proper JSON format
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
    // Get room_id from query params or body
    const url = new URL(req.url)
    let roomId = url.searchParams.get('room_id') || ''
    
    if (req.method === 'POST') {
      const body = await req.json()
      roomId = roomId || body.room_id || body.room_name || ''
    }

    // Build the SWML JSON configuration
    const swml = {
      "version": "1.0.0",
      "variables": {
        "estimator_name": "Estimator Alex"
      },
      "sections": {
        "main": [
          {
            "video": {
              "join_room": {
                "name": roomId || "{{context.room_id}}",
                "display_name": "{{vars.estimator_name}}",
                "permissions": [
                  "room.subscribe",
                  "room.publish"
                ]
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
                "text": "You are **{{vars.estimator_name}}**, a friendly but expert remote estimator for TradeWorks Pro.\n1. Greet the customer and confirm the trade (roofing, plumbing, HVAC, electrical, etc.).\n2. Guide them to show each problem area on camera.\n3. Call get_visual_input whenever you need a frame.\n4. For EVERY defect, call capture_issue.\n5. Finish by calling complete_inspection.\nNever promise exact prices; these are preliminary AI-assisted figures pending human review."
              }
            }
          },
          {
            "loop": [
              {
                "ai": {
                  "function": "get_visual_input",
                  "arguments": {
                    "focus_area": "general inspection"
                  }
                }
              },
              {
                "ai": {
                  "prompt": "Describe what you see, log any defects, then ask for the next angle."
                }
              },
              {
                "wait": 2
              }
            ]
          },
          {
            "ai": {
              "function": "complete_inspection",
              "arguments": {
                "summary": "{{state.summary}}",
                "total_issues": "{{state.issue_count}}",
                "estimated_total": "{{state.total_estimate}}"
              }
            }
          }
        ]
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
            },
            "returns": {
              "type": "string"
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

    return new Response(JSON.stringify(swml, null, 2), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/swml+json'
      },
    })
  } catch (error: any) {
    console.error('Error generating SWML:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})