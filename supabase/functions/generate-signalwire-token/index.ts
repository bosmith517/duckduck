import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
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
      projectId: signalwireProjectId,
      spaceUrl: signalwireSpaceUrl
    });
    
    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }
    
    const body = await req.json().catch(() => ({}))
    const { clientIdentity, room_name } = body
    
    if (!clientIdentity || !room_name) { 
      console.log('generate-signalwire-token called without required parameters - returning error gracefully')
      return new Response(
        JSON.stringify({ 
          error: 'A clientIdentity and room_name are required to generate a token.',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('Token request:', { clientIdentity, room_name });
    
    // Use SignalWire's REST API to get a proper token (as shown in their demo)
    // Ensure the URL has the https:// protocol
    let apiUrl = signalwireSpaceUrl;
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `https://${apiUrl}`;
    }
    apiUrl = `${apiUrl}/api/video/room_tokens`;
    
    const tokenRequest = {
      user_name: clientIdentity,
      room_name: room_name,
      permissions: [
        "room.list_available_layouts",
        "room.set_layout", 
        "room.self.audio_mute",
        "room.self.audio_unmute",
        "room.self.video_mute",
        "room.self.video_unmute"
      ]
    };
    
    console.log('Making request to SignalWire API:', apiUrl);
    console.log('Request payload:', tokenRequest);
    
    // Create basic auth header (Project ID as username, API Token as password)
    const credentials = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tokenRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SignalWire API error:', response.status, errorText);
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    console.log('Token generated successfully via SignalWire REST API');
    console.log('Token response:', tokenData);
    
    return new Response(JSON.stringify({ token: tokenData.token }), { 
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
