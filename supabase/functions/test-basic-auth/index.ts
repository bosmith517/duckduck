// Minimal test function to check basic authentication and environment
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
    console.log('Basic auth test starting...');
    
    // Check environment variables
    const envCheck = {
      SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
      SUPABASE_ANON_KEY: !!Deno.env.get('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      SIGNALWIRE_PROJECT_ID: !!Deno.env.get('SIGNALWIRE_PROJECT_ID'),
      SIGNALWIRE_API_TOKEN: !!Deno.env.get('SIGNALWIRE_API_TOKEN'),
      SIGNALWIRE_SPACE_URL: !!Deno.env.get('SIGNALWIRE_SPACE_URL')
    };
    
    console.log('Environment check:', envCheck);
    
    // Check authentication
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No authorization header',
        environment: envCheck
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    // Try to create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    console.log('Supabase client created');

    // Try to get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Auth result:', { hasUser: !!user, authError: authError?.message });
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authentication failed',
        authError: authError?.message,
        environment: envCheck
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    // Try to get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, email')
      .eq('id', user.id)
      .single();
      
    console.log('Profile result:', { hasProfile: !!userProfile, profileError: profileError?.message });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Basic authentication working',
      user: {
        id: user.id,
        email: user.email
      },
      userProfile: userProfile || null,
      profileError: profileError?.message || null,
      environment: envCheck
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    });

  } catch (error) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 500 
    });
  }
});