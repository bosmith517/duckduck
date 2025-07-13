// supabase/functions/debug-video-session/index.ts
//
// Debug function to check video session status and execute AI script
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
    const { session_id } = await req.json()

    if (!session_id) {
      throw new Error('session_id is required')
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

    console.log('Session found:', session)

    // Get the room details from video_meetings
    const { data: meeting, error: meetingError } = await supabase
      .from('video_meetings')
      .select('*')
      .eq('id', session.room_id)
      .single()

    console.log('Meeting found:', meeting)

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    const aiScriptId = Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID')

    const debugInfo = {
      session,
      meeting,
      signalwire: {
        hasProjectId: !!signalwireProjectId,
        hasApiToken: !!signalwireApiToken,
        spaceUrl: signalwireSpaceUrl,
        aiScriptId: aiScriptId || 'NOT_SET'
      }
    }

    // If we have the meeting and credentials, try to execute the AI script
    if (meeting?.room_id && signalwireProjectId && signalwireApiToken && aiScriptId && aiScriptId !== 'YOUR_AI_SCRIPT_ID') {
      const roomName = meeting.room_id // This is the sanitized room name
      const scriptExecuteUrl = `https://${signalwireSpaceUrl}/api/video/scripts/${aiScriptId}/execute`
      
      console.log('Executing AI script:', aiScriptId, 'for room:', roomName)
      
      const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
      const executeResponse = await fetch(scriptExecuteUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          display_name: 'Estimator Alex',
          join_params: {
            permissions: ['room.subscribe', 'room.publish']
          }
        })
      })

      const responseText = await executeResponse.text()
      debugInfo.aiExecution = {
        status: executeResponse.status,
        response: responseText
      }

      if (executeResponse.ok) {
        // Update session
        await supabase
          .from('video_sessions')
          .update({
            ai_agent_status: 'script_executed',
            updated_at: new Date().toISOString()
          })
          .eq('id', session_id)
      }
    } else {
      debugInfo.aiExecution = {
        status: 'skipped',
        reason: 'Missing credentials or meeting info'
      }
    }

    return new Response(
      JSON.stringify(debugInfo),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in debug-video-session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})