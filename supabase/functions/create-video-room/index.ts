// supabase/functions/create-video-room/index.ts
//
// This Edge Function securely creates a video conference room via Daily.co
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
    // Step 1: Securely retrieve the Daily.co API key
    const dailyApiKey = Deno.env.get('DAILY_API_KEY')

    if (!dailyApiKey) {
      throw new Error('Server configuration error: Missing Daily.co API key.')
    }

    // Step 2: Get parameters from the frontend request
    const { tenantId, createdByUserId, jobId } = await req.json()
    if (!tenantId || !createdByUserId) {
      throw new Error('Missing required parameters: tenantId or createdByUserId.')
    }

    // Step 3: Call the Daily.co API to create a new private room
    const dailyApiUrl = 'https://api.daily.co/v1/rooms'
    const roomResponse = await fetch(dailyApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json',
      },
      // Setting privacy to 'private' is recommended for one-on-one or sensitive meetings
      body: JSON.stringify({
        privacy: 'private',
        properties: {
            // Room will expire 1 hour after the last participant leaves
            exp: Math.floor(Date.now() / 1000) + 3600, 
        },
      }),
    })

    if (!roomResponse.ok) {
      const errorBody = await roomResponse.json()
      throw new Error(`Daily.co API error: ${errorBody.error}: ${errorBody.info}`)
    }

    const roomData = await roomResponse.json()
    
    // Step 4: Log the new video meeting to our own database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: meetingRecord, error: dbError } = await supabaseClient
      .from('video_meetings')
      .insert({
        tenant_id: tenantId,
        job_id: jobId, // Can be null
        created_by_user_id: createdByUserId,
        room_url: roomData.url, // The unique URL for the new room
        provider: 'Daily.co',
        start_time: new Date(roomData.created_at).toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB Insert Error after creating video room:', dbError)
      throw new Error('Failed to save the new video meeting to the database.')
    }

    // Step 5: Return the newly created meeting record to the frontend
    return new Response(JSON.stringify(meetingRecord), {
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
