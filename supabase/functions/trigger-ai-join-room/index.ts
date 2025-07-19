// supabase/functions/trigger-ai-join-room/index.ts
//
// Triggers the AI to join a video room via webhook or LaML
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
    
    // AI configuration from environment
    const aiPhoneNumber = Deno.env.get('SIGNALWIRE_AI_PHONE_NUMBER') // e.g., +1234567890
    const aiRelayBinUrl = Deno.env.get('SIGNALWIRE_AI_RELAY_BIN_URL')
    const aiAgentSwaigUrl = Deno.env.get('SIGNALWIRE_AI_SWAIG_URL')

    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log('Triggering AI to join room:', room_name)
    
    // Method 1: If we have an AI phone number, make an outbound call to connect it to the room
    if (aiPhoneNumber) {
      const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls`
      
      // Create LaML that will connect the AI to the video room
      const lamlUrl = aiRelayBinUrl || `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-video-laml`
      
      const callPayload = {
        To: aiPhoneNumber,
        From: '+15559991234', // A valid SignalWire number or verified caller ID
        Url: lamlUrl,
        Method: 'POST',
        StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-call-status`,
        StatusCallbackMethod: 'POST'
      }
      
      const formData = new URLSearchParams(callPayload)
      
      const callResponse = await fetch(callUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      })
      
      if (callResponse.ok) {
        const callData = await callResponse.json()
        console.log('Outbound call initiated:', callData.sid)
        
        // Store the call SID in the session
        if (session_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          
          await supabase
            .from('video_sessions')
            .update({
              ai_call_sid: callData.sid,
              ai_agent_status: 'calling',
              metadata: {
                ...{},
                ai_trigger_method: 'outbound_call',
                room_name_for_ai: room_name
              }
            })
            .eq('id', session_id)
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            method: 'outbound_call',
            call_sid: callData.sid,
            message: 'AI is being called to join the room'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }
    
    // Method 2: Trigger via webhook if configured
    if (aiAgentSwaigUrl) {
      const webhookResponse = await fetch(aiAgentSwaigUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('WEBHOOK_SECRET')}`,
        },
        body: JSON.stringify({
          action: 'join_video_room',
          room_name: room_name,
          trade_type: trade_type,
          session_id: session_id,
          display_name: 'AI Estimator Alex'
        })
      })
      
      if (webhookResponse.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            method: 'webhook',
            message: 'AI agent webhook triggered'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }
    
    // Method 3: Return room details for manual connection
    return new Response(
      JSON.stringify({
        success: true,
        method: 'manual',
        message: 'AI connection details provided',
        connection_info: {
          room_name: room_name,
          sip_uri: `sip:${room_name}@${signalwireSpaceUrl}`,
          note: 'Configure your AI agent to connect to this SIP URI'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error triggering AI join:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to trigger AI to join room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})