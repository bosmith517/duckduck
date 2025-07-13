// Get SignalWire ICE servers for WebRTC
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

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    console.log('Requesting ICE servers from SignalWire...')
    
    // SignalWire's ICE servers are typically available at the space URL
    const iceServers = [
      // SignalWire STUN server
      { urls: `stun:${spaceUrl}` },
      { urls: `stun:${spaceUrl}:443` },
      
      // SignalWire TURN servers (if available)
      // Note: These require proper credentials from SignalWire
      {
        urls: `turn:${spaceUrl}:443`,
        username: projectId,
        credential: apiToken
      },
      {
        urls: `turn:${spaceUrl}:443?transport=tcp`,
        username: projectId,
        credential: apiToken
      },
      
      // Fallback to reliable public servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      
      // High-quality public TURN servers
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
    
    // Try to get TURN credentials from SignalWire API
    try {
      const auth = btoa(`${projectId}:${apiToken}`)
      const turnUrl = `https://${spaceUrl}/api/relay/rest/turn/credentials`
      
      console.log('Attempting to get TURN credentials from:', turnUrl)
      
      const turnResponse = await fetch(turnUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      })
      
      if (turnResponse.ok) {
        const turnData = await turnResponse.json()
        console.log('Got TURN credentials from SignalWire:', turnData)
        
        // Add SignalWire's TURN servers if available
        if (turnData.ice_servers) {
          iceServers.unshift(...turnData.ice_servers)
        }
      } else {
        console.log('Could not get TURN credentials from SignalWire:', turnResponse.status)
      }
    } catch (turnError) {
      console.log('Error getting TURN credentials:', turnError.message)
    }
    
    return new Response(JSON.stringify({
      success: true,
      iceServers,
      recommendations: [
        'Use these ICE servers in your WebRTC configuration',
        'If calls still fail, contact SignalWire support for dedicated TURN servers',
        'Consider using SignalWire\'s SDK which handles ICE configuration automatically'
      ],
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in get-signalwire-ice-servers:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})