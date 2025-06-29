// File: generate-signalwire-voice-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

// Helper function to generate a random password
function generateRandomPassword(length = 24): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }); 
  }
  
  try {
    console.log('Starting generate-signalwire-voice-token function');
    
    // Authenticate the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    // Get user profile and tenant information
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      // Auto-create user profile if missing (common issue mentioned in context)
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          tenant_id: user.user_metadata?.tenant_id || null,
          email: user.email,
          created_at: new Date().toISOString()
        })
        .select('tenant_id')
        .single();
      
      if (createError || !newProfile) {
        throw new Error('User profile not found and could not be created');
      }
      userProfile.tenant_id = newProfile.tenant_id;
    }

    // Check if tenant has a dedicated subproject
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('signalwire_subproject_id, signalwire_subproject_token, signalwire_subproject_space, subproject_status')
      .eq('id', userProfile.tenant_id)
      .single();

    // Determine which SignalWire credentials to use
    let projectId, apiToken, spaceUrl;
    
    if (tenant?.signalwire_subproject_id && tenant?.subproject_status === 'created') {
      // Use dedicated subproject credentials
      projectId = tenant.signalwire_subproject_id;
      apiToken = tenant.signalwire_subproject_token;
      spaceUrl = tenant.signalwire_subproject_space || Deno.env.get('SIGNALWIRE_SPACE_URL');
      console.log('Using dedicated subproject for tenant:', userProfile.tenant_id);
    } else {
      // Fall back to main project credentials
      projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
      apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
      spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
      console.log('Using main project for tenant:', userProfile.tenant_id, 'subproject status:', tenant?.subproject_status || 'none');
    }
    
    if (!projectId || !apiToken) {
      throw new Error('SignalWire credentials not configured in environment variables');
    }
    
    console.log('SignalWire configuration:', {
      projectId,
      hasApiToken: !!apiToken,
      spaceUrl: spaceUrl || 'not set'
    });

    let { data: sipConfig, error: sipError } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    // If no SIP config exists, auto-create unique SIP endpoint for this tenant
    if (sipError || !sipConfig) {
      console.log('No SIP configuration found, auto-creating unique endpoint for tenant:', userProfile.tenant_id);
      
      // Create unique SIP endpoint for this tenant
      const sipUsername = `tenant-${userProfile.tenant_id.substring(0, 8)}-${Date.now()}`;
      const sipPassword = generateRandomPassword();
      const auth = btoa(`${projectId}:${apiToken}`);
      
      // Create SIP endpoint via SignalWire API
      const endpointUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints`;
      const endpointResponse = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: sipUsername,
          password: sipPassword,
          codecs: ['OPUS', 'PCMU', 'PCMA'],
          enabled: true
        })
      });

      if (!endpointResponse.ok) {
        const errorText = await endpointResponse.text();
        throw new Error(`Failed to create SIP endpoint: ${errorText}`);
      }

      // Store the new SIP configuration in database
      const { data: newSipConfig, error: createError } = await supabaseAdmin
        .from('sip_configurations')
        .insert({
          tenant_id: userProfile.tenant_id,
          sip_username: sipUsername,
          sip_password_encrypted: sipPassword,
          sip_domain: 'taurustech-015b3ce9166a.sip.signalwire.com',
          sip_proxy: 'taurustech-015b3ce9166a.sip.signalwire.com',
          signalwire_project_id: projectId,
          is_active: true
        })
        .select('*')
        .single();

      if (createError || !newSipConfig) {
        throw new Error('Failed to auto-provision SIP configuration for your account.');
      }
      
      sipConfig = newSipConfig;
      console.log('Auto-provisioned unique SIP endpoint:', sipUsername);
    }

    // Use the actual SIP domain from config or fallback to hardcoded
    const sipDomain = sipConfig.sip_domain || 'taurustech-015b3ce9166a.sip.signalwire.com';
    const websocketServer = `wss://${sipDomain}`;
    
    console.log('Generated WebSocket URL:', websocketServer);
    console.log('Using SIP username:', sipConfig.sip_username);
    console.log('Using SIP domain:', sipDomain);
    
    // Return credentials for SIP.js WebRTC connection using actual database credentials
    return new Response(JSON.stringify({
      sip: {
        username: sipConfig.sip_username,
        password: sipConfig.sip_password_encrypted || sipConfig.sip_password,
        domain: sipDomain,
        displayName: user.email || sipConfig.display_name || 'User'
      },
      websocket: {
        server: websocketServer,
        traceSip: true,
        connectionTimeout: 10
      },
      project: projectId,
      token: apiToken,
      identity: sipConfig.sip_username,
      space_url: spaceUrl,
      user_id: user.id
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in generate-signalwire-voice-token: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});