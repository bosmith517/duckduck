// Debug function to check signalwire_phone_numbers table
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
    console.log('=== DEBUG PHONE NUMBERS TABLE ===');
    
    // Use admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get ALL phone numbers in the table
    const { data: allPhones, error: allError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .limit(20);

    console.log('ALL phone numbers in signalwire_phone_numbers table:');
    console.log('Count:', allPhones?.length || 0);
    console.log('Error:', allError);
    console.log('Data:', allPhones);

    // Get ALL tenants
    const { data: allTenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, company_name, is_active')
      .limit(10);

    console.log('ALL tenants:');
    console.log('Count:', allTenants?.length || 0);
    console.log('Error:', tenantError);
    console.log('Data:', allTenants);

    return new Response(JSON.stringify({ 
      success: true,
      phoneNumbers: allPhones,
      phoneCount: allPhones?.length || 0,
      phoneError: allError,
      tenants: allTenants,
      tenantCount: allTenants?.length || 0,
      tenantError: tenantError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in debug-phone-numbers:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'debug-phone-numbers'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});