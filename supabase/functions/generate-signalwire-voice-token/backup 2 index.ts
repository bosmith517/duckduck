// File: generate-signalwire-voice-token/index.ts (FINAL - CORRECT VERSION)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }); 
  }
  
  try {
    // This function's only job is to securely retrieve and return the credentials.
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    
    if (!projectId || !apiToken) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }
    
    // Return the credentials needed by the modern Relay SDK client.
    return new Response(JSON.stringify({
      project: projectId,
      token: apiToken
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in generate-signalwire-voice-token function: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});