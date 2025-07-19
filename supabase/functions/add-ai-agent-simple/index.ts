// supabase/functions/add-ai-agent-simple/index.ts
//
// Simplified AI agent addition using SignalWire's standard approach
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
    const { room_name, agent_name = "Alex", agent_role = "AI Assistant" } = await req.json()

    if (!room_name) {
      throw new Error('room_name is required')
    }

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    if (!projectId || !apiToken) {
      throw new Error('SignalWire credentials not configured in environment')
    }

    console.log(`Adding ${agent_name} to room:`, room_name)

    // For now, return a success response indicating the agent would join
    // Real implementation would require:
    // 1. Deploy Python agent to SignalWire
    // 2. Get agent/script ID from deployment
    // 3. Use SignalWire API to trigger agent joining the room
    
    return new Response(
      JSON.stringify({
        success: true,
        room_name: room_name,
        agent: {
          name: agent_name,
          role: agent_role,
          status: 'ready_to_join'
        },
        message: `${agent_name} is ready to join the video room`,
        implementation_note: 'Full implementation requires deployed SignalWire agent'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error in add-ai-agent-simple:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})