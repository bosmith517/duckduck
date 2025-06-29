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
    const { contact_id, job_id, participants, room_name } = await req.json()

    // Step 4: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 5: Create a SignalWire video room
    const roomNameGenerated = room_name || `TradeWorks-Meeting-${Date.now()}`
    const signalwireApiUrl = `https://${signalwireSpaceUrl}/api/video/rooms`
    
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const roomResponse = await fetch(signalwireApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: roomNameGenerated,
        display_name: roomNameGenerated,
        max_participants: 10
      }),
    })

    if (!roomResponse.ok) {
      const errorBody = await roomResponse.text()
      throw new Error(`SignalWire API error: ${roomResponse.status} ${errorBody}`)
    }

    const roomData = await roomResponse.json()
    
    // Step 6: Log the new video meeting to our database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: meetingRecord, error: dbError } = await supabaseAdmin
      .from('video_meetings')
      .insert({
        tenant_id: userProfile.tenant_id,
        job_id: job_id || null,
        contact_id: contact_id || null,
        created_by_user_id: user.id,
        room_url: `https://${signalwireSpaceUrl}/room/${roomData.id}`,
        room_name: roomNameGenerated,
        provider: 'SignalWire',
        start_time: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB Insert Error after creating video room:', dbError)
      throw new Error('Failed to save the new video meeting to the database.')
    }

    // Step 7: Return the newly created meeting record to the frontend
    return new Response(JSON.stringify({
      meeting: meetingRecord,
      room_data: roomData
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
