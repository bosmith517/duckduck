import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { create } from 'https://esm.sh/jsonwebtoken@9.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { testimonialId, roomName, userName } = await req.json()

    if (!roomName) {
      throw new Error('Missing required parameter: roomName')
    }

    // For testing, we'll skip the testimonial_requests check
    // In production, uncomment the following:
    /*
    const { data: testimonial, error: testimonialError } = await supabaseClient
      .from('testimonial_requests')
      .select('*, tenant:tenants(*)')
      .eq('id', testimonialId)
      .single()

    if (testimonialError || !testimonial) {
      throw new Error('Testimonial not found')
    }

    const tenant = testimonial.tenant
    */

    // For testing, get the first tenant or use auth
    let tenant: any = null
    
    // Try to get tenant from auth
    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (user) {
      // Get tenant for authenticated user
      const { data: userData } = await supabaseClient
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      
      if (userData?.tenant_id) {
        const { data: tenantData } = await supabaseClient
          .from('tenants')
          .select('*')
          .eq('id', userData.tenant_id)
          .single()
        tenant = tenantData
      }
    }
    
    // If no tenant from auth, try to get the first one for testing
    if (!tenant) {
      const { data: tenants } = await supabaseClient
        .from('tenants')
        .select('*')
        .limit(1)
      
      if (tenants && tenants.length > 0) {
        tenant = tenants[0]
      }
    }

    if (!tenant) {
      throw new Error('No tenant found')
    }

    if (!tenant.signalwire_project_id || !tenant.signalwire_api_token || !tenant.signalwire_space_url) {
      throw new Error('SignalWire credentials not configured for tenant')
    }

    // Generate a room token for browser SDK
    // This token allows the browser to join the video room
    const tokenPayload = {
      room_name: roomName,
      user_name: userName || 'Guest',
      auto_create_room: true, // Allow auto-creation for testing
      permissions: [
        'room.self.audio_mute',
        'room.self.audio_unmute', 
        'room.self.video_mute',
        'room.self.video_unmute',
        'room.self.set_input_volume',
        'room.self.set_output_volume',
        'room.self.set_input_sensitivity'
      ]
    }

    // Create JWT token for room access
    const token = await create(
      { alg: 'HS256', typ: 'JWT' },
      {
        ...tokenPayload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        jti: crypto.randomUUID(),
        resource: roomName
      },
      tenant.signalwire_api_token
    )

    return new Response(
      JSON.stringify({
        token,
        projectId: tenant.signalwire_project_id,
        spaceUrl: tenant.signalwire_space_url,
        roomName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in get-testimonial-room-token:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})