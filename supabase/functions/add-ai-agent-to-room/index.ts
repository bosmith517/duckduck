// supabase/functions/add-ai-agent-to-room/index.ts
//
// Adds the AI vision agent to an existing video room
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
    const { room_id, session_id } = await req.json()

    if (!room_id) {
      throw new Error('room_id is required')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    const aiAgentId = Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID') || 'YOUR_AI_AGENT_ID'

    // Method 1: Try to add agent to room via API
    const addAgentUrl = `https://${signalwireSpaceUrl}/api/video/rooms/${room_id}/members`
    
    const addAgentPayload = {
      agent_id: aiAgentId,
      display_name: 'AI Estimator Alex',
      permissions: [
        'room.self.audio_mute',
        'room.self.audio_unmute',
        'room.self.video_mute',
        'room.self.video_unmute',
        'room.subscribe',
        'room.publish'
      ]
    }

    console.log('Adding AI agent to room:', room_id)
    
    const response = await fetch(addAgentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(addAgentPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to add agent via members API:', errorText)
      
      // Method 2: Try room update API
      const updateRoomUrl = `https://${signalwireSpaceUrl}/api/video/rooms/${room_id}`
      const updateResponse = await fetch(updateRoomUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          join_agents: [{
            agent_id: aiAgentId,
            display_name: 'AI Estimator Alex',
            auto_join: true
          }]
        })
      })
      
      if (!updateResponse.ok) {
        const updateError = await updateResponse.text()
        console.error('Failed to add agent via room update:', updateError)
        
        // Method 3: Create an outbound call to connect the agent
        console.log('Trying outbound call method...')
        
        const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls`
        
        // Get configured phone number or use default
        const aiPhoneNumber = Deno.env.get('SIGNALWIRE_AI_PHONE_NUMBER') || '+15559991234'
        const fromNumber = Deno.env.get('SIGNALWIRE_FROM_NUMBER') || aiPhoneNumber
        
        // Use our SWML endpoint
        const swmlUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-video-swml?room=${encodeURIComponent(room_id)}`
        
        const callPayload = {
          To: aiPhoneNumber,
          From: fromNumber,
          Url: swmlUrl,
          Method: 'POST',
          StatusCallback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-call-status`,
          StatusCallbackMethod: 'POST'
        }
        
        const callResponse = await fetch(callUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${signalwireProjectId}:${signalwireApiToken}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(callPayload)
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
                ai_agent_status: 'connecting',
                ai_call_sid: callData.sid
              })
              .eq('id', session_id)
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              method: 'outbound_call',
              call_sid: callData.sid,
              message: 'AI agent is connecting via call'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          )
        }
        
        throw new Error('All methods to add agent failed')
      }
      
      // Room update succeeded
      return new Response(
        JSON.stringify({
          success: true,
          method: 'room_update',
          message: 'AI agent added to room configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Direct member add succeeded
    const data = await response.json()
    
    if (session_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabase
        .from('video_sessions')
        .update({
          ai_agent_status: 'joined',
          ai_member_id: data.member_id
        })
        .eq('id', session_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        method: 'direct_add',
        member_id: data.member_id,
        message: 'AI agent added successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error adding AI agent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})