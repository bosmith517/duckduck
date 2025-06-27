// supabase/functions/get-technician-location/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This client can use the ANONYMOUS key because it's only reading public data
// and we will control access via Row Level Security.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // We get the token from a URL query parameter like /api/get-technician-location?token=...
    const url = new URL(req.url)
    const tracking_token = url.searchParams.get('token')


    if (!tracking_token) {
      throw new Error('Tracking token is required.')
    }

    const { data, error } = await supabase
      .from('job_technician_locations')
      .select('latitude, longitude, expires_at')
      .eq('tracking_token', tracking_token)
      .single()

    if (error) throw new Error("Invalid or expired tracking link.")

    // Check if the link has expired
    if (new Date(data.expires_at) < new Date()) {
      throw new Error("Tracking link has expired.")
    }

    return new Response(JSON.stringify({
        latitude: data.latitude,
        longitude: data.longitude
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404, // Use 404 for not found/expired links
    })
  }
})