// supabase/functions/execute-ai-swml/index.ts
//
// Executes the AI estimator SWML to join a video room
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

    console.log('Executing AI SWML for room:', room_name)

    // Get the SWML configuration
    const swmlUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimator-swml?room_id=${encodeURIComponent(room_name)}`
    const swmlResponse = await fetch(swmlUrl)
    
    if (!swmlResponse.ok) {
      throw new Error('Failed to get SWML configuration')
    }
    
    const swml = await swmlResponse.json()
    console.log('SWML configuration loaded')

    // Method 1: Try using the relay bin URL if available
    if (relayBinUrl) {
      console.log('Using relay bin URL:', relayBinUrl)
      
      const relayResponse = await fetch(relayBinUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          swml: swml,
          room_name: room_name,
          metadata: {
            session_id: session_id,
            trade_type: trade_type
          }
        })
      })

      const relayResult = await relayResponse.text()
      console.log('Relay response:', relayResponse.status, relayResult)

      if (relayResponse.ok) {
        if (session_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          
          await supabase
            .from('video_sessions')
            .update({
              ai_agent_status: 'swml_executed',
              updated_at: new Date().toISOString()
            })
            .eq('id', session_id)
        }

        return new Response(
          JSON.stringify({
            success: true,
            method: 'relay_bin',
            message: 'AI SWML executed via relay bin'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    // Method 2: Try direct SWML execution
    const swmlExecuteUrl = `https://${signalwireSpaceUrl}/api/relay/rest/execute`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    const executeResponse = await fetch(swmlExecuteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        swml: swml,
        context: {
          room_id: room_name,
          session_id: session_id,
          trade_type: trade_type
        }
      })
    })

    const executeResult = await executeResponse.text()
    console.log('SWML execution response:', executeResponse.status, executeResult)

    if (!executeResponse.ok) {
      // Method 3: Try creating a call that executes the SWML
      const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls`
      
      const callResponse = await fetch(callUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `video:${room_name}@${signalwireSpaceUrl}`,
          From: 'ai-estimator',
          Url: swmlUrl,
          Method: 'POST'
        })
      })

      if (callResponse.ok) {
        const callData = await callResponse.json()
        
        if (session_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          )
          
          await supabase
            .from('video_sessions')
            .update({
              ai_agent_status: 'swml_call_initiated',
              ai_call_sid: callData.sid,
              updated_at: new Date().toISOString()
            })
            .eq('id', session_id)
        }

        return new Response(
          JSON.stringify({
            success: true,
            method: 'call_with_swml',
            call_sid: callData.sid,
            message: 'AI SWML call initiated'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    let executeData
    try {
      executeData = JSON.parse(executeResult)
    } catch {
      executeData = { response: executeResult }
    }

    // Update session if provided
    if (session_id && executeResponse.ok) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('video_sessions')
        .update({
          ai_agent_status: 'swml_executed',
          ai_swml_response: executeData,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: executeResponse.ok,
        method: 'direct_swml',
        execution_result: executeData,
        message: executeResponse.ok ? 'AI SWML executed successfully' : 'Failed to execute SWML'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error executing AI SWML:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to execute AI SWML'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})