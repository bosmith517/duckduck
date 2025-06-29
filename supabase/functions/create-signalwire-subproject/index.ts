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

    // Create subproject via SignalWire API
    const auth = btoa(`${projectId}:${apiToken}`)
    const subprojectUrl = `https://${spaceUrl}/api/fabric/projects`
    
    // Generate clean subproject name
    const cleanCompanyName = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim()
    const subprojectName = `${cleanCompanyName} - ${tenantId.substring(0, 8)}`
    
    const subprojectResponse = await fetch(subprojectUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: subprojectName,
        description: `TradeWorks Pro tenant: ${companyName}`,
        settings: {
          // Inherit parent project settings
          inherit_parent_settings: true,
          // Set reasonable limits for contractor business
          monthly_call_limit: 5000, // 5k minutes/month
          monthly_sms_limit: 10000,  // 10k SMS/month
          concurrent_call_limit: 50  // 50 concurrent calls
        }
      })
    })

    if (!subprojectResponse.ok) {
      const errorText = await subprojectResponse.text()
      console.error('Subproject creation failed:', errorText)
      throw new Error(`Failed to create SignalWire subproject: ${errorText}`)
    }

    const subprojectData = await subprojectResponse.json()
    console.log('Created subproject:', subprojectData.id)

    // Create API token for the subproject
    const tokenUrl = `https://${spaceUrl}/api/fabric/projects/${subprojectData.id}/tokens`
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: `${subprojectName} API Token`,
        scopes: [
          'voice',
          'messaging', 
          'fax',
          'relay'
        ]
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token creation failed:', errorText)
      throw new Error(`Failed to create API token: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('Created API token for subproject')

    // Store subproject credentials in database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        signalwire_subproject_id: subprojectData.id,
        signalwire_subproject_token: tokenData.token,
        signalwire_subproject_space: subprojectData.space_url || spaceUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)

    if (updateError) {
      console.error('Error updating tenant with subproject info:', updateError)
      throw new Error('Failed to save subproject credentials')
    }

    // Create initial SIP configuration for the subproject
    await createInitialSipConfig(
      supabaseAdmin, 
      tenantId, 
      subprojectData.id, 
      tokenData.token, 
      subprojectData.space_url || spaceUrl,
      companyName
    )

    console.log('Subproject setup completed for tenant:', tenantId)

    return new Response(JSON.stringify({
      success: true,
      subproject: {
        id: subprojectData.id,
        name: subprojectData.name,
        space_url: subprojectData.space_url || spaceUrl
      },
      message: 'SignalWire subproject created successfully'
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