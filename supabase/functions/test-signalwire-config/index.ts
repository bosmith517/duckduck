// Simple test function for SignalWire configuration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }); 
  }
  
  try {
    console.log('Testing SignalWire configuration...');
    
    // Check basic environment variables
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
    
    if (!projectId) {
      throw new Error('SIGNALWIRE_PROJECT_ID environment variable not set');
    }
    
    if (!apiToken) {
      throw new Error('SIGNALWIRE_API_TOKEN environment variable not set');
    }
    
    if (!spaceUrl) {
      throw new Error('SIGNALWIRE_SPACE_URL environment variable not set');
    }
    
    console.log('Environment variables OK:', {
      projectId: projectId?.substring(0, 8) + '...',
      hasApiToken: !!apiToken,
      spaceUrl
    });
    
    // Test SignalWire API connectivity with a simple request
    const auth = btoa(`${projectId}:${apiToken}`);
    const testUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints`;
    
    console.log('Testing API connectivity to:', testUrl);
    
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('API test response status:', testResponse.status);
    
    let apiTestResult;
    if (testResponse.ok) {
      const data = await testResponse.json();
      apiTestResult = {
        status: 'success',
        message: 'API connectivity confirmed',
        endpointCount: data?.data?.length || 0
      };
    } else {
      const errorText = await testResponse.text();
      apiTestResult = {
        status: 'error',
        httpStatus: testResponse.status,
        message: errorText
      };
    }
    
    // Test authentication if provided
    let authTest = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        authTest = { status: 'error', message: error.message };
      } else if (user) {
        authTest = { 
          status: 'success', 
          userId: user.id,
          email: user.email 
        };
      }
    }
    
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      configuration: {
        projectId: projectId?.substring(0, 8) + '...',
        spaceUrl,
        hasApiToken: !!apiToken
      },
      apiConnectivity: apiTestResult,
      authentication: authTest,
      recommendations: apiTestResult.status === 'error' ? [
        'Verify SIGNALWIRE_PROJECT_ID is correct',
        'Verify SIGNALWIRE_API_TOKEN has proper permissions',
        'Verify SIGNALWIRE_SPACE_URL matches your SignalWire space',
        'Check if your SignalWire account has API access enabled'
      ] : [
        'Configuration appears correct',
        'Ready for SIP endpoint provisioning'
      ]
    }, null, 2), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error('SignalWire config test error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      recommendations: [
        'Check that all SignalWire environment variables are set in Supabase Edge Functions',
        'Verify your SignalWire account is active and has API access',
        'Check the SignalWire space URL format (should be like: your-space.signalwire.com)'
      ]
    }, null, 2), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});