// File: generate-signalwire-voice-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { UniversalLogger, loggedDatabaseOperation, loggedExternalApiCall } from '../_shared/universal-logger.ts';

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

    // If no SIP config exists, create one for the existing SIP endpoint
    if (sipError || !sipConfig) {
      console.log('No SIP configuration found, creating credentials for tenant:', userProfile.tenant_id);
      
      // Generate SIP username from email address
      const emailPrefix = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      
      // Check if username already exists, add suffix if needed
      const { data: existingUser } = await supabaseAdmin
        .from('sip_configurations')
        .select('sip_username')
        .eq('sip_username', emailPrefix)
        .single();
      
      let sipUsername = emailPrefix;
      if (existingUser) {
        // Add tenant suffix to make it unique
        const tenantSuffix = userProfile.tenant_id.substring(0, 8);
        sipUsername = `${emailPrefix}_${tenantSuffix}`;
        console.log('Username collision detected, using:', sipUsername);
      }
      
      const sipPassword = generateRandomPassword();
      
      console.log('Generated SIP username from email:', user.email, '->', sipUsername);
      
      // Construct the SIP domain (existing endpoint)
      const last12 = projectId.replace(/-/g, '').slice(-12);
      const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
      
      console.log('Creating SIP credentials for existing endpoint:', sipDomain);
      console.log('Generated SIP username:', sipUsername);
      
      // Create SIP user via SignalWire API on the existing endpoint
      const auth = btoa(`${projectId}:${apiToken}`);
      
      // Try multiple possible API endpoints for creating SIP users
      const possibleUrls = [
        `https://${spaceUrl}/api/relay/rest/sip_endpoints/${sipDomain.split('.')[0]}/users`,
        `https://${spaceUrl}/api/relay/rest/sip_credentials`,
        `https://${spaceUrl}/api/relay/rest/users`
      ];
      
      let userCreated = false;
      
      for (const apiUrl of possibleUrls) {
        console.log('Attempting to create SIP user at:', apiUrl);
        
        try {
          const userResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              username: sipUsername,
              password: sipPassword,
              enabled: true,
              endpoint: sipDomain.split('.')[0] // May be needed for some endpoints
            })
          });

          if (userResponse.ok) {
            console.log('SIP user created successfully at:', apiUrl);
            userCreated = true;
            break;
          } else {
            const errorText = await userResponse.text();
            console.log(`API endpoint ${apiUrl} failed:`, errorText);
          }
        } catch (fetchError) {
          console.log(`Network error with ${apiUrl}:`, fetchError.message);
        }
      }
      
      if (!userCreated) {
        console.log('Could not create SIP user via API, but continuing with database config');
        console.log('The SIP credentials may need to be manually added to SignalWire');
      }

      // Store the new SIP configuration in database (using existing endpoint)
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
          service_plan: 'basic',
          monthly_rate: 29.99,
          per_minute_rate: 0.02,
          included_minutes: 1000,
          notes: `Auto-provisioned for existing endpoint ${sipDomain}`
        })
        .select('*')
        .single();

      if (createError || !newSipConfig) {
        throw new Error(`Failed to create SIP configuration: ${createError?.message}`);
      }
      
      sipConfig = newSipConfig;
      console.log('Created SIP configuration for tenant:', userProfile.tenant_id);
    } else {
      console.log('Found existing SIP configuration for tenant:', userProfile.tenant_id);
      console.log('SIP config details:', {
        username: sipConfig.sip_username,
        domain: sipConfig.sip_domain,
        hasPassword: !!sipConfig.sip_password_encrypted,
        isActive: sipConfig.is_active
      });
    }

    // Use the actual SIP domain from config or construct it from project ID
    let sipDomain = sipConfig.sip_domain;
    
    // If no domain in config, construct it from project ID (taurustech + last 12 chars)
    if (!sipDomain && projectId) {
      const last12 = projectId.replace(/-/g, '').slice(-12);
      sipDomain = `taurustech-${last12}.sip.signalwire.com`;
      console.log('Constructed SIP domain from project ID:', sipDomain);
    }
    
    // Final fallback to your specific domain
    if (!sipDomain) {
      sipDomain = 'taurustech-9b70eb096555.sip.signalwire.com';
      console.log('Using fallback SIP domain:', sipDomain);
    }
    
    const websocketServer = `wss://${sipDomain}`;
    
    console.log('Final configuration:', {
      websocketServer,
      sipUsername: sipConfig.sip_username,
      sipDomain,
      projectId: projectId?.substring(0, 8) + '...'
    });
    
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