// supabase/functions/create-signalwire-subproject/index.ts
// Creates a dedicated SignalWire subproject for a tenant during onboarding

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting create-signalwire-subproject function')
    
    // Authenticate the user
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

    // Get request data
    const { tenantId, companyName } = await req.json()
    if (!tenantId || !companyName) {
      throw new Error('Missing tenantId or companyName')
    }

    // Get SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    
    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log('Creating subproject for tenant:', tenantId, 'company:', companyName)

    // Create subaccount via SignalWire API
    const auth = btoa(`${projectId}:${apiToken}`)
    const subprojectUrl = `https://${spaceUrl}/api/laml/2010-04-01/Accounts.json`
    
    // Generate clean subproject name
    const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim()
    const friendlyName = `${cleanCompanyName} - ${tenantId.substring(0, 8)}`
    
    // Create form data for the request
    const formData = new URLSearchParams({
      FriendlyName: friendlyName
    })
    
    const subprojectResponse = await fetch(subprojectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString()
    })

    if (!subprojectResponse.ok) {
      const errorText = await subprojectResponse.text()
      console.error('Subproject creation failed:', errorText)
      throw new Error(`Failed to create SignalWire subproject: ${errorText}`)
    }

    const subprojectData = await subprojectResponse.json()
    console.log('Created subaccount:', subprojectData.sid, 'for', subprojectData.friendly_name)

    // For SignalWire subaccounts, we need to get the auth token
    // The subaccount will have its own SID but might need a separate auth token request
    const subprojectId = subprojectData.sid
    const subprojectAuthToken = subprojectData.auth_token || null
    
    // Note: SignalWire subaccounts inherit the parent space URL
    console.log('Subaccount created successfully with SID:', subprojectId)

    // Store subproject credentials in database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        signalwire_subproject_id: subprojectId,
        signalwire_subproject_token: subprojectAuthToken,
        signalwire_subproject_space: spaceUrl,
        subproject_status: 'created',
        subproject_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)

    if (updateError) {
      console.error('Error updating tenant with subproject info:', updateError)
      throw new Error('Failed to save subproject credentials')
    }

    // Create SIP configuration for the subproject
    try {
      const { data: sipData, error: sipError } = await supabase.functions.invoke('create-sip-configuration', {
        body: {
          tenantId: tenantId,
          subprojectId: subprojectId,
          companyName: companyName,
          from_onboarding: true  // Flag to indicate this is from onboarding flow
        }
      })
      
      if (sipError) {
        console.error('Error creating SIP configuration:', sipError)
        // Non-blocking - SIP can be configured later, but log the issue
        console.log('SIP configuration will need to be retried via repair function')
      } else {
        console.log('SIP configuration created successfully:', sipData)
        if (sipData?.has_errors) {
          console.warn('SIP configuration completed with errors - check function logs')
        }
      }
    } catch (sipErr) {
      console.error('Exception creating SIP configuration:', sipErr)
      // Non-blocking - continue with subproject creation success
      console.log('SIP configuration will need to be retried via repair function')
    }

    console.log('Subproject setup completed for tenant:', tenantId)

    return new Response(JSON.stringify({
      success: true,
      subproject: {
        id: subprojectId,
        sid: subprojectId,
        friendly_name: subprojectData.friendly_name,
        space_url: spaceUrl
      },
      message: 'SignalWire subaccount created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-signalwire-subproject:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to create initial SIP configuration for the subproject
async function createInitialSipConfig(
  supabase: any, 
  tenantId: string, 
  subprojectId: string, 
  subprojectToken: string, 
  spaceUrl: string,
  companyName: string
) {
  try {
    console.log('Creating initial SIP endpoint for subproject:', subprojectId)
    
    // Create SIP endpoint in the subproject
    const sipUsername = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}-main`
    const sipPassword = generateRandomPassword(24)
    
    const auth = btoa(`${subprojectId}:${subprojectToken}`)
    const endpointUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints`
    
    const endpointResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: sipUsername,
        password: sipPassword,
        codecs: ['OPUS', 'PCMU', 'PCMA', 'GSM'],
        enabled: true,
        name: `${companyName} Main Endpoint`
      })
    })

    if (!endpointResponse.ok) {
      const errorText = await endpointResponse.text()
      throw new Error(`Failed to create SIP endpoint: ${errorText}`)
    }

    // Store SIP configuration
    const { error: sipError } = await supabase
      .from('sip_configurations')
      .insert({
        tenant_id: tenantId,
        sip_username: sipUsername,
        sip_password_encrypted: sipPassword,
        sip_domain: spaceUrl,
        sip_proxy: spaceUrl,
        signalwire_project_id: subprojectId, // Now points to subproject
        signalwire_subproject_token: subprojectToken,
        is_active: true,
        created_at: new Date().toISOString()
      })

    if (sipError) {
      console.error('Error storing SIP configuration:', sipError)
      throw new Error('Failed to store SIP configuration')
    }

    console.log('Created initial SIP configuration for subproject')
  } catch (error) {
    console.error('Error in createInitialSipConfig:', error)
    throw error
  }
}

// Helper function to generate secure random password
function generateRandomPassword(length = 24): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}