// supabase/functions/provision-signalwire-endpoint/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
}

// Function to generate a secure random password
function generatePassword(length = 16) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }) 
  }

  try {
    // Step 1: Authenticate the user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authentication required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Step 2: Get user's tenant information and validate permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only admins can provision endpoints
    if (!['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to provision SIP endpoints')
    }

    // Step 3: Get request data and validate
    const { user_id, tenant_id } = await req.json();
    if (!user_id || !tenant_id) {
      throw new Error("Missing 'user_id' or 'tenant_id' in the request body.");
    }

    // Validate user can provision for this tenant
    if (userProfile.tenant_id !== tenant_id) {
      throw new Error('Cannot provision endpoints for other tenants')
    }

    // Step 4: Validate tenant and target user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_active')
      .eq('id', tenant_id)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Validate target user belongs to this tenant
    const { data: targetUserProfile, error: targetUserError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, tenant_id, first_name, last_name, email')
      .eq('id', user_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (targetUserError || !targetUserProfile) {
      throw new Error('Target user not found or does not belong to this tenant')
    }

    // Step 5: Check if user already has a SIP configuration
    const { data: existingSipConfig, error: sipCheckError } = await supabaseAdmin
      .from('sip_configurations')
      .select('id, sip_username, is_active')
      .eq('tenant_id', tenant_id)
      .single()

    if (!sipCheckError && existingSipConfig) {
      throw new Error(`Tenant already has a SIP configuration: ${existingSipConfig.sip_username}`)
    }

    // Step 6: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!;

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }

    // Step 7: Generate unique credentials for the new SIP endpoint
    const sip_username = `${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${tenant_id.substring(0, 8)}`; 
    const sip_password = generatePassword();

    // Step 8: Call SignalWire API to create the SIP Endpoint
    const apiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/endpoints/sip`;
    const credentials = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const displayName = `${targetUserProfile.first_name || ''} ${targetUserProfile.last_name || ''}`.trim() || targetUserProfile.email

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: sip_username,
        password: sip_password,
        caller_id: displayName // Use caller_id instead of send_as
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SignalWire API Error: ${response.status} - ${errorText}`);
    }

    const newEndpoint = await response.json();
    console.log('Successfully created SignalWire SIP endpoint:', newEndpoint);

    // Step 9: Save the configuration to the correct database table
    const sipDomain = `${signalwireSpaceUrl.replace(/https?:\/\//, '')}.sip.signalwire.com`;
    
    const { data: newSipConfig, error: dbError } = await supabaseAdmin
      .from('sip_configurations')
      .insert({
        tenant_id: tenant_id,
        sip_username: newEndpoint.username,
        sip_password_encrypted: sip_password, // TODO: Encrypt this in production
        sip_domain: sipDomain,
        sip_proxy: sipDomain,
        display_name: displayName,
        signalwire_endpoint_id: newEndpoint.id,
        signalwire_project_id: signalwireProjectId,
        is_active: true,
        activated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database Error:', dbError);
      
      // Try to cleanup the SignalWire endpoint if database save fails
      try {
        await fetch(`${apiUrl}/${newEndpoint.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${credentials}`,
          }
        });
      } catch (cleanupError) {
        console.error('Failed to cleanup SignalWire endpoint:', cleanupError);
      }
      
      throw new Error(`Database Error: ${dbError.message}`);
    }

    console.log('Successfully saved SIP configuration to database:', newSipConfig);

    // Step 10: Return the newly created configuration
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully provisioned SIP endpoint for ${tenant.name}`,
      sip_configuration: newSipConfig,
      tenant_id: tenant_id,
      tenant_name: tenant.name,
      sip_username: newEndpoint.username,
      sip_domain: sipDomain,
      display_name: displayName
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 201 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
})
