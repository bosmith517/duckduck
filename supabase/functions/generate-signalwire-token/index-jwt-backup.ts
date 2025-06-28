import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }) 
  }
  
  try {
    // Get environment variables
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!;
    
    console.log('Environment check:', {
      hasProjectId: !!signalwireProjectId,
      hasApiToken: !!signalwireApiToken,
      hasSpaceUrl: !!signalwireSpaceUrl,
      projectId: signalwireProjectId
    });
    
    if (!signalwireProjectId || !signalwireApiToken) { 
      throw new Error("Server configuration error: Missing SignalWire PROJECT_ID or API_TOKEN."); 
    }
    
    const { clientIdentity, room_name } = await req.json()
    
    if (!clientIdentity || !room_name) { 
      throw new Error('A clientIdentity and room_name are required to generate a token.') 
    }
    
    console.log('Token request:', { clientIdentity, room_name });
    
    // Create JWT payload according to SignalWire Video requirements
    const now = Math.floor(Date.now() / 1000);
    const expires = now + 3600; // 1 hour expiration
    
    // Extract cluster from space URL if available, default to 'us-west-1'
    let cluster = 'us-west-1';
    if (signalwireSpaceUrl) {
      const match = signalwireSpaceUrl.match(/([a-z]+-[a-z]+-\d+)/);
      if (match) {
        cluster = match[1];
      }
    }
    
    const payload = {
      jti: crypto.randomUUID(),
      iss: signalwireProjectId,
      sub: clientIdentity,
      user_name: clientIdentity,
      iat: now,
      exp: expires,
      resource: `${signalwireProjectId}.video.${room_name}`,
      grants: {
        video: {
          room: room_name,
          room_join: true,
          room_list: false,
          room_create: false,
          room_update: false,
          room_delete: false
        }
      }
    };
    
    // Create JWT header with cluster information
    const header = { 
      alg: "HS256", 
      typ: "JWT",
      ch: cluster
    };
    
    console.log('JWT payload:', payload);
    console.log('JWT header:', header);
    
    const key = await getSigningKey(signalwireApiToken);
    const token = await create(header, payload, key);
    
    console.log('Token generated successfully');
    
    return new Response(JSON.stringify({ token: token }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    })
  } catch (error) {
    console.error(`Error in generate-signalwire-token function: ${error.message}`)
    console.error('Stack trace:', error.stack)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    })
  }
})
