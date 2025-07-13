// supabase/functions/create-video-estimating-session/index.ts
//
// This Edge Function creates an AI-powered video estimating session using SignalWire
// with vision capabilities for trade-specific analysis
//

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Trade-specific AI prompts for vision analysis
const TRADE_PROMPTS = {
  ROOFING: {
    focus_areas: ['shingles', 'flashing', 'gutters', 'vents', 'chimney', 'valleys'],
    detection_types: ['damage', 'wear', 'missing_shingles', 'water_stains', 'moss', 'debris'],
    measurement_hints: ['roof_pitch', 'square_footage', 'ridge_length']
  },
  PLUMBING: {
    focus_areas: ['pipes', 'fixtures', 'water_heater', 'shut_off_valves', 'drainage'],
    detection_types: ['leaks', 'corrosion', 'water_damage', 'outdated_fixtures'],
    measurement_hints: ['pipe_diameter', 'fixture_count']
  },
  HVAC: {
    focus_areas: ['unit_labels', 'ductwork', 'vents', 'thermostat', 'filters'],
    detection_types: ['rust', 'damage', 'age_indicators', 'efficiency_rating'],
    measurement_hints: ['unit_tonnage', 'duct_size']
  },
  ELECTRICAL: {
    focus_areas: ['panel', 'outlets', 'switches', 'wiring_visible', 'fixtures'],
    detection_types: ['outdated_components', 'code_violations', 'burn_marks', 'exposed_wiring'],
    measurement_hints: ['panel_amperage', 'circuit_count']
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate the user
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

    // Get user's tenant information
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Get parameters from request
    const { 
      lead_id,
      contact_id,
      account_id,
      trade_type,
      scheduled_at,
      customer_phone,
      notes
    } = await req.json()

    if (!trade_type || !TRADE_PROMPTS[trade_type]) {
      throw new Error('Valid trade type is required')
    }

    // SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Create room with AI vision configuration
    const roomName = `AI-Estimate-${trade_type}-${Date.now()}`
    const signalwireApiUrl = `https://${signalwireSpaceUrl}/api/video/rooms`
    
    const roomConfig = {
      name: roomName,
      display_name: `${trade_type} Estimate Session`,
      max_participants: 5,
      quality: 'high',
      layout: 'grid-responsive',
      enable_recording: true,
      
      // SWML-style configuration for AI vision
      ai_config: {
        enable_vision: true,
        enable_transcription: true,
        
        // Vision processing configuration
        vision: {
          fps: 1, // Capture frame every second
          quality: 'high',
          enable_object_detection: true,
          enable_text_recognition: true,
          
          // Trade-specific detection
          custom_labels: TRADE_PROMPTS[trade_type].detection_types,
          focus_areas: TRADE_PROMPTS[trade_type].focus_areas,
          
          // Confidence thresholds
          detection_confidence: 0.6,
          text_confidence: 0.7
        },
        
        // AI assistant configuration
        assistant: {
          personality: `You are a professional ${trade_type.toLowerCase()} estimator assistant. Guide the customer to show specific areas and provide expert analysis.`,
          
          instructions: [
            `Focus on ${TRADE_PROMPTS[trade_type].focus_areas.join(', ')}`,
            'Guide customer to show problem areas clearly',
            'Ask for close-ups when detecting issues',
            'Mention when lighting or angle needs adjustment',
            `Look for ${TRADE_PROMPTS[trade_type].detection_types.join(', ')}`
          ].join('. '),
          
          temperature: 0.3, // Lower temperature for consistent guidance
          enable_interruption: true
        }
      },
      
      // Webhook for frame processing
      webhooks: {
        room_started: `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-estimating-frame`,
        room_ended: `${Deno.env.get('SUPABASE_URL')}/functions/v1/finalize-video-estimate`,
        participant_joined: `${Deno.env.get('SUPABASE_URL')}/functions/v1/log-participant-event`,
        frame_ready: `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-estimating-frame`
      },
      
      // Session metadata
      metadata: {
        tenant_id: userProfile.tenant_id,
        trade_type,
        lead_id,
        contact_id,
        account_id,
        created_by: user.id,
        timestamp: new Date().toISOString()
      }
    }
    
    // Create the room
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
      console.error('SignalWire room creation failed:', errorBody)
      throw new Error(`Failed to create video room: ${roomResponse.status}`)
    }

    const roomData = await roomResponse.json()
    console.log('SignalWire room created:', roomData.id)

    // Create video session record
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('video_sessions')
      .insert({
        tenant_id: userProfile.tenant_id,
        lead_id,
        contact_id,
        account_id,
        trade_type,
        room_id: roomData.id,
        room_url: roomData.url || `https://${signalwireSpaceUrl}/room/${roomData.id}`,
        status: scheduled_at ? 'scheduled' : 'active',
        scheduled_at,
        notes,
        metadata: {
          room_name: roomName,
          ai_enabled: true,
          vision_config: roomConfig.ai_config.vision,
          signalwire_room_id: roomData.id
        }
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Failed to save session:', sessionError)
      throw new Error('Failed to save video session')
    }

    // Generate tokens for participants
    const agentToken = await generateParticipantToken(
      roomData.id,
      'Agent',
      ['room.self.audio_mute', 'room.self.audio_unmute', 'room.self.video_mute', 'room.self.video_unmute', 'room.member.remove', 'room.recording.start', 'room.recording.stop'],
      signalwireProjectId,
      signalwireApiToken
    )

    const customerToken = await generateParticipantToken(
      roomData.id,
      'Customer',
      ['room.self.audio_mute', 'room.self.audio_unmute', 'room.self.video_mute', 'room.self.video_unmute'],
      signalwireProjectId,
      signalwireApiToken
    )

    // Create magic link for customer
    const customerLink = `${Deno.env.get('PUBLIC_URL')}/video-estimate/${session.id}?token=${customerToken}`

    // Send invitation if phone number provided
    if (customer_phone && !scheduled_at) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: customer_phone,
          message: `Your ${trade_type.toLowerCase()} video estimate session is ready! Join here: ${customerLink}`,
          tenant_id: userProfile.tenant_id
        }
      })
    }

    return new Response(JSON.stringify({
      session,
      room_data: {
        id: roomData.id,
        url: roomData.url,
        agent_token: agentToken,
        customer_link: customerLink
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-video-estimating-session:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create video estimating session' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to generate participant tokens
async function generateParticipantToken(
  roomId: string,
  userName: string,
  permissions: string[],
  projectId: string,
  apiToken: string
): Promise<string> {
  // In production, this would call SignalWire's token generation endpoint
  // For now, return a placeholder
  return `${roomId}_${userName}_${Date.now()}`
}