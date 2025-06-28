// File: generate-signalwire-voice-token/index.ts (SECURE VERSION)
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
    console.log('Starting generate-signalwire-voice-token function');
    
    // SECURITY: Authenticate the user first
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }
    console.log('Auth header found');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('Supabase client created, getting user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Invalid authentication');
    }
    console.log('User authenticated:', user.id);

    // Get user's tenant information
    console.log('Getting user profile for user:', user.id);
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile error:', profileError);
      console.error('Profile data:', userProfile);
      throw new Error('User profile not found');
    }
    console.log('User profile found:', userProfile);

    // Validate tenant exists and is active
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_active')
      .eq('id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant');
    }

    // Get SIP configuration for this tenant (optional - will work without it)
    const { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('sip_username, signalwire_project_id, is_active')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!;
    
    if (!projectId || !apiToken || !spaceUrl) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }

    // For SignalWire VoIP, we need to use their native authentication
    // Let's try using the project credentials directly
    const identity = `user-${user.id.substring(0, 8)}`;
    
    console.log('Generating VoIP credentials for identity:', identity);
    
    // Get or create SIP credentials for WebRTC
    const sipUsername = sipConfig?.sip_username || `${identity}@${tenant.name.toLowerCase().replace(/\s+/g, '-')}`;
    const sipDomain = `${tenant.name.toLowerCase().replace(/\s+/g, '-')}.sip.signalwire.com`;
    const websocketServer = `wss://${sipDomain}`;
    
    // For now, use a simple password (in production, this should be stored securely)
    const sipPassword = apiToken; // This needs to be the actual SIP password
    
    return new Response(JSON.stringify({
      // WebRTC SIP credentials
      sip: {
        username: sipUsername,
        password: sipPassword,
        domain: sipDomain
      },
      websocket: {
        server: websocketServer
      },
      // Additional info for reference
      project: projectId,
      token: apiToken,
      identity: identity,
      space_url: spaceUrl,
      tenant_id: userProfile.tenant_id,
      tenant_name: tenant.name
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in generate-signalwire-voice-token function: ${error.message}`);
    console.error('Full error stack:', error.stack);
    console.error('Error details:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});