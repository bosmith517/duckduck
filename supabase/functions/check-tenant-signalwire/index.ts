// File: check-tenant-signalwire/index.ts
// Debug function to check tenant's SignalWire configuration

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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.tenant_id) {
      throw new Error('User profile not found');
    }

    // Use service role to get full tenant data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get tenant SignalWire configuration
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', userProfile.tenant_id)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Tenant not found');
    }

    // Get SIP configurations
    const { data: sipConfigs } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id);

    // Get phone numbers
    const { data: phoneNumbers } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id);

    // Check environment variables
    const envConfig = {
      has_main_project_id: !!Deno.env.get('SIGNALWIRE_PROJECT_ID'),
      has_main_api_token: !!Deno.env.get('SIGNALWIRE_API_TOKEN'),
      has_space_url: !!Deno.env.get('SIGNALWIRE_SPACE_URL'),
      main_project_id: Deno.env.get('SIGNALWIRE_PROJECT_ID')?.substring(0, 8) + '...',
      space_url: Deno.env.get('SIGNALWIRE_SPACE_URL')
    };

    // Test which credentials would be used
    let credentialsUsed = 'unknown';
    if (tenant.signalwire_subproject_id && tenant.signalwire_subproject_token) {
      credentialsUsed = 'tenant_subproject';
    } else if (Deno.env.get('SIGNALWIRE_PROJECT_ID') && Deno.env.get('SIGNALWIRE_API_TOKEN')) {
      credentialsUsed = 'main_project';
    } else {
      credentialsUsed = 'none_available';
    }

    return new Response(JSON.stringify({
      tenant: {
        id: tenant.id,
        name: tenant.company_name,
        has_subproject_id: !!tenant.signalwire_subproject_id,
        has_subproject_token: !!tenant.signalwire_subproject_token,
        has_subproject_space: !!tenant.signalwire_subproject_space,
        subproject_id: tenant.signalwire_subproject_id?.substring(0, 8) + '...',
        subproject_status: tenant.subproject_status,
        business_info: tenant.business_info
      },
      sip_configurations: sipConfigs?.map(s => ({
        id: s.id,
        sip_username: s.sip_username,
        sip_domain: s.sip_domain,
        is_active: s.is_active,
        has_password: !!s.sip_password_encrypted,
        signalwire_project_id: s.signalwire_project_id?.substring(0, 8) + '...'
      })),
      phone_numbers: phoneNumbers?.map(p => ({
        number: p.number,
        is_active: p.is_active,
        signalwire_number_id: p.signalwire_number_id
      })),
      environment_config: envConfig,
      credentials_decision: credentialsUsed,
      debug_info: {
        would_use_subproject: !!(tenant.signalwire_subproject_id && tenant.signalwire_subproject_token),
        reason: !tenant.signalwire_subproject_id ? 'No subproject ID' : 
                !tenant.signalwire_subproject_token ? 'No subproject token' : 
                'Has both subproject credentials'
      }
    }, null, 2), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in check-tenant-signalwire: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});