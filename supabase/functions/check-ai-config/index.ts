// supabase/functions/check-ai-config/index.ts
//
// Checks AI-related configuration and environment variables
//

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check all AI-related environment variables
    const config = {
      signalwire: {
        projectId: Deno.env.get('SIGNALWIRE_PROJECT_ID') ? '✓ Set' : '✗ Not set',
        apiToken: Deno.env.get('SIGNALWIRE_API_TOKEN') ? '✓ Set' : '✗ Not set',
        spaceUrl: Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com',
      },
      ai: {
        estimatorId: Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID') || 'Not set',
        phoneNumber: Deno.env.get('SIGNALWIRE_AI_PHONE_NUMBER') || 'Not set',
        fromNumber: Deno.env.get('SIGNALWIRE_FROM_NUMBER') || 'Not set',
        relayBinUrl: Deno.env.get('SIGNALWIRE_AI_RELAY_BIN_URL') || 'Not set',
        swaigUrl: Deno.env.get('SIGNALWIRE_AI_SWAIG_URL') || 'Not set',
      },
      supabase: {
        url: Deno.env.get('SUPABASE_URL') ? '✓ Set' : '✗ Not set',
        serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✓ Set' : '✗ Not set',
        webhookSecret: Deno.env.get('WEBHOOK_SECRET') ? '✓ Set' : '✗ Not set',
      }
    }

    // Test SignalWire API connectivity
    let apiTest = { status: 'Not tested', error: null }
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL') || 'taurustech.signalwire.com'
    
    if (projectId && apiToken) {
      try {
        // Test with a simple API call
        const testUrl = `https://${spaceUrl}/api/video/rooms?page_size=1`
        const auth = btoa(`${projectId}:${apiToken}`)
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          }
        })
        
        apiTest = {
          status: response.ok ? 'Connected' : `Failed (${response.status})`,
          error: response.ok ? null : await response.text()
        }
      } catch (error) {
        apiTest = {
          status: 'Error',
          error: error.message
        }
      }
    }

    // Check if AI script exists (if ID is set)
    let scriptCheck = { exists: false, error: null }
    const scriptId = Deno.env.get('SIGNALWIRE_AI_ESTIMATOR_ID')
    
    if (scriptId && scriptId !== 'Not set' && projectId && apiToken) {
      try {
        const scriptUrl = `https://${spaceUrl}/api/video/scripts/${scriptId}`
        const auth = btoa(`${projectId}:${apiToken}`)
        
        const response = await fetch(scriptUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          }
        })
        
        scriptCheck = {
          exists: response.ok,
          error: response.ok ? null : `${response.status} - ${await response.text()}`
        }
      } catch (error) {
        scriptCheck = {
          exists: false,
          error: error.message
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        config,
        apiTest,
        scriptCheck,
        recommendations: [
          config.ai.estimatorId === 'Not set' ? 'Set SIGNALWIRE_AI_ESTIMATOR_ID to your AI script ID' : null,
          config.ai.phoneNumber === 'Not set' ? 'Set SIGNALWIRE_AI_PHONE_NUMBER for phone-based AI' : null,
          !scriptCheck.exists && scriptId ? `AI Script ID "${scriptId}" not found or invalid` : null,
          apiTest.status !== 'Connected' ? 'Check SignalWire API credentials' : null,
        ].filter(Boolean)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error checking AI config:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})