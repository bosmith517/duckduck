// Debug function to help troubleshoot SignalWire integration
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
    console.log('Debug function starting...');
    
    // Check environment variables
    const envVars = {
      SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
      SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      SIGNALWIRE_PROJECT_ID: !!Deno.env.get('SIGNALWIRE_PROJECT_ID'),
      SIGNALWIRE_API_TOKEN: !!Deno.env.get('SIGNALWIRE_API_TOKEN'),
      SIGNALWIRE_SPACE_URL: !!Deno.env.get('SIGNALWIRE_SPACE_URL')
    };
    
    console.log('Environment variables status:', envVars);
    
    // Check authentication
    const authHeader = req.headers.get('authorization');
    const hasAuth = !!authHeader;
    
    let userInfo = null;
    let userProfileInfo = null;
    let tenantInfo = null;
    let authError = null;
    
    if (hasAuth) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          authError = error.message;
        } else if (user) {
          userInfo = {
            id: user.id,
            email: user.email,
            hasUserMetadata: !!user.user_metadata,
            tenantIdInMetadata: user.user_metadata?.tenant_id || 'not set'
          };
          
          // Try to get user profile
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('tenant_id, email')
            .eq('id', user.id)
            .single();
            
          if (profileError) {
            userProfileInfo = { error: profileError.message };
          } else {
            userProfileInfo = profile;
            
            // Try to get tenant info
            if (profile.tenant_id) {
              const supabaseAdmin = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
              );
              
              const { data: tenant, error: tenantError } = await supabaseAdmin
                .from('tenants')
                .select('id, signalwire_subproject_id, subproject_status')
                .eq('id', profile.tenant_id)
                .single();
                
              if (tenantError) {
                tenantInfo = { error: tenantError.message };
              } else {
                tenantInfo = tenant;
              }
            }
          }
        }
      } catch (err) {
        authError = err.message;
      }
    }
    
    // Check SIP configurations table
    let sipConfigInfo = null;
    if (userProfileInfo && !userProfileInfo.error && userProfileInfo.tenant_id) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        const { data: sipConfigs, error: sipError } = await supabaseAdmin
          .from('sip_configurations')
          .select('id, tenant_id, sip_username, is_active')
          .eq('tenant_id', userProfileInfo.tenant_id);
          
        if (sipError) {
          sipConfigInfo = { error: sipError.message };
        } else {
          sipConfigInfo = {
            count: sipConfigs?.length || 0,
            configs: sipConfigs?.map(c => ({
              id: c.id,
              username: c.sip_username,
              isActive: c.is_active
            })) || []
          };
        }
      } catch (err) {
        sipConfigInfo = { error: err.message };
      }
    }
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: envVars,
      authentication: {
        hasAuthHeader: hasAuth,
        authError,
        userInfo,
        userProfileInfo,
        tenantInfo
      },
      sipConfigurations: sipConfigInfo,
      signalwireSpaceUrl: Deno.env.get('SIGNALWIRE_SPACE_URL') || 'not set',
      signalwireProjectId: Deno.env.get('SIGNALWIRE_PROJECT_ID') || 'not set'
    };
    
    console.log('Debug info collected:', debugInfo);
    
    return new Response(JSON.stringify(debugInfo, null, 2), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error('Debug function error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, null, 2), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});