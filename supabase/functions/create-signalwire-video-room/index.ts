import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }) 
  }
  
  try {
    const { jobId } = await req.json();
    
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
      throw new Error('Server configuration error: Missing SignalWire credentials.'); 
    }
    
    // Create room name
    const roomName = `TradeWorks-Meeting-${crypto.randomUUID()}`;
    console.log('Creating room:', roomName);
    
    // Create room via SignalWire API
    const signalwireApiUrl = `https://${signalwireSpaceUrl}/api/video/rooms`;
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
    
    console.log('Making API request to:', signalwireApiUrl);
    
    const response = await fetch(signalwireApiUrl, { 
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Basic ${auth}` 
      }, 
      body: JSON.stringify({ 
        name: roomName,
        display_name: roomName
      }) 
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SignalWire API Error (${response.status}): ${errorText}`);
      throw new Error(`Failed to create video room: ${response.status} ${response.statusText}`);
    }
    
    const roomData = await response.json();
    console.log('Room created successfully:', roomData);
    
    const roomSessionId = roomData.id;
    
    // Store in database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const authHeader = req.headers.get('Authorization')!;
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    
    if (!user) throw new Error("Could not authenticate user.");
    
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!userProfile) throw new Error("Could not find user profile.");
    
    await supabaseAdmin.from('video_meetings').insert({ 
      tenant_id: userProfile.tenant_id, 
      created_by_user_id: user.id, 
      room_url: roomSessionId, 
      provider: 'SignalWire', 
      job_id: jobId || null, 
      room_name: roomName 
    });
    
    console.log('Room stored in database successfully');
    
    return new Response(JSON.stringify({ 
      roomSessionId: roomSessionId, 
      roomName: roomName 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });
    
  } catch (error) {
    console.error(`Error in create-signalwire-video-room: ${error.message}`);
    console.error('Stack trace:', error.stack);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
})
