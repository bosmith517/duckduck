// supabase/functions/add-ai-agent-to-video/index.ts
//
// Adds AI agent directly to video room using SignalWire Agents API
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

    console.log('Adding AI agent to video room:', room_name)

    // Create the agent using SignalWire Agents API
    const agentData = {
      name: "AI Estimator Alex",
      type: "video_room",
      topics: ["lead_qualification", "damage_assessment", "estimation"],
      instructions: `You are Alex, an AI ${trade_type?.toLowerCase() || 'home services'} estimation assistant.

You are joining a video estimation session to help analyze and document issues.

Your role is to:
1. Greet the customer warmly and introduce yourself
2. Ask them to use their phone's rear camera for better video quality
3. Guide them through showing different areas that need ${trade_type} service
4. Analyze what you see and point out any issues you observe
5. Explain the severity of issues you identify
6. Ask for closer views or different angles when needed
7. Keep the inspection moving efficiently while being thorough
8. Document everything for the estimate

Important guidelines:
- Be professional, friendly, and patient
- Speak clearly and avoid technical jargon
- When you see an issue, describe it clearly: "I can see [issue] on the [location]"
- If you can't see something clearly, ask them to move the camera closer or adjust the lighting
- Acknowledge what you see before asking them to show the next area
- Thank them for their time when finishing

Start by greeting them and asking them to switch to their rear camera for better quality.`,
      
      tools: [
        {
          type: "function",
          function: {
            name: "capture_issue",
            description: "Document an issue found during inspection",
            parameters: {
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
                },
                visual_details: {
                  type: "string",
                  description: "What was observed in the video"
                }
              },
              required: ["description", "severity", "location"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "request_view",
            description: "Ask customer to show a specific area or angle",
            parameters: {
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
          }
        },
        {
          type: "function",
          function: {
            name: "complete_inspection",
            description: "Mark the video inspection as complete",
            parameters: {
              type: "object",
              properties: {
                summary: {
                  type: "string",
                  description: "Summary of all issues found"
                },
                estimated_severity: {
                  type: "string",
                  enum: ["minor_repairs", "moderate_work", "major_project", "emergency"],
                  description: "Overall assessment of work needed"
                },
                next_steps: {
                  type: "string",
                  description: "Recommended next steps"
                }
              },
              required: ["summary", "estimated_severity"]
            }
          }
        }
      ],
      
      metadata: {
        session_id: session_id,
        trade_type: trade_type,
        room_name: room_name
      }
    }

    // Create the agent using the Agents API
    const createAgentUrl = `https://${signalwireSpaceUrl}/api/agents`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    const createResponse = await fetch(createAgentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData)
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('Failed to create agent:', errorText)
      throw new Error(`Failed to create agent: ${createResponse.status}`)
    }

    const agent = await createResponse.json()
    console.log('Agent created:', agent.id)

    // Now connect the agent to the video room
    const connectUrl = `https://${signalwireSpaceUrl}/api/agents/${agent.id}/connect`
    
    const connectData = {
      type: "video_room",
      room_name: room_name,
      display_name: "AI Estimator Alex",
      video: true,
      audio: true,
      vision_enabled: true
    }
    
    const connectResponse = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(connectData)
    })

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text()
      console.error('Failed to connect agent to room:', errorText)
      
      // Try cleanup - delete the agent
      await fetch(`https://${signalwireSpaceUrl}/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${auth}` }
      })
      
      throw new Error(`Failed to connect agent to room: ${connectResponse.status}`)
    }

    const connectionData = await connectResponse.json()
    console.log('Agent connected to room:', connectionData)

    // Update session if provided
    if (session_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('video_sessions')
        .update({
          ai_agent_id: agent.id,
          ai_agent_status: 'connected',
          ai_connection_id: connectionData.connection_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agent.id,
        connection_id: connectionData.connection_id,
        message: 'AI agent successfully connected to video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error adding AI agent to video:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to add AI agent to video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})