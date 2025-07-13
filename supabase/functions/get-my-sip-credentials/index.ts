// Get current user's SIP credentials for testing
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
    // Authenticate user
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

    console.log('Getting SIP credentials for user:', user.id)

    // Admin client to get decrypted password
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user's SIP configuration
    const { data: sipConfig, error: sipError } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (sipError || !sipConfig) {
      throw new Error('No active SIP configuration found for user')
    }

    // Get WebSocket server URL
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    const wsServer = `wss://${sipConfig.sip_domain}`
    const sipProxy = sipConfig.sip_proxy || sipConfig.sip_domain

    // Format for Zoiper and other SIP clients
    const credentials = {
      username: sipConfig.sip_username,
      password: sipConfig.sip_password_encrypted, // This is actually the plain password
      domain: sipConfig.sip_domain,
      proxy: sipProxy,
      websocket_server: wsServer,
      display_name: user.email,
      
      // Configuration for Zoiper
      zoiper_config: {
        account_name: `SignalWire - ${sipConfig.sip_username}`,
        username: sipConfig.sip_username,
        password: sipConfig.sip_password_encrypted,
        domain: sipConfig.sip_domain,
        sip_proxy: sipProxy,
        transport: 'TCP/TLS',
        port: 5061,
        stun_server: `stun:${sipConfig.sip_domain}`,
        enable_ice: true,
        enable_stun: true
      },
      
      // Alternative configurations
      other_clients: {
        linphone: {
          identity: `sip:${sipConfig.sip_username}@${sipConfig.sip_domain}`,
          proxy: `sip:${sipConfig.sip_domain}:5061;transport=tls`,
          transport: 'TLS'
        },
        microsip: {
          server: sipConfig.sip_domain,
          proxy: `${sipConfig.sip_domain}:5061`,
          protocol: 'TLS',
          port: 5061
        },
        webrtc: {
          websocket: wsServer,
          ice_servers: [
            `stun:${sipConfig.sip_domain}`,
            'stun:stun.l.google.com:19302'
          ]
        }
      },
      
      // SignalWire specific info
      signalwire: {
        endpoint_id: sipConfig.signalwire_endpoint_id,
        project_id: sipConfig.signalwire_project_id,
        space_url: spaceUrl
      }
    }

    return new Response(JSON.stringify({
      success: true,
      credentials,
      instructions: [
        'For Zoiper:',
        '1. Create new SIP account',
        '2. Enter username, password, and domain from above',
        '3. Set transport to TCP or TLS',
        '4. Set port to 5061 for TLS or 5060 for TCP',
        '5. Enable STUN if available',
        '',
        'For testing WebRTC issues:',
        '- If Zoiper works but browser doesn\'t: WebRTC/firewall issue',
        '- If both fail: Network or SignalWire configuration issue',
        '- If browser works but Zoiper doesn\'t: Zoiper configuration issue'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in get-my-sip-credentials:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})