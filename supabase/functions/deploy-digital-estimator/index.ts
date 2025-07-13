// supabase/functions/deploy-digital-estimator/index.ts
//
// Deploys a SignalWire Digital Employee for video estimating
//

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SWML template embedded (since Edge Functions can't read files)
const SWML_TEMPLATE = `version: "1.0.0"
sections:
  main:
    - ai:
        voice: "polly.Matthew"
        engine: "gcloud"
        prompt:
          role: "system"
          text: |
            You are Alex, a professional trade estimator for TradeWorks Pro conducting a video estimate.
            
            Be friendly, professional, and guide the customer to show you areas using their phone's rear camera.
            - Start by greeting them and asking what service they need
            - Guide them systematically through the inspection
            - Point out issues you observe and explain severity
            - Ask for closer views when needed
            - Keep the inspection to 10-15 minutes
            
            Always be specific about camera angles and lighting.
        
        post_prompt:
          role: "assistant"
          text: "Thank you for the tour. I've documented everything. You'll receive your detailed estimate within 24 hours."
        
        params:
          temperature: 0.7
          top_p: 0.9`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, room_id, trade_type, room_token } = await req.json()

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

    // Method 1: Try using SignalWire's AI Agent API (if available)
    try {
      const aiAgentUrl = `https://${signalwireSpaceUrl}/api/ai/agents/create`
      
      const aiAgentPayload = {
        name: `estimator_${session_id}`,
        swml_url: `data:text/yaml;base64,${btoa(SWML_TEMPLATE)}`,
        phone_number: "+19999999999", // Virtual number
        metadata: {
          session_id,
          room_id,
          trade_type: trade_type || session.trade_type,
          room_token
        },
        auto_answer: true,
        record_calls: true
      }

      const aiResponse = await fetch(aiAgentUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(aiAgentPayload)
      })

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        
        // Now trigger the agent to join the video room
        const connectUrl = `https://${signalwireSpaceUrl}/api/ai/agents/${aiData.id}/connect`
        const connectResponse = await fetch(connectUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: `sip:${room_id}@${signalwireSpaceUrl}`,
            metadata: { room_token }
          })
        })

        if (connectResponse.ok) {
          await supabase
            .from('video_sessions')
            .update({
              ai_agent_id: aiData.id,
              ai_agent_status: 'connected',
              status: 'active'
            })
            .eq('id', session_id)

          return new Response(
            JSON.stringify({
              success: true,
              method: 'ai_agent',
              agent_id: aiData.id,
              message: 'Digital employee deployed successfully'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
      }
    } catch (aiError) {
      console.log('AI Agent API not available, trying fallback method:', aiError)
    }

    // Method 2: Fallback - Create an outbound call with SWML
    const callUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/calls`
    
    // Customize SWML with session data
    const customSWML = SWML_TEMPLATE
      .replace('${session_id}', session_id)
      .replace('${trade_type}', trade_type || session.trade_type || 'general')
      .replace('${env.SUPABASE_URL}', Deno.env.get('SUPABASE_URL')!)
      .replace('${env.SUPABASE_ANON_KEY}', Deno.env.get('SUPABASE_ANON_KEY')!)

    const callPayload = {
      to: `sip:${room_id}@${signalwireSpaceUrl}`,
      from: "+19999999999",
      url: `data:application/x-yaml;base64,${btoa(customSWML)}`,
      method: "POST",
      timeout: 30,
      status_callback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-call-status`,
      status_callback_method: "POST"
    }

    const callResponse = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(callPayload)
    })

    if (!callResponse.ok) {
      const errorText = await callResponse.text()
      console.error('Call API error:', errorText)
      
      // Method 3: Final fallback - provide connection info for manual agent
      const agentInfo = {
        room_id,
        room_token: room_token || session.signalwire_token,
        swml_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/swml/estimator-${session_id}.yaml`,
        instructions: 'Use SignalWire Studio to connect the digital employee'
      }

      // Store SWML for manual deployment
      await supabase.storage
        .from('swml')
        .upload(`estimator-${session_id}.yaml`, customSWML, {
          contentType: 'text/yaml',
          upsert: true
        })

      await supabase
        .from('video_sessions')
        .update({
          ai_agent_config: agentInfo,
          ai_agent_status: 'manual_required',
          status: 'active'
        })
        .eq('id', session_id)

      return new Response(
        JSON.stringify({
          success: true,
          method: 'manual',
          agent_config: agentInfo,
          message: 'Digital employee config ready for manual deployment'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const callData = await callResponse.json()
    
    // Update session with call info
    await supabase
      .from('video_sessions')
      .update({
        ai_call_id: callData.sid,
        ai_agent_status: 'calling',
        status: 'active'
      })
      .eq('id', session_id)

    return new Response(
      JSON.stringify({
        success: true,
        method: 'outbound_call',
        call_id: callData.sid,
        message: 'Digital employee is calling into the session'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error deploying digital estimator:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})