import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check which environment variables are set
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    
    const envStatus = {
      hasProjectId: !!projectId,
      hasApiToken: !!apiToken,
      hasSpaceUrl: !!spaceUrl,
      projectIdLength: projectId?.length || 0,
      apiTokenLength: apiToken?.length || 0,
      spaceUrl: spaceUrl || 'not set',
      timestamp: new Date().toISOString()
    }

    console.log('Environment check:', envStatus)

    // If credentials exist, try a simple API call
    if (projectId && apiToken && spaceUrl) {
      try {
        // Test the credentials with a simple rooms list call
        const testUrl = `https://${spaceUrl}/api/video/rooms`
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`
          }
        })

        envStatus.credentialsValid = testResponse.ok
        envStatus.testStatusCode = testResponse.status
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text()
          envStatus.testError = errorText.substring(0, 200) // First 200 chars
        }
      } catch (e: any) {
        envStatus.testError = e.message
      }
    }

    return new Response(
      JSON.stringify(envStatus, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})