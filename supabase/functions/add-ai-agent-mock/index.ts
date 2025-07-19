// supabase/functions/add-ai-agent-mock/index.ts
//
// Mock version of AI agent function for testing
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
    const { room_name, agent_config } = await req.json()

    if (!room_name) {
      throw new Error('room_name is required')
    }

    console.log('Mock: Adding AI agent to room:', room_name)
    console.log('Mock: Agent config:', agent_config)

    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Mock successful response
    return new Response(
      JSON.stringify({
        success: true,
        room_name: room_name,
        result: {
          agent_id: `mock-agent-${Date.now()}`,
          status: 'joined',
          message: 'Mock AI agent successfully joined the room'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Mock error:', error)
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