// supabase/functions/create-ai-agent/index.ts
//
// Creates a SignalWire AI Agent following the proper Agents SDK approach
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

    console.log('Creating AI Agent for room:', room_name)

    // Create the agent using SignalWire Agents API
    const agentUrl = `https://${signalwireSpaceUrl}/api/agents`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    // Agent configuration following the guide
    const agentConfig = {
      "name": "AI-Estimator-Alex",
      "type": "realtime",
      "config": {
        "ai": {
          "voice": "rachel",
          "engine": "elevenlabs",
          "model": "gpt-4o-mini",
          "temperature": 0.4,
          "enable_vision": true,
          "vision_model": "gpt-4o-mini",
          "language": "en-US",
          "prompt": `You are **AI Estimator Alex**, a friendly but expert remote estimator for TradeWorks Pro.
You are helping with a ${trade_type || 'general'} estimate via video call.

Your role:
1. Greet the customer warmly and confirm what type of work they need estimated
2. Ask them to show you the areas that need work using their camera
3. Use your vision capabilities to analyze what you see
4. Document each issue thoroughly as they show it to you
5. Provide preliminary cost estimates based on your observations
6. Be professional yet conversational - build rapport while gathering information

Important guidelines:
- Always remind customers these are preliminary estimates pending human review
- Ask clarifying questions about what you see
- Guide them on camera angles for better assessment
- Document everything you observe for the formal estimate

Current session: Helping with ${trade_type || 'general'} estimate.`
        },
        "functions": [
          {
            "name": "capture_issue",
            "purpose": "Document an identified issue or defect",
            "parameters": {
              "type": "object",
              "properties": {
                "location": {
                  "type": "string",
                  "description": "Where the issue is located"
                },
                "issue_type": {
                  "type": "string",
                  "description": "Type of issue identified"
                },
                "severity": {
                  "type": "string",
                  "enum": ["minor", "moderate", "major", "critical"],
                  "description": "Severity of the issue"
                },
                "visual_description": {
                  "type": "string",
                  "description": "Detailed description of what you see"
                },
                "estimated_cost_range": {
                  "type": "string",
                  "description": "Estimated cost range to fix"
                }
              },
              "required": ["location", "issue_type", "severity", "visual_description"]
            },
            "webhook": {
              "url": `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
              "method": "POST",
              "headers": {
                "Authorization": `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              }
            }
          },
          {
            "name": "complete_inspection",
            "purpose": "Finalize the inspection with a summary",
            "parameters": {
              "type": "object",
              "properties": {
                "summary": {
                  "type": "string",
                  "description": "Overall summary of the inspection"
                },
                "total_issues": {
                  "type": "number",
                  "description": "Total number of issues found"
                },
                "estimated_total": {
                  "type": "string",
                  "description": "Total estimated cost range"
                }
              },
              "required": ["summary", "total_issues", "estimated_total"]
            },
            "webhook": {
              "url": `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-summary`,
              "method": "POST",
              "headers": {
                "Authorization": `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              }
            }
          }
        ]
      }
    }

    console.log('Creating agent with config:', JSON.stringify(agentConfig, null, 2))

    const createResponse = await fetch(agentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig)
    })

    const responseText = await createResponse.text()
    console.log('Agent creation response:', createResponse.status, responseText)

    let agentData
    try {
      agentData = JSON.parse(responseText)
    } catch {
      agentData = { 
        status: createResponse.status,
        response: responseText 
      }
    }

    if (!createResponse.ok) {
      console.error('Failed to create agent:', agentData)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to create AI agent',
          details: agentData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Now connect the agent to the room
    const agentId = agentData.id || agentData.agent_id
    console.log('Agent created with ID:', agentId)

    // Connect agent to video room
    const connectUrl = `https://${signalwireSpaceUrl}/api/agents/${agentId}/sessions`
    
    const connectPayload = {
      "room_name": room_name,
      "display_name": "AI Estimator Alex",
      "permissions": [
        "room.subscribe",
        "room.publish"
      ]
    }

    const connectResponse = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connectPayload)
    })

    const connectText = await connectResponse.text()
    console.log('Agent connection response:', connectResponse.status, connectText)

    let connectData
    try {
      connectData = JSON.parse(connectText)
    } catch {
      connectData = { 
        status: connectResponse.status,
        response: connectText 
      }
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
          ai_agent_status: connectResponse.ok ? 'agent_connected' : 'agent_created',
          ai_agent_id: agentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: connectResponse.ok,
        method: 'agents_sdk',
        agent_id: agentId,
        session_id: connectData.session_id || connectData.id,
        message: connectResponse.ok ? 'AI agent connected to room' : 'Agent created but failed to connect',
        details: connectData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error creating AI agent:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to create AI agent'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})