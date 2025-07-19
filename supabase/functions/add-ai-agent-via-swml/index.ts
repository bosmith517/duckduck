// supabase/functions/add-ai-agent-via-swml/index.ts
//
// Adds AI agent to video room using SWML
//

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default SWML configuration for video AI agent
const DEFAULT_VIDEO_AGENT_SWML = {
  sections: {
    main: [
      {
        ai: {
          voice: "alloy",
          engine: "openai",
          model: "gpt-4",
          enable_vision: true,
          params: {
            name: "Alex",
            role: "AI Assistant"
          },
          context: {
            persona: "You are Alex, a helpful AI assistant in a video call.",
            greeting: "Hello! I'm Alex, your AI assistant. How can I help you today?",
            task: "Assist participants with their questions and provide helpful information.",
            rules: [
              "Be professional and friendly",
              "Pay attention to visual elements in the video",
              "Ask for clarification when needed",
              "Provide helpful and accurate information"
            ]
          }
        }
      }
    ]
  }
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

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'

    if (!projectId || !apiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log('Adding AI agent to room:', room_name)

    // Use custom SWML config or default
    const swmlConfig = agent_config || DEFAULT_VIDEO_AGENT_SWML

    // SignalWire API endpoint for creating an AI agent call
    // This will initiate a call that joins the video room
    const apiUrl = `https://${spaceUrl}/api/relay/rest/phone_numbers/+12345678900/calls`
    const auth = btoa(`${projectId}:${apiToken}`)

    // For video room AI agents, we need to use the phone call API with SWML
    const payload = {
      to: `sip:${room_name}@${spaceUrl}`,
      from: "+12345678900", // This can be any number for SIP calls
      url: "https://example.com/swml", // This would normally host the SWML
      // Alternatively, we can pass SWML inline
      swml: swmlConfig
    }

    console.log('Executing SWML for video room')

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    console.log('SWML execution response:', response.status, responseText)

    if (!response.ok) {
      throw new Error(`Failed to add AI agent: ${responseText}`)
    }

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { result: responseText }
    }

    return new Response(
      JSON.stringify({
        success: true,
        room_name: room_name,
        result: responseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error adding AI agent via SWML:', error)
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