// supabase/functions/start-ai-agent/index.ts
//
// Automatically starts the AI agent when a customer joins a video session
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
    const { session_id, room_id } = await req.json()

    if (!session_id || !room_id) {
      throw new Error('session_id and room_id are required')
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Start AI agent using SignalWire AI API
    const aiAgentUrl = `https://${signalwireSpaceUrl}/api/ai/agents`
    
    const aiAgentConfig = {
      room_id: room_id,
      agent_type: 'video_estimator',
      
      // Voice configuration
      voice: {
        provider: 'elevenlabs',
        voice_id: 'rachel',
        language: 'en-US',
        speed: 1.0,
        pitch: 1.0
      },
      
      // AI behavior
      prompt: `You are a professional ${session.trade_type.toLowerCase()} estimator assistant conducting a video estimate inspection.
      
Your role is to:
1. Greet the customer warmly and explain the inspection process
2. Guide them to show specific areas based on ${session.trade_type} inspection needs
3. Ask them to use their rear camera to show the areas clearly
4. Point out any issues you notice and explain their severity
5. Request closer views when you need more detail
6. Keep the inspection moving efficiently while being thorough

Start by introducing yourself and asking them to switch to their rear camera so you can see what they're showing you.`,
      
      // Vision analysis
      enable_vision: true,
      vision_config: {
        analyze_frames: true,
        frame_interval: 1000, // Analyze every 1 second
        detect_objects: true,
        detect_text: true,
        trade_specific: session.trade_type
      },
      
      // SWAIG functions
      functions_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
      functions_auth: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      
      // Auto-join the room
      auto_join: true,
      join_as: 'AI Estimator',
      
      // Recording
      record_session: true
    }

    // Create the AI agent
    const aiResponse = await fetch(aiAgentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiAgentConfig)
    })

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text()
      console.error('SignalWire AI API error:', errorData)
      throw new Error('Failed to start AI agent')
    }

    const aiData = await aiResponse.json()
    console.log('AI agent started:', aiData)

    // Update session with AI agent info
    await supabase
      .from('video_sessions')
      .update({
        ai_agent_id: aiData.agent_id,
        ai_agent_status: 'active',
        status: 'active'
      })
      .eq('id', session_id)

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: aiData.agent_id,
        message: 'AI agent started successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error starting AI agent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})