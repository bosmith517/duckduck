// File: fix-sip-credentials/index.ts
// Manual SIP credential fix for authentication issues

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

// Helper function to generate a username from tenant ID
function generateUsername(tenantId: string): string {
  // Use 'tenant-' prefix + first 8 chars + timestamp suffix
  const timestamp = Date.now().toString().slice(-6);
  return `tenant-${tenantId.substring(0, 8)}-${timestamp}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') { 
    return new Response('ok', { headers: corsHeaders }); 
  }
  
  try {
    console.log('Starting fix-sip-credentials function');
    
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

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check existing SIP configuration
    const { data: existingConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single();

    if (existingConfig) {
      console.log('Found existing SIP config:', {
        username: existingConfig.sip_username,
        domain: existingConfig.sip_domain
      });

      // Update password with a known simple password for testing
      const testPassword = 'Test123!@#';
      
      const { error: updateError } = await supabaseAdmin
        .from('sip_configurations')
        .update({
          sip_password_encrypted: testPassword,
          notes: 'Password reset by fix-sip-credentials function'
        })
        .eq('id', existingConfig.id);

      if (updateError) {
        throw new Error(`Failed to update SIP password: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'SIP password has been reset',
        sip_username: existingConfig.sip_username,
        sip_domain: existingConfig.sip_domain,
        new_password: testPassword,
        note: 'You can now test with these credentials'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    } else {
      // Create new SIP configuration with simple credentials
      const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID') || 'fbd1a689-45dd-4d2c-97f7-9b70eb096555';
      const last12 = projectId.replace(/-/g, '').slice(-12);
      const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
      const sipUsername = generateUsername(userProfile.tenant_id);
      const sipPassword = 'Test123!@#';

      const { data: newConfig, error: createError } = await supabaseAdmin
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
          notes: 'Created by fix-sip-credentials function'
        })
        .select('*')
        .single();

      if (createError || !newConfig) {
        throw new Error(`Failed to create SIP configuration: ${createError?.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'New SIP configuration created',
        sip_username: newConfig.sip_username,
        sip_domain: newConfig.sip_domain,
        sip_password: sipPassword,
        note: 'You can now test with these credentials'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

  } catch (error) {
    console.error(`Error in fix-sip-credentials: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});