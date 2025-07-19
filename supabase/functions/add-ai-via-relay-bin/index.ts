// supabase/functions/add-ai-via-relay-bin/index.ts
//
// Adds AI to video room using the relay bin approach
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
    const relayBinUrl = Deno.env.get('SIGNALWIRE_AI_RELAY_BIN_URL')
    
    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    if (!relayBinUrl) {
      throw new Error('SIGNALWIRE_AI_RELAY_BIN_URL not configured')
    }

    console.log('Using relay bin to add AI to room:', room_name)
    console.log('Relay bin URL:', relayBinUrl)

    // Trigger the relay bin with room information
    const relayResponse = await fetch(relayBinUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room_name: room_name,
        display_name: 'AI Estimator Alex',
        trade_type: trade_type || 'general',
        session_id: session_id,
        action: 'join_video_room',
        metadata: {
          role: 'ai_estimator',
          vision_enabled: true,
          timestamp: new Date().toISOString()
        }
      })
    })

    const responseText = await relayResponse.text()
    console.log('Relay bin response:', relayResponse.status, responseText)

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      // If not JSON, wrap the response
      responseData = { 
        status: relayResponse.status,
        response: responseText 
      }
    }

    if (!relayResponse.ok) {
      console.error('Relay bin execution failed:', responseData)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to trigger AI via relay bin',
          details: responseData
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
          ai_agent_status: 'relay_triggered',
          ai_relay_response: responseData,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        method: 'relay_bin',
        relay_url: relayBinUrl,
        response: responseData,
        message: 'AI relay bin triggered successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error triggering AI relay bin:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to trigger AI via relay bin'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})