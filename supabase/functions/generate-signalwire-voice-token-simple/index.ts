// Simplified function to generate SignalWire voice tokens
// This version creates database records without trying to call SignalWire API
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
    console.log('Starting simplified SignalWire token generation...');
    
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
      throw new Error('User profile not found');
    }

    if (!userProfile.tenant_id) {
      throw new Error('User profile does not have tenant_id. Please complete your onboarding.');
    }

    console.log('User authenticated, tenant:', userProfile.tenant_id);

    // Get SignalWire project configuration
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
    
    if (!projectId || !apiToken) {
      throw new Error('SignalWire credentials not configured in environment variables');
    }
    
    console.log('SignalWire configuration loaded');

    // Check for existing SIP configuration
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let { data: sipConfig, error: sipError } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    // If no SIP config exists, create one (database only, no API calls)
    if (sipError || !sipConfig) {
      console.log('Creating SIP configuration for tenant:', userProfile.tenant_id);
      
      // Generate unique SIP credentials
      const sipUsername = `tenant-${userProfile.tenant_id.substring(0, 8)}-${Date.now()}`;
      const sipPassword = generateRandomPassword();
      
      // Construct the SIP domain (your existing endpoint)
      const last12 = projectId.replace(/-/g, '').slice(-12);
      const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
      
      console.log('Generated SIP config:', {
        username: sipUsername,
        domain: sipDomain
      });

      // Store SIP configuration in database (no API calls)
      const { data: newSipConfig, error: createError } = await supabaseAdmin
        .from('sip_configurations')
        .insert({
          tenant_id: userProfile.tenant_id,
          sip_username: sipUsername,
          sip_password_encrypted: sipPassword,
          sip_domain: sipDomain,
          sip_proxy: sipDomain,
          signalwire_project_id: projectId,
          is_active: true,
          notes: `Auto-generated for existing endpoint ${sipDomain} - API provisioning may be needed`
        })
        .select('*')
        .single();

      if (createError || !newSipConfig) {
        throw new Error(`Failed to create SIP configuration: ${createError?.message}`);
      }
      
      sipConfig = newSipConfig;
      console.log('SIP configuration created successfully');
    } else {
      console.log('Using existing SIP configuration');
    }

    // Construct the final SIP domain
    let sipDomain = sipConfig.sip_domain;
    
    // Fallback domain construction if not in config
    if (!sipDomain && projectId) {
      const last12 = projectId.replace(/-/g, '').slice(-12);
      sipDomain = `taurustech-${last12}.sip.signalwire.com`;
    }
    
    // Final fallback
    if (!sipDomain) {
      sipDomain = 'taurustech-9b70eb096555.sip.signalwire.com';
    }
    
    const websocketServer = `wss://${sipDomain}`;
    
    console.log('Returning credentials:', {
      username: sipConfig.sip_username,
      domain: sipDomain,
      websocketServer
    });
    
    // Return credentials for SIP.js WebRTC connection
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
      user_id: user.id,
      note: 'SIP credentials generated. Manual provisioning in SignalWire may be required.'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in generate-signalwire-voice-token-simple: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      note: 'This error indicates either missing environment variables, authentication issues, or database connection problems.'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});