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

    // Get user profile and tenant
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only admins can create SIP endpoints
    if (!['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions')
    }

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Create a unique SIP username for this user
    const sipUsername = `user_${user.id.substring(0, 8)}_${Date.now()}`
    const sipPassword = crypto.randomUUID()

    // First, get or create a SIP profile
    const profilesUrl = `https://${spaceUrl}/api/relay/rest/sip_profiles`
    const auth = `Basic ${btoa(`${projectId}:${apiToken}`)}`

    // List existing profiles
    const profilesResponse = await fetch(profilesUrl, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json'
      }
    })

    let profileId = null
    if (profilesResponse.ok) {
      const profiles = await profilesResponse.json()
      // Use the first profile or create one
      if (profiles.data && profiles.data.length > 0) {
        profileId = profiles.data[0].id
      }
    }

    // If no profile exists, create one
    if (!profileId) {
      const createProfileResponse = await fetch(profilesUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: 'Default VoIP Profile',
          settings: {
            codecs: ['PCMU', 'PCMA', 'G722', 'OPUS'],
            enable_rtp_auto_adjust: true
          }
        })
      })

      if (createProfileResponse.ok) {
        const newProfile = await createProfileResponse.json()
        profileId = newProfile.data.id
      }
    }

    // Create SIP endpoint
    const endpointUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints`
    
    const endpointResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: sipUsername,
        password: sipPassword,
        caller_id: `+1${userProfile.tenant_id.substring(0, 10)}`, // Generate a caller ID
        sip_profile_id: profileId,
        codecs: ['PCMU', 'PCMA', 'G722', 'OPUS'],
        encryption: 'optional',
        call_relay_context: 'public'
      })
    })

    if (!endpointResponse.ok) {
      const error = await endpointResponse.text()
      throw new Error(`Failed to create SIP endpoint: ${error}`)
    }

    const endpoint = await endpointResponse.json()

    // Store in database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: dbError } = await supabaseAdmin
      .from('sip_configurations')
      .upsert({
        tenant_id: userProfile.tenant_id,
        sip_username: sipUsername,
        sip_password: sipPassword,
        sip_endpoint_id: endpoint.data.id,
        signalwire_project_id: projectId,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      })

    if (dbError) {
      console.error('Failed to save SIP configuration:', dbError)
    }

    return new Response(JSON.stringify({
      success: true,
      endpoint: {
        id: endpoint.data.id,
        username: sipUsername,
        password: sipPassword,
        domain: `${spaceUrl}`,
        wsServers: [`wss://${spaceUrl}`],
        realm: spaceUrl
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-sip-endpoint:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})