// Test TURN server connectivity
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
    console.log('Testing TURN server connectivity...')
    
    const turnServers = [
      {
        url: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
        protocol: 'udp'
      },
      {
        url: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
        protocol: 'udp'
      },
      {
        url: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
        protocol: 'tcp'
      },
      {
        url: 'turn:relay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
        protocol: 'udp'
      },
      {
        url: 'turn:relay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
        protocol: 'udp'
      }
    ]
    
    const results = []
    
    // Test each TURN server
    for (const server of turnServers) {
      try {
        // Extract host and port from URL
        const urlMatch = server.url.match(/turn:([^:]+):(\d+)/)
        if (!urlMatch) {
          results.push({
            server: server.url,
            status: 'error',
            message: 'Invalid URL format'
          })
          continue
        }
        
        const [_, host, portStr] = urlMatch
        const port = parseInt(portStr)
        
        console.log(`Testing ${server.url}...`)
        
        // Try to connect to the TURN server
        // Note: We can't fully test TURN authentication from Deno,
        // but we can at least check if the server is reachable
        const start = Date.now()
        
        try {
          // Try to connect via TCP to check if port is open
          const conn = await Deno.connect({
            hostname: host,
            port: port,
            transport: "tcp"
          })
          
          const elapsed = Date.now() - start
          conn.close()
          
          results.push({
            server: server.url,
            status: 'reachable',
            protocol: server.protocol,
            responseTime: elapsed,
            message: `Server is reachable (${elapsed}ms)`
          })
        } catch (connError) {
          results.push({
            server: server.url,
            status: 'unreachable',
            protocol: server.protocol,
            message: `Cannot connect: ${connError.message}`
          })
        }
        
      } catch (error) {
        results.push({
          server: server.url,
          status: 'error',
          message: error.message
        })
      }
    }
    
    // Also test STUN servers
    const stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302'
    ]
    
    const stunResults = []
    
    for (const stunUrl of stunServers) {
      try {
        const urlMatch = stunUrl.match(/stun:([^:]+):(\d+)/)
        if (!urlMatch) continue
        
        const [_, host, portStr] = urlMatch
        const port = parseInt(portStr)
        
        const start = Date.now()
        
        try {
          const conn = await Deno.connect({
            hostname: host,
            port: port,
            transport: "udp"
          })
          
          const elapsed = Date.now() - start
          conn.close()
          
          stunResults.push({
            server: stunUrl,
            status: 'reachable',
            responseTime: elapsed
          })
        } catch (error) {
          stunResults.push({
            server: stunUrl,
            status: 'unreachable',
            message: error.message
          })
        }
      } catch (error) {
        stunResults.push({
          server: stunUrl,
          status: 'error',
          message: error.message
        })
      }
    }
    
    const summary = {
      turnServers: {
        total: results.length,
        reachable: results.filter(r => r.status === 'reachable').length,
        unreachable: results.filter(r => r.status === 'unreachable').length,
        errors: results.filter(r => r.status === 'error').length
      },
      stunServers: {
        total: stunResults.length,
        reachable: stunResults.filter(r => r.status === 'reachable').length,
        unreachable: stunResults.filter(r => r.status === 'unreachable').length
      },
      recommendation: ''
    }
    
    // Add recommendation based on results
    if (summary.turnServers.reachable === 0) {
      summary.recommendation = 'Critical: No TURN servers are reachable. This will cause call failures on restrictive networks. Contact support.'
    } else if (summary.turnServers.reachable < 3) {
      summary.recommendation = 'Warning: Limited TURN server connectivity. Calls may fail on some networks.'
    } else {
      summary.recommendation = 'Good: Multiple TURN servers are reachable. WebRTC connectivity should work well.'
    }
    
    return new Response(JSON.stringify({
      success: true,
      summary,
      turnResults: results,
      stunResults,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in test-turn-connectivity:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})