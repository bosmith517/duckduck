// File: supabase/functions/list-sip-endpoints/index.ts
// This version has been updated to be "tenant-aware".
// It fetches credentials from the database before calling SignalWire.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- 1. Get tenant_id from the request body ---
    const { tenant_id } = await req.json()
    if (!tenant_id) {
      throw new Error("This function now requires a 'tenant_id' in the request body.")
    }
    console.log(`Listing SIP endpoints for tenant_id: ${tenant_id}`);

    // --- 2. Create a Supabase admin client to securely access the database ---
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // --- 3. Fetch the SIP configuration for the given tenant ---
    // This is the new step to make the function tenant-aware.
    const { data: sipConfig, error: dbError } = await supabaseAdminClient
      .from('sip_configurations')
      .select('sip_username, sip_password_encrypted, sip_domain')
      .eq('tenant_id', tenant_id)
      .single()

    if (dbError || !sipConfig) {
      console.error('Database error or SIP config not found:', dbError)
      throw new Error(`Could not find SIP configuration for tenant_id: ${tenant_id}`)
    }
    console.log(`Found SIP configuration for tenant:`, sipConfig.sip_username);


    // --- 4. Prepare SignalWire API call using stored secrets ---
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')! // e.g., your-space.signalwire.com
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!

    const credentials = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    // This API endpoint is for listing endpoints, which is a safe test
    const signalwireApiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/endpoints/sip`

    // --- 5. Make the existing call to SignalWire to list SIP endpoints ---
    console.log("Attempting to list SIP endpoints from SignalWire...");
    const response = await fetch(signalwireApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('SignalWire API Error:', responseData);
      throw new Error(`SignalWire API call failed with status: ${response.status}`);
    }

    console.log('SignalWire API call successful!');

    // --- 6. Return a success response ---
    // Also get local database SIP configurations for this tenant
    const { data: localSipConfigs, error: localError } = await supabaseAdminClient
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', tenant_id)

    return new Response(
      JSON.stringify({
        signalwire_endpoints: responseData, // Original SignalWire response
        local_sip_configs: localSipConfigs || [],
        endpoints: localSipConfigs || [] // For backward compatibility
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('An error occurred in the function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
