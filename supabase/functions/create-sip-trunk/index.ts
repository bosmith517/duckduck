// File: create-sip-trunk/index.ts (Corrected Version)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!; // e.g., taurustech.signalwire.com
    
    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) { 
      throw new Error("Server configuration error: Missing SignalWire credentials."); 
    }
    
    const { tenantId, sipUsername, sipPassword, displayName, userId } = await req.json();
    
    if (!tenantId || !sipUsername || !userId) { 
      throw new Error('tenantId, userId, and sipUsername are required.');
    }

    // Validate tenant exists and user belongs to it
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Invalid tenant_id: ${tenantId}. Tenant not found or inactive.`);
    }

    // Verify user belongs to this tenant
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (userError || !userProfile) {
      throw new Error(`User ${userId} does not belong to tenant ${tenantId}.`);
    }

    console.log(`Creating SIP endpoint for tenant: ${tenant.name} (${tenantId})`);
    
    const sipEndpointUrl = `https://${signalwireSpaceUrl}/api/relay/rest/endpoints/sip`;
    const finalPassword = sipPassword || generateSecurePassword();
    
    const sipEndpointRequest = {
      username: sipUsername,
      password: finalPassword,
      caller_id: displayName || sipUsername, // Use caller_id for display name
    };
    
    const credentials = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
    
    const response = await fetch(sipEndpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sipEndpointRequest)
    });
    
    // --- CORRECTED ERROR HANDLING ---
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SignalWire API error:', response.status, errorText);
      // Re-throw the error so the frontend catch block is triggered correctly
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`);
    }
    
    const sipEndpointData = await response.json();
    console.log('SIP Endpoint created successfully on SignalWire:', sipEndpointData);

    // --- CORRECTED DOMAIN/URI CONSTRUCTION ---
    const sipDomain = `${signalwireSpaceUrl.replace(/https?:\/\//, '')}.sip.signalwire.com`;
    const sipUri = `sip:${sipEndpointData.username}@${sipDomain}`;

    const { error: dbError } = await supabase
      .from('sip_configurations')
      .insert({
        tenant_id: tenantId,
        sip_username: sipEndpointData.username,
        sip_password_encrypted: finalPassword, // Note: In production, encrypt this
        sip_domain: sipDomain,
        sip_proxy: sipDomain,
        display_name: sipEndpointData.caller_id,
        signalwire_endpoint_id: sipEndpointData.id,
        signalwire_project_id: signalwireProjectId,
        is_active: true
      });

    if (dbError) {
      console.error('CRITICAL: Error saving SIP credentials to database:', dbError);
      throw new Error(`Failed to save SIP credentials to database: ${dbError.message}`);
    }
    
    console.log('SIP credentials saved to local database successfully.');

    return new Response(JSON.stringify({ 
      success: true,
      sipConfig: {
        username: sipEndpointData.username,
        password: finalPassword,
        domain: sipDomain, // Use corrected domain
        displayName: sipEndpointData.caller_id,
        endpoint_id: sipEndpointData.id
      }
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error(`Error in create-sip-trunk function: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});