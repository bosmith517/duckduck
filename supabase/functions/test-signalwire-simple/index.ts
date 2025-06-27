import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Step 1: Get SignalWire API credentials from environment variables
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')

    // Return diagnostic information about environment variables
    const envDetails = {
      hasSpaceUrl: !!spaceUrl,
      hasApiToken: !!apiToken,
      hasProjectId: !!projectId,
      spaceUrlValue: spaceUrl ? `${spaceUrl.substring(0, 10)}...` : 'NOT SET',
      apiTokenValue: apiToken ? `${apiToken.substring(0, 10)}...` : 'NOT SET',
      projectIdValue: projectId ? `${projectId.substring(0, 10)}...` : 'NOT SET',
      constructedUrl: spaceUrl ? `https://${spaceUrl}/api/relay/rest/phone_numbers` : 'Cannot construct URL',
      timestamp: new Date().toISOString()
    }

    // Check that all required secrets are set
    if (!spaceUrl || !apiToken || !projectId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Server configuration error: SignalWire environment variables are missing',
        details: envDetails
      }), {
        status: 200, // Return 200 so we can see the diagnostic info
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use Project ID for username in Basic Auth
    const basicAuth = btoa(`${projectId}:${apiToken}`)

    // Step 2: Make the authenticated request to the SignalWire Relay REST API
    const swRes = await fetch(`https://${spaceUrl}/api/relay/rest/phone_numbers`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
    })

    const responseBody = await swRes.text()
    
    // If SignalWire returns an error, forward it to the client with details
    if (!swRes.ok) {
      return new Response(JSON.stringify({ 
        success: false,
        error: `SignalWire API error: ${swRes.status} - ${swRes.statusText}`,
        details: {
          ...envDetails,
          signalwireStatus: swRes.status,
          signalwireStatusText: swRes.statusText,
          signalwireResponse: responseBody
        }
      }), {
        status: 200, // Return 200 so we can see the diagnostic info
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse SignalWire response
    const signalwireData = JSON.parse(responseBody)
    
    // Return successful response with data
    const response = {
      success: true,
      message: 'SignalWire API connection successful',
      data: signalwireData.data || [],
      details: {
        ...envDetails,
        totalNumbers: signalwireData.data?.length || 0,
        signalwireStatus: swRes.status
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    // Catch any unexpected errors during function execution
    return new Response(JSON.stringify({ 
      success: false,
      error: `Function error: ${err.message}`,
      details: {
        errorType: err.name,
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200, // Return 200 so we can see the diagnostic info
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})