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

    if (!aiScriptId || aiScriptId === 'YOUR_AI_SCRIPT_ID') {
      console.log('No AI script configured, skipping')
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'AI script not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    console.log('Executing AI script for room:', room_name)
    console.log('Script ID:', aiScriptId)
    console.log('Space URL:', signalwireSpaceUrl)

    // Use the correct Scripts API endpoint
    const scriptExecuteUrl = `https://${signalwireSpaceUrl}/api/scripts/${aiScriptId}/execute`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    
    // Scripts API expects different parameters
    const executePayload = {
      argument: {
        room_name: room_name,
        user_name: 'Estimator Alex'
      }
    }
    
    console.log('Execute payload:', executePayload)
    
    const executeResponse = await fetch(scriptExecuteUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(executePayload)
    })

    const responseText = await executeResponse.text()
    console.log('Script execution response:', executeResponse.status, responseText)

    if (!executeResponse.ok) {
      console.error('Script execution failed:', responseText)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to execute AI script',
          details: responseText
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 to not break the flow
        }
      )
    }

    let executeData
    try {
      executeData = JSON.parse(responseText)
    } catch {
      executeData = { response: responseText }
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
          ai_agent_status: 'script_executed',
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        script_id: aiScriptId,
        execution_result: executeData
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