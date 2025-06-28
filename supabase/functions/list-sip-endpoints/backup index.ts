import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get the tenant ID from the authenticated user
async function getTenantId(supabase: SupabaseClient): Promise<string> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    if (!user) throw new Error("User not found.");

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (profileError) throw new Error(`Could not find user profile: ${profileError.message}`);
    if (!profile?.tenant_id) throw new Error("Tenant ID not found for the user.");
    
    return profile.tenant_id;
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // --- Get environment variables ---
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // --- Securely identify the user ---
    const authHeader = req.headers.get('Authorization'); // Removed the '!' operator

    // CORRECTED: Add a check for the Authorization header.
    // If it's missing, return a 401 Unauthorized error instead of crashing.
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header. Please ensure you are logged in.' }),
        { status: 401, headers: corsHeaders }
      );
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    
    const tenantId = await getTenantId(supabase);

    // --- Fetch data from SignalWire API ---
    const apiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/sip_endpoints`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const signalwireResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    })

    if (!signalwireResponse.ok) {
      const errorBody = await signalwireResponse.text()
      throw new Error(`SignalWire API error: ${signalwireResponse.status} - ${errorBody}`)
    }
    
    const data = await signalwireResponse.json()

    // --- Sync data to the database for the identified tenant ---
    if (tenantId && data.data) {
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
      
      for (const endpoint of data.data) {
        const { error: upsertError } = await supabaseAdmin
          .from('sip_configurations')
          .upsert({ 
              tenant_id: tenantId,
              signalwire_endpoint_id: endpoint.id,
              sip_username: endpoint.username,
              sip_domain: endpoint.uri?.split('@')[1] || signalwireSpaceUrl,
              sip_proxy: endpoint.uri?.split('@')[1] || signalwireSpaceUrl,
              display_name: endpoint.caller_id,
              call_handler: endpoint.call_handler,
              call_request_url: endpoint.call_request_url,
              call_request_method: endpoint.call_request_method,
              call_fallback_url: endpoint.call_fallback_url,
              call_fallback_method: endpoint.call_fallback_method,
              call_status_callback_url: endpoint.call_status_callback_url,
              call_status_callback_method: endpoint.call_status_callback_method,
              call_laml_application_id: endpoint.call_laml_application_id,
              call_relay_topic: endpoint.call_relay_topic,
              call_relay_topic_status_callback_url: endpoint.call_relay_topic_status_callback_url,
              call_relay_context: endpoint.call_relay_context,
              call_relay_context_status_callback_url: endpoint.call_relay_context_status_callback_url,
              call_video_room_id: endpoint.call_video_room_id,
              call_flow_id: endpoint.call_flow_id,
              call_ai_agent_id: endpoint.call_ai_agent_id,
              call_relay_script_url: endpoint.call_relay_script_url,
              encryption: endpoint.encryption,
              codecs: endpoint.codecs,
              ciphers: endpoint.ciphers,
              send_as: endpoint.send_as
           }, { onConflict: 'signalwire_endpoint_id' })

        if (upsertError) console.error('Error syncing SIP endpoint:', upsertError)
      }
      console.log(`Sync complete for tenant ${tenantId}.`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
