// Create or configure SIP endpoint and add users
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
    console.log('Starting create-sip-endpoint function');
    
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

    // Get request data
    const requestData = await req.json();
    const { forceCreate = false } = requestData;

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
    
    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured');
    }

    // Construct the SIP domain (existing endpoint)
    const last12 = projectId.replace(/-/g, '').slice(-12);
    const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
    const endpointName = sipDomain.split('.')[0]; // taurustech-9b70eb096555

    console.log('Working with SIP endpoint:', sipDomain);

    // Check if SIP configuration already exists for this tenant
    let { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    if (sipConfig && !forceCreate) {
      console.log('SIP configuration already exists for tenant:', userProfile.tenant_id);
      
      // Verify the SIP user exists in SignalWire
      const auth = btoa(`${projectId}:${apiToken}`);
      const verifyResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}/users/${sipConfig.sip_username}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });

      if (verifyResponse.ok) {
        return new Response(JSON.stringify({ 
          success: true,
          message: 'SIP configuration already exists and user is active',
          sipConfig: {
            sip_domain: sipConfig.sip_domain,
            sip_username: sipConfig.sip_username,
            is_active: sipConfig.is_active
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        console.log('SIP user not found in SignalWire, will recreate...');
      }
    }

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

    console.log('Creating SIP user:', sipUsername, 'on endpoint:', endpointName);

    // Create SIP endpoint and user via SignalWire REST API using API token
    const auth = btoa(`${projectId}:${apiToken}`);
    
    console.log('Using SignalWire credentials:', { projectId, spaceUrl, hasApiToken: !!apiToken });
    
    // First, check if the SIP endpoint exists using the REST API
    const endpointResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!endpointResponse.ok) {
      console.log('SIP endpoint does not exist, creating it via SignalWire REST API...');
      
      // Create the SIP endpoint using SignalWire REST API with proper format
      // Reference: https://developer.signalwire.com/rest/signalwire-rest/endpoints/space/create-sip-endpoint
      const createEndpointResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: endpointName,
          username: sipUsername,
          password: sipPassword,
          caller_id: '+16308471792', // Use actual phone number
          ciphers: ["AES_CM_128_HMAC_SHA1_80"],
          codecs: ["OPUS", "PCMU", "PCMA"],
          encryption: "optional",
          call_handler: `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-call-control`,
          call_laml_application_id: null,
          call_request_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-call-control`,
          call_request_method: "POST",
          call_fallback_url: null,
          call_fallback_method: "POST",
          call_status_callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/call-status-webhook`,
          call_status_callback_method: "POST",
          deny: [],
          record_calls: false,
          relay: {
            enabled: true,
            connector: endpointName
          }
        })
      });

      if (!createEndpointResponse.ok) {
        const errorText = await createEndpointResponse.text();
        const errorData = await createEndpointResponse.json().catch(() => null);
        console.error('Failed to create SIP endpoint:', createEndpointResponse.status, errorText);
        console.error('Error data:', errorData);
        throw new Error(`Failed to create SIP endpoint: ${createEndpointResponse.status} ${errorText}`);
      }

      const endpointData = await createEndpointResponse.json();
      console.log('✅ SIP endpoint created successfully in SignalWire:', endpointData);
    } else {
      const existingData = await endpointResponse.json();
      console.log('✅ SIP endpoint already exists in SignalWire:', existingData);
    }

    // Create the SIP user with email-based username
    console.log('Creating SIP user with username:', sipUsername, 'on domain:', sipDomain);
    
    const createUserResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: sipUsername,
        password: sipPassword,
        caller_id: '+16308471792', // Use actual phone number
        enabled: true
      })
    });

    let sipUserCreated = false;
    if (createUserResponse.ok) {
      const userData = await createUserResponse.json();
      console.log('SIP user created successfully in SignalWire:', userData);
      sipUserCreated = true;
    } else {
      const errorText = await createUserResponse.text();
      console.log('Failed to create SIP user in SignalWire:', createUserResponse.status, errorText);
      
      // Check if user already exists
      if (createUserResponse.status === 409 || errorText.includes('already exists')) {
        console.log('SIP user already exists, this is OK');
        sipUserCreated = true;
      } else {
        console.log('SIP user creation failed, may need manual setup');
        sipUserCreated = false;
      }
    }

    // Store/update SIP configuration in database
    const sipConfigData = {
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
      notes: `${sipUserCreated ? 'Auto-created' : 'Manual creation needed'} - ${new Date().toISOString()}`
    };

    if (sipConfig) {
      // Update existing
      const { data: updatedConfig, error: updateError } = await supabaseAdmin
        .from('sip_configurations')
        .update(sipConfigData)
        .eq('id', sipConfig.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update SIP configuration: ${updateError.message}`);
      }
      sipConfig = updatedConfig;
    } else {
      // Create new
      const { data: newConfig, error: createError } = await supabaseAdmin
        .from('sip_configurations')
        .insert(sipConfigData)
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create SIP configuration: ${createError.message}`);
      }
      sipConfig = newConfig;
    }

    console.log('SIP configuration saved to database');

    return new Response(JSON.stringify({ 
      success: true,
      message: sipUserCreated ? 'SIP endpoint and user created successfully' : 'SIP configuration created, manual user setup needed in SignalWire',
      sipConfig: {
        sip_domain: sipConfig.sip_domain,
        sip_username: sipConfig.sip_username,
        is_active: sipConfig.is_active,
        user_created_in_signalwire: sipUserCreated
      },
      manual_setup_needed: !sipUserCreated,
      instructions: !sipUserCreated ? 
        `Add SIP user "${sipUsername}" with password to SignalWire endpoint "${endpointName}"` : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in create-sip-endpoint:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'create-sip-endpoint'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to generate a random password
function generateRandomPassword(length = 24): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}