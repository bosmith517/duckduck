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
    console.log("[FINAL JWT TEST] Starting...");

    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const spaceUrl = "taurustech-015b3ce9166a.signalwire.com"; // Hardcoded known Space URL
    
    if (!apiToken) {
      throw new Error("Server configuration error: Missing API Token.");
    }

    const sipUsername = "user-cc5fcb27-test"; // Use the user we just successfully created
    const sipDomain = "taurustech-015b3ce9166a.sip.signalwire.com";
    const resource = `sip:${sipUsername}@${sipDomain}`;

    console.log(`[FINAL JWT TEST] Attempting to get token for resource: "${resource}"`);

    const apiUrl = `https://${spaceUrl}/api/relay/rest/jwt`;
    
    // --- FINAL TEST ---
    // Instead of Project ID, we test using the Space URL as the username for Basic Auth.
    const credentials = btoa(`${spaceUrl}:${apiToken}`);
    
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
      throw new Error(`SignalWire API returned error: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log("[FINAL JWT TEST] SUCCESS! Token received:", tokenData);

    return new Response(JSON.stringify(tokenData));

  } catch (error) {
    console.error("[FINAL JWT TEST] FAILED:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});