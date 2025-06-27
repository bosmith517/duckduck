// File: supabase/functions/create-sip-configuration/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// --- CORS headers definition ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper function to generate a random password ---
function generatePassword(length = 24) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0, n = charset.length; i < n; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- 1. Create Supabase client and get secrets---
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get all required SignalWire credentials from secrets
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!;
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!;
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!; // e.g., your-space.signalwire.com
    
    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
        throw new Error("Server configuration error: Missing SignalWire secrets.");
    }

    // --- 2. Get the new tenant record from the request body ---
    const payload = await req.json();
    const newTenantRecord = payload.record;

    if (!newTenantRecord || !newTenantRecord.id) {
      throw new Error("Invalid tenant record received. 'id' is required.");
    }

    const tenantId = newTenantRecord.id;
    const companyName = newTenantRecord.company_name || `tenant-${tenantId.substring(0, 8)}`;
    
    // --- 3. Generate SIP Configuration Details ---
    // CORRECTED: Dynamically creating the domain and proxy from your space URL.
    const sipDomain = `sip.${signalwireSpaceUrl}`;
    const sipProxy = `sip.${signalwireSpaceUrl};transport=tls`; // Standard format for secure proxy
    const sipUsername = `tradeworks-${companyName.replace(/\s+/g, '-')}`;
    const sipPassword = generatePassword();
    

    // --- 4. Insert the new configuration into the sip_configurations table ---
    const { data: newSipConfig, error: insertError } = await supabaseClient
      .from('sip_configurations')
      .insert({
        tenant_id: tenantId,
        sip_username: sipUsername,
        sip_password_encrypted: sipPassword,
        sip_domain: sipDomain, // Using dynamic value
        sip_proxy: sipProxy,     // Using dynamic value
        signalwire_project_id: signalwireProjectId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting SIP configuration:', insertError);
      throw insertError; 
    }
    console.log('Successfully created base SIP configuration:', newSipConfig.id);

    // --- 5. Fetch an available phone number from SignalWire ---
    const phoneApiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers`;
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);
    
    const phoneResponse = await fetch(phoneApiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    });

    if (!phoneResponse.ok) {
        console.error("Could not fetch phone numbers from SignalWire:", await phoneResponse.text());
    } else {
        const phoneData = await phoneResponse.json();
        if (phoneData.data && phoneData.data.length > 0) {
            const primaryNumber = phoneData.data[0].number;
            console.log(`Found available phone number: ${primaryNumber}`);

            // --- 6. Update the SIP configuration with the phone number ---
            const { error: updateError } = await supabaseClient
                .from('sip_configurations')
                .update({ primary_phone_number: primaryNumber })
                .eq('id', newSipConfig.id); 

            if (updateError) {
                console.error("Failed to update SIP config with phone number:", updateError);
            } else {
                console.log("Successfully assigned phone number to SIP configuration.");
            }
        } else {
            console.log("No available phone numbers found in SignalWire account.");
        }
    }

    // --- 7. Return a success response ---
    return new Response(JSON.stringify({ success: true, data: newSipConfig }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('An unexpected error occurred:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
