// supabase/functions/ai-join-video-via-call/index.ts
//
// Makes an outbound call to join AI to video room using SWML
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
    const { room_name, session_id } = await req.json()

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

    console.log('Making outbound call to join AI to room:', room_name)

    // Create the SWML URL for this specific room
    const swmlUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/swml-service?script=ai-estimator&room_id=${encodeURIComponent(room_name)}`
    
    // Make outbound call using SignalWire API
    const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls.json`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    const callParams = new URLSearchParams({
      To: room_name, // Just the room name, SignalWire will handle it
      From: 'ai-estimator',
      Url: swmlUrl,
      Method: 'POST',
      StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-call-status`,
      StatusCallbackMethod: 'POST'
    })

    console.log('Call parameters:', {
      url: callUrl,
      swmlUrl: swmlUrl,
      to: room_name
    })

    const response = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: callParams
    })

    const responseText = await response.text()
    console.log('Call API response:', response.status, responseText)

    let callData
    try {
      callData = JSON.parse(responseText)
    } catch {
      // If not JSON, it might be XML (SignalWire returns XML for some endpoints)
      callData = { 
        status: response.status,
        response: responseText 
      }
    }

    if (!response.ok) {
      console.error('Failed to make outbound call:', callData)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to initiate call',
          details: callData
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
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
          ai_agent_status: 'call_initiated',
          ai_call_sid: callData.sid || callData.call_sid,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        method: 'outbound_call_with_swml',
        call_sid: callData.sid || callData.call_sid,
        call_status: callData.status,
        message: 'AI call initiated to join video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error initiating AI call:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to initiate AI call to video room'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})