// supabase/functions/execute-ai-estimator-script/index.ts
//
// Executes the AI estimator script to join a video room
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
    const { room_name, session_id, metadata } = await req.json()

    if (!room_name) {
      throw new Error('room_name is required')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    const aiScriptId = Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID')

    if (!aiScriptId) {
      throw new Error('SIGNALWIRE_AI_ESTIMATOR_ID not configured')
    }

    console.log('Executing AI script:', aiScriptId, 'for room:', room_name)

    // Execute the script using the correct API endpoint
    const scriptExecuteUrl = `https://${signalwireSpaceUrl}/api/video/scripts/${aiScriptId}/execute`
    
    const executePayload = {
      room_name: room_name,
      // Pass any metadata the script might need
      metadata: metadata || {}
    }

    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
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
      throw new Error(`Failed to execute AI script: ${responseText}`)
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
          ai_script_execution: executeData,
          updated_at: new Date().toISOString()
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        script_id: aiScriptId,
        room_name: room_name,
        execution_result: executeData,
        message: 'AI estimator script executed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error executing AI estimator script:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check that SIGNALWIRE_AI_ESTIMATOR_ID is set to your script ID and not a relay bin URL'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})