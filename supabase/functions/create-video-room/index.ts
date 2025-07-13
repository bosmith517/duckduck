// supabase/functions/create-video-room/index.ts
//
// This Edge Function securely creates a video conference room via SignalWire
// and logs the meeting to the database.
//

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    // Step 1: Authenticate the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Step 2: Get user's tenant information
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Step 3: Get parameters from the frontend request
    const { 
      contact_id, 
      job_id, 
      participants, 
      room_name, 
      trade_type, 
      max_participants = 10, 
      enable_recording = false,
      enable_vision = false 
    } = await req.json()

    // Step 4: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 5: Create a SignalWire video room with valid configuration
    // Room name must be alphanumeric with hyphens/underscores only and UNIQUE
    const randomId = Math.random().toString(36).substring(2, 8) // Add 6 random chars
    const timestamp = Date.now()
    const baseRoomName = room_name || (trade_type ? `Video_Estimate_${trade_type}` : `TradeWorks_Meeting`)
    const sanitizedRoomName = `${baseRoomName}_${timestamp}_${randomId}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 120) // SignalWire has a max length limit
    
    const signalwireApiUrl = `https://${signalwireSpaceUrl}/api/video/rooms`
    
    // Base room configuration with valid SignalWire parameters
    const roomConfig: any = {
      name: sanitizedRoomName,
      display_name: room_name || `${trade_type || 'Video'} Meeting`,
      max_participants,
      enable_recording
      // Remove invalid parameters: quality, layout
    }

    // Add metadata for video estimating (SignalWire doesn't support ai_params directly)
    if (enable_vision || trade_type) {
      // Store our custom metadata separately
      roomConfig.metadata = JSON.stringify({
        enable_vision: true,
        trade_type: trade_type || 'general',
        session_type: 'video_estimating',
        tenant_id: userProfile.tenant_id,
        created_at: new Date().toISOString()
      })
    }
    
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const roomResponse = await fetch(signalwireApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(roomConfig),
    })

    if (!roomResponse.ok) {
      const errorBody = await roomResponse.text()
      throw new Error(`SignalWire API error: ${roomResponse.status} ${errorBody}`)
    }

    const roomData = await roomResponse.json()
    
    // Step 6: Create meeting record without database dependency
    const meetingRecord = {
      id: roomData.id,
      room_id: sanitizedRoomName, // Store the actual room name for token generation
      tenant_id: userProfile.tenant_id,
      job_id: job_id || null,
      contact_id: contact_id || null,
      created_by_user_id: user.id,
      room_url: roomData.url || `https://${signalwireSpaceUrl}/room/${roomData.id}`,
      room_name: roomConfig.display_name,
      provider: 'SignalWire',
      start_time: new Date().toISOString(),
      // Add extra fields for video estimating
      trade_type: trade_type || null,
      enable_vision: enable_vision || false
    }
    
    // Try to log to video_meetings table if it exists, but don't fail if it doesn't
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabaseAdmin
        .from('video_meetings')
        .insert(meetingRecord)
      
      console.log('Meeting logged to database')
    } catch (dbError) {
      console.warn('Could not log to video_meetings table:', dbError)
      // Continue without database logging
    }

    // Step 7: Add AI agent to room if vision is enabled
    let aiAgentData = null
    if (enable_vision && trade_type) {
      try {
        // Generate AI agent token with SWML capabilities
        const aiResponse = await fetch(`https://${signalwireSpaceUrl}/api/video/room_tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room_name: sanitizedRoomName,
            user_name: `AI_Estimator_${trade_type}`,
            permissions: ['room.self.audio_mute', 'room.self.audio_unmute'],
            // Add SWML configuration for AI agent
            swml_config: {
              version: "1.0.0",
              sections: {
                main: [
                  {
                    ai: {
                      prompt: {
                        text: `You are a professional ${trade_type.toLowerCase()} estimator assistant. You will analyze video frames to identify potential issues and provide guidance during this video estimate session. Focus on detecting: structural damage, equipment condition, safety concerns, and maintenance needs. Provide clear, professional observations and ask relevant follow-up questions.`
                      },
                      params: {
                        temperature: 0.3,
                        top_p: 0.7
                      },
                      post_prompt: {
                        vision: {
                          enabled: true,
                          frames_per_second: 1
                        }
                      },
                      SWAIG: {
                        defaults: {
                          web_hook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-estimating-webhook`,
                          web_hook_auth_user: "signalwire",
                          web_hook_auth_password: Deno.env.get('SWML_WEBHOOK_PASSWORD') || 'secure123'
                        },
                        functions: [
                          {
                            function: "capture_critical_frame",
                            description: "Capture and analyze an important frame for the estimate"
                          },
                          {
                            function: "add_estimate_item", 
                            description: "Add an item to the estimate based on visual inspection"
                          },
                          {
                            function: "request_closer_look",
                            description: "Ask the customer to show a specific area in more detail"
                          }
                        ]
                      },
                      languages: [
                        {
                          code: "en-US",
                          voice: "rachel",
                          name: "Rachel",
                          gender: "female"
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }),
        })

        if (aiResponse.ok) {
          aiAgentData = await aiResponse.json()
          console.log('AI agent added to room successfully')
        } else {
          console.warn('Failed to add AI agent to room:', await aiResponse.text())
        }
      } catch (aiError) {
        console.warn('Error adding AI agent:', aiError)
        // Continue without AI agent
      }
    }

    // Step 8: Return the newly created meeting record to the frontend
    return new Response(JSON.stringify({
      meeting: meetingRecord,
      room_data: roomData,
      ai_agent: aiAgentData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-video-room function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
