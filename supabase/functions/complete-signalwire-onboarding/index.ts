// Complete SignalWire onboarding: Create subproject, API token, SIP endpoint, and purchase phone number
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
    console.log('=== STARTING COMPLETE SIGNALWIRE ONBOARDING ===');
    
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
    const { companyName, areaCode = '630' } = requestData;

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get main SignalWire credentials
    const mainProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID');
    const mainApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN');
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL');
    
    if (!mainProjectId || !mainApiToken || !spaceUrl) {
      throw new Error('SignalWire main credentials not configured');
    }

    console.log('Using main SignalWire credentials:', { mainProjectId, spaceUrl });

    // Step 1: Create SignalWire subproject
    console.log('Step 1: Creating SignalWire subproject...');
    const subprojectUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${mainProjectId}/Projects.json`;
    const mainAuth = btoa(`${mainProjectId}:${mainApiToken}`);

    const subprojectResponse = await fetch(subprojectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${mainAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        FriendlyName: `${companyName || 'Tenant'} - ${userProfile.tenant_id.substring(0, 8)}`
      })
    });

    if (!subprojectResponse.ok) {
      const errorText = await subprojectResponse.text();
      console.error('Failed to create subproject:', errorText);
      throw new Error(`Failed to create SignalWire subproject: ${subprojectResponse.status} ${errorText}`);
    }

    const subprojectData = await subprojectResponse.json();
    const subprojectId = subprojectData.account_sid;
    console.log('✅ Subproject created:', subprojectId);

    // Step 2: Create API token for the subproject
    console.log('Step 2: Creating API token for subproject...');
    const tokenUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${subprojectId}/Tokens.json`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${mainAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        FriendlyName: `${companyName || 'Tenant'} API Token`
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to create API token:', errorText);
      throw new Error(`Failed to create API token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const subprojectApiToken = tokenData.token;
    console.log('✅ API token created for subproject');

    // Step 3: Create SIP endpoint with username/password
    console.log('Step 3: Creating SIP endpoint...');
    
    // Generate SIP username from email
    const emailPrefix = user.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const sipUsername = `${emailPrefix}_${userProfile.tenant_id.substring(0, 8)}`;
    const sipPassword = generateRandomPassword();
    
    // Construct SIP domain
    const last12 = subprojectId.replace(/-/g, '').slice(-12);
    const sipDomain = `taurustech-${last12}.sip.signalwire.com`;
    const endpointName = sipDomain.split('.')[0];

    const subprojectAuth = btoa(`${subprojectId}:${subprojectApiToken}`);
    
    const sipEndpointResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${subprojectAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: endpointName,
        username: sipUsername,
        password: sipPassword,
        caller_id: null, // Will be set after phone number purchase
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

    if (!sipEndpointResponse.ok) {
      const errorText = await sipEndpointResponse.text();
      console.error('Failed to create SIP endpoint:', errorText);
      throw new Error(`Failed to create SIP endpoint: ${sipEndpointResponse.status} ${errorText}`);
    }

    const sipEndpointData = await sipEndpointResponse.json();
    console.log('✅ SIP endpoint created:', sipEndpointData);

    // Step 4: Purchase phone number
    console.log('Step 4: Purchasing phone number...');
    
    // Search for available phone numbers
    const searchUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${subprojectId}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&Limit=1`;
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${subprojectAuth}`,
        'Accept': 'application/json'
      }
    });
    
    let phoneNumberToPurchase;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.available_phone_numbers && searchData.available_phone_numbers.length > 0) {
        phoneNumberToPurchase = searchData.available_phone_numbers[0].phone_number;
      }
    }

    // Fallback: search without area code restriction
    if (!phoneNumberToPurchase) {
      console.log('No numbers in specified area code, searching nationwide...');
      const fallbackUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${subprojectId}/AvailablePhoneNumbers/US/Local.json?Limit=1`;
      
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${subprojectAuth}`,
          'Accept': 'application/json'
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.available_phone_numbers && fallbackData.available_phone_numbers.length > 0) {
          phoneNumberToPurchase = fallbackData.available_phone_numbers[0].phone_number;
        }
      }
    }

    if (!phoneNumberToPurchase) {
      throw new Error('No phone numbers available for purchase');
    }

    // Purchase the phone number
    const purchaseUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${subprojectId}/IncomingPhoneNumbers.json`;
    
    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${subprojectAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        PhoneNumber: phoneNumberToPurchase,
        FriendlyName: `${companyName || 'Tenant'} Main Number`
      })
    });

    if (!purchaseResponse.ok) {
      const errorText = await purchaseResponse.text();
      console.error('Failed to purchase phone number:', errorText);
      throw new Error(`Failed to purchase phone number: ${purchaseResponse.status} ${errorText}`);
    }

    const purchaseData = await purchaseResponse.json();
    const purchasedPhoneNumber = purchaseData.phone_number;
    console.log('✅ Phone number purchased:', purchasedPhoneNumber);

    // Step 5: Update SIP endpoint with caller ID
    console.log('Step 5: Updating SIP endpoint with caller ID...');
    
    const updateEndpointResponse = await fetch(`https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${subprojectAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        caller_id: purchasedPhoneNumber
      })
    });

    if (updateEndpointResponse.ok) {
      console.log('✅ SIP endpoint updated with caller ID');
    } else {
      console.log('⚠️ Failed to update SIP endpoint caller ID, but continuing...');
    }

    // Step 6: Save all records to database
    console.log('Step 6: Saving records to database...');

    // Save SIP configuration
    const sipConfigData = {
      tenant_id: userProfile.tenant_id,
      sip_username: sipUsername,
      sip_password_encrypted: sipPassword,
      sip_domain: sipDomain,
      sip_proxy: sipDomain,
      signalwire_project_id: subprojectId,
      signalwire_api_token: subprojectApiToken,
      primary_phone_number: purchasedPhoneNumber,
      is_active: true,
      service_plan: 'basic',
      monthly_rate: 29.99,
      per_minute_rate: 0.02,
      included_minutes: 1000,
      notes: `Complete onboarding - ${new Date().toISOString()}`
    };

    const { data: sipConfig, error: sipConfigError } = await supabaseAdmin
      .from('sip_configurations')
      .insert(sipConfigData)
      .select()
      .single();

    if (sipConfigError) {
      console.error('Failed to save SIP configuration:', sipConfigError);
      throw new Error(`Failed to save SIP configuration: ${sipConfigError.message}`);
    }

    console.log('✅ SIP configuration saved to database');

    // Save phone number record
    const phoneNumberData = {
      tenant_id: userProfile.tenant_id,
      phone_number: purchasedPhoneNumber,
      signalwire_number_id: purchaseData.sid,
      signalwire_project_id: subprojectId,
      number_type: 'longcode',
      is_active: true,
      sms_enabled: true,
      voice_enabled: true,
      fax_enabled: false,
      purchased_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const { data: phoneRecord, error: phoneError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .insert(phoneNumberData)
      .select()
      .single();

    if (phoneError) {
      console.error('Failed to save phone number:', phoneError);
      throw new Error(`Failed to save phone number: ${phoneError.message}`);
    }

    console.log('✅ Phone number record saved to database');

    // Step 7: Update tenant with SignalWire project info
    const { error: tenantUpdateError } = await supabaseAdmin
      .from('tenants')
      .update({
        signalwire_subproject_id: subprojectId,
        signalwire_subproject_token: subprojectApiToken,
        signalwire_subproject_space: spaceUrl,
        primary_phone_number: purchasedPhoneNumber,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userProfile.tenant_id);

    if (tenantUpdateError) {
      console.error('Failed to update tenant:', tenantUpdateError);
      // Don't throw error here, just log it
    } else {
      console.log('✅ Tenant updated with SignalWire info');
    }

    console.log('=== SIGNALWIRE ONBOARDING COMPLETED SUCCESSFULLY ===');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Complete SignalWire onboarding completed successfully',
      data: {
        subproject_id: subprojectId,
        phone_number: purchasedPhoneNumber,
        sip_domain: sipDomain,
        sip_username: sipUsername,
        endpoint_name: endpointName
      },
      records: {
        sip_configuration: sipConfig,
        phone_number: phoneRecord
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in complete-signalwire-onboarding:', error.message);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'complete-signalwire-onboarding'
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