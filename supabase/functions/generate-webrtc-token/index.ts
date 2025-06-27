import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Get SIP configuration
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: sipConfig, error: sipError } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single()

    if (sipError || !sipConfig) {
      throw new Error('No SIP configuration found. Please contact your administrator.')
    }

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Generate JWT token for WebRTC
    const now = getNumericDate(0)
    const exp = getNumericDate(3600) // 1 hour

    const payload = {
      iss: projectId,
      sub: sipConfig.sip_username,
      iat: now,
      exp: exp,
      jti: crypto.randomUUID(),
      scope: 'voice',
      // SignalWire specific claims
      resource: sipConfig.sip_username,
      domain: spaceUrl,
      sip_profile_id: sipConfig.sip_profile_id || null
    }

    // Create the JWT using the API token as the secret
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiToken),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )

    const jwt = await create({ alg: "HS256", typ: "JWT" }, payload, key)

    return new Response(JSON.stringify({
      token: jwt,
      identity: sipConfig.sip_username,
      sip: {
        username: sipConfig.sip_username,
        password: sipConfig.sip_password,
        domain: spaceUrl,
        wsServers: [`wss://${spaceUrl}:443`],
        realm: spaceUrl
      },
      webrtc: {
        stunServers: [
          { urls: 'stun:stun.signalwire.com:3478' }
        ],
        turnServers: [
          {
            urls: `turn:${spaceUrl}:3478`,
            username: sipConfig.sip_username,
            credential: sipConfig.sip_password
          }
        ]
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in generate-webrtc-token:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})