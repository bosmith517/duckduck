// File: generate-signalwire-voice-token/index.ts (Test Version)

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
    // --- Step 1: Get environment variables ---
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!;
    
    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }
    
    // --- Step 2: Get user identifier from the request ---
    const { userId } = await req.json();
    if (!userId) {
      throw new Error("A 'userId' is required in the request body.");
    }

    // --- Step 3: Look up the user's SIP username from your database ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userCredentials, error: dbError } = await supabase
      .from('signalwire_credentials')
      .select('sip_username')
      .eq('user_id', userId)
      .single();

    if (dbError || !userCredentials) {
      throw new Error("Could not find SIP credentials for the specified user.");
    }

    // --- Step 4: Construct the resource URI with the HARDCODED domain for this test ---
    const sipDomain = "taurustech-015b3ce9166a.sip.signalwire.com"; // Hardcoded for test
    const resource = `sip:${userCredentials.sip_username}@${sipDomain}`;
    
    console.log(`[HARDCODED DOMAIN TEST] Constructed resource: "${resource}"`);
    
    // --- Step 5: Call SignalWire to get a scoped JWT ---
    const apiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/jwt`;
    const credentials = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resource: resource })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      // This is where the 401 error is being caught
      throw new Error(`SignalWire Relay JWT error: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    
    // --- Step 6: Return ONLY the token to the client ---
    return new Response(JSON.stringify({ token: tokenData.jwt_token }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in generate-signalwire-voice-token function: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content--Type': 'application/json' }, 
      status: 500 
    });
  }
});