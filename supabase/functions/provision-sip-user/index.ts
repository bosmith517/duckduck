// Function to provision SIP user for a tenant on the existing SignalWire endpoint
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
    console.log('Starting SIP user provisioning...');
    
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

    if (profileError || !userProfile?.tenant_id) {
      throw new Error('User profile or tenant not found');
    }

    console.log('Provisioning SIP user for tenant:', userProfile.tenant_id);

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
    
    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured');
    }

    // Check if SIP config already exists
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existingConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    if (existingConfig) {
      console.log('SIP configuration already exists for tenant');
      return new Response(JSON.stringify({
        success: true,
        message: 'SIP configuration already exists',
        sipConfig: {
          username: existingConfig.sip_username,
          domain: existingConfig.sip_domain
        }
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    // Generate unique SIP credentials
    const sipUsername = `tenant-${userProfile.tenant_id.substring(0, 8)}-${Date.now()}`;
    const sipPassword = generateRandomPassword();
    
    // Construct the SIP domain (existing endpoint)
    const last12 = projectId.replace(/-/g, '').slice(-12);
    const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
    
    console.log('Generated credentials:', {
      username: sipUsername,
      domain: sipDomain
    });

    // Try to create SIP user via SignalWire API
    const auth = btoa(`${projectId}:${apiToken}`);
    let userCreated = false;
    let apiResult = null;

    // Different possible API endpoints to try
    const apiUrls = [
      { 
        url: `https://${spaceUrl}/api/relay/rest/sip_endpoints`,
        body: {
          username: sipUsername,
          password: sipPassword,
          codecs: ['OPUS', 'PCMU', 'PCMA'],
          enabled: true
        }
      },
      {
        url: `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/SIP/CredentialLists.json`,
        body: {
          FriendlyName: `TaurusTech-${userProfile.tenant_id.substring(0, 8)}`,
          Username: sipUsername,
          Password: sipPassword
        }
      }
    ];

    for (const { url, body } of apiUrls) {
      console.log('Trying API endpoint:', url);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const responseText = await response.text();
        console.log(`API response (${response.status}):`, responseText);

        if (response.ok) {
          userCreated = true;
          apiResult = { url, status: response.status, response: responseText };
          break;
        } else {
          apiResult = { url, status: response.status, error: responseText };
        }
      } catch (fetchError) {
        console.log(`Network error with ${url}:`, fetchError.message);
      }
    }

    // Store SIP configuration in database regardless of API success
    const { data: sipConfig, error: createError } = await supabaseAdmin
      .from('sip_configurations')
      .insert({
        tenant_id: userProfile.tenant_id,
        sip_username: sipUsername,
        sip_password_encrypted: sipPassword,
        sip_domain: sipDomain,
        sip_proxy: sipDomain,
        signalwire_project_id: projectId,
        is_active: true,
        notes: userCreated 
          ? `Auto-provisioned via API for ${sipDomain}` 
          : `Created in database for ${sipDomain} - may need manual API provisioning`
      })
      .select('*')
      .single();

    if (createError || !sipConfig) {
      throw new Error(`Failed to save SIP configuration: ${createError?.message}`);
    }

    console.log('SIP configuration saved successfully');

    return new Response(JSON.stringify({
      success: true,
      message: userCreated 
        ? 'SIP user provisioned successfully' 
        : 'SIP configuration created - manual provisioning may be needed',
      sipConfig: {
        id: sipConfig.id,
        username: sipConfig.sip_username,
        domain: sipConfig.sip_domain,
        tenantId: sipConfig.tenant_id
      },
      apiResult,
      recommendations: userCreated ? [] : [
        'SIP user may need to be manually added to SignalWire dashboard',
        `Add user "${sipUsername}" with password to endpoint "${sipDomain}"`
      ]
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error('SIP provisioning error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});