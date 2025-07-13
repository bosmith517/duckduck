// Simple TURN server connectivity test
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Testing TURN server connectivity (simplified)...')
    
    // List of TURN servers to test
    const turnServers = [
      {
        url: 'turn:openrelay.metered.ca:80',
        host: 'openrelay.metered.ca',
        port: 80,
        protocol: 'udp'
      },
      {
        url: 'turn:openrelay.metered.ca:443',
        host: 'openrelay.metered.ca',
        port: 443,
        protocol: 'tcp'
      }
    ]
    
    const results = []
    
    // Simple DNS resolution test for each TURN server
    for (const server of turnServers) {
      try {
        console.log(`Testing ${server.url}...`)
        
        // Try DNS resolution first
        const start = Date.now()
        const addresses = await Deno.resolveDns(server.host, "A")
        const elapsed = Date.now() - start
        
        if (addresses && addresses.length > 0) {
          results.push({
            server: server.url,
            status: 'dns_resolved',
            protocol: server.protocol,
            responseTime: elapsed,
            message: `DNS resolved to ${addresses[0]} (${elapsed}ms)`,
            addresses
          })
        } else {
          results.push({
            server: server.url,
            status: 'dns_failed',
            protocol: server.protocol,
            message: 'DNS resolution failed'
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
      { url: 'stun:stun.l.google.com:19302', host: 'stun.l.google.com' },
      { url: 'stun:stun1.l.google.com:19302', host: 'stun1.l.google.com' }
    ]
    
    const stunResults = []
    
    for (const stun of stunServers) {
      try {
        const start = Date.now()
        const addresses = await Deno.resolveDns(stun.host, "A")
        const elapsed = Date.now() - start
        
        stunResults.push({
          server: stun.url,
          status: addresses.length > 0 ? 'resolved' : 'failed',
          responseTime: elapsed,
          addresses
        })
      } catch (error) {
        stunResults.push({
          server: stun.url,
          status: 'error',
          message: error.message
        })
      }
    }
    
    const summary = {
      turnServers: {
        total: results.length,
        resolved: results.filter(r => r.status === 'dns_resolved').length,
        failed: results.filter(r => r.status === 'dns_failed').length,
        errors: results.filter(r => r.status === 'error').length
      },
      stunServers: {
        total: stunResults.length,
        resolved: stunResults.filter(r => r.status === 'resolved').length,
        failed: stunResults.filter(r => r.status === 'failed' || r.status === 'error').length
      },
      recommendation: ''
    }
    
    // Add recommendation based on results
    if (summary.turnServers.resolved === 0) {
      summary.recommendation = 'Critical: Cannot resolve TURN server addresses. Check DNS settings.'
    } else if (summary.stunServers.resolved === 0) {
      summary.recommendation = 'Warning: Cannot resolve STUN servers. WebRTC may have issues.'
    } else {
      summary.recommendation = 'Good: TURN and STUN servers are resolvable. Network connectivity looks good.'
    }
    
    return new Response(JSON.stringify({
      success: true,
      summary,
      turnResults: results,
      stunResults,
      timestamp: new Date().toISOString(),
      note: 'This is a simplified test that only checks DNS resolution. Full connectivity testing requires WebRTC client-side implementation.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in test-turn-connectivity-simple:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})