// supabase/functions/add-ai-to-video-room/index.ts
//
// Adds AI estimator to an existing video room by executing the script
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

    // SignalWire credentials - using the same pattern as create-video-room
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    const aiScriptId = Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID')

    if (!signalwireProjectId || !signalwireApiToken) {
      console.error('SignalWire credentials missing')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'SignalWire not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to not break the flow
        }
      )
    }

    // Always try to add AI using SWML execution
    console.log('Executing AI SWML for room:', room_name)
    
    // Get the SWML configuration
    const swmlUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimator-swml?room_id=${encodeURIComponent(room_name)}`
    const swmlResponse = await fetch(swmlUrl)
    
    if (!swmlResponse.ok) {
      console.error('Failed to get SWML configuration')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to get SWML configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to not break the flow
        }
      )
    }
    
    const swml = await swmlResponse.json()
    console.log('SWML configuration loaded')
    
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    // Try Method 1: Direct SWML execution
    const swmlExecuteUrl = `https://${signalwireSpaceUrl}/api/relay/rest/execute`
    
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
      // Method 2: Try creating a call that executes the SWML
      console.log('Direct execution failed, trying call method...')
      
      const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls`
      
      const callResponse = await fetch(callUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `sip:${room_name}@${signalwireSpaceUrl}`,
          From: 'ai-estimator',
          Url: swmlUrl,
          Method: 'GET'
        })
      })
      
      if (callResponse.ok) {
        const callData = await callResponse.json()
        console.log('AI call initiated successfully:', callData.sid)
        
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
            message: 'AI agent joining room via SWML call'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } else {
        const callError = await callResponse.text()
        console.error('Call creation failed:', callError)
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
        message: executeResponse.ok ? 'AI agent joining room' : 'AI agent will join shortly'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error adding AI to room:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 to not break the flow
      }
    )
  }
})