// supabase/functions/purchase-phone-number-v2/index.ts
// FIXED VERSION: Uses tenant's subproject credentials when available

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

    // Get user's tenant and validate permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Get request data
    const requestData = await req.json()
    const { phoneNumber, tenantId, from_onboarding = false } = requestData
    
    if (!from_onboarding && !['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to purchase phone numbers')
    }

    if (!phoneNumber || !tenantId) {
      throw new Error('Missing phoneNumber or tenantId in the request.')
    }

    // Validate user belongs to the specified tenant
    if (!from_onboarding && userProfile.tenant_id !== tenantId) {
      throw new Error('Cannot purchase phone numbers for other tenants')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get tenant with SignalWire credentials
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, company_name, is_active, signalwire_subproject_id, signalwire_subproject_token, signalwire_subproject_space')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    console.log('Tenant SignalWire config:', {
      has_subproject: !!tenant.signalwire_subproject_id,
      subproject_id: tenant.signalwire_subproject_id
    })

    // Determine which credentials to use
    let projectId: string
    let apiToken: string
    let spaceUrl: string
    let usingSubproject = false

    if (tenant.signalwire_subproject_id && tenant.signalwire_subproject_token) {
      // Use tenant's subproject credentials
      projectId = tenant.signalwire_subproject_id
      apiToken = tenant.signalwire_subproject_token
      spaceUrl = tenant.signalwire_subproject_space || Deno.env.get('SIGNALWIRE_SPACE_URL')!
      usingSubproject = true
      console.log('Using tenant subproject credentials')
    } else {
      // Fall back to main project credentials
      projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
      apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
      spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
      usingSubproject = false
      console.log('Using main project credentials (no subproject found)')
    }

    if (!projectId || !apiToken || !spaceUrl) {
      throw new Error('SignalWire credentials not available')
    }

    // Purchase the phone number using the appropriate credentials
    const purchaseUrl = `https://${spaceUrl}/api/relay/rest/phone_numbers`
    const auth = btoa(`${projectId}:${apiToken}`)
    const purchaseRequest = { number: phoneNumber }

    console.log(`Attempting to purchase ${phoneNumber} in project ${projectId}`)

    const purchaseResponse = await fetch(purchaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(purchaseRequest)
    })

    if (!purchaseResponse.ok) {
      const errorBody = await purchaseResponse.text()
      console.error(`SignalWire API Error - Status: ${purchaseResponse.status}`)
      console.error(`SignalWire API Error - Body: ${errorBody}`)
      throw new Error(`SignalWire purchase failed: ${purchaseResponse.status} - ${errorBody}`)
    }
    
    const purchasedNumberData = await purchaseResponse.json()
    console.log('Successfully purchased number from SignalWire:', purchasedNumberData)
    
    // Save the purchased number to database
    const phoneData = {
      tenant_id: tenantId,
      number: purchasedNumberData.number || phoneNumber,
      signalwire_number_id: purchasedNumberData.id,
      signalwire_project_id: projectId, // Save which project owns this number
      number_type: purchasedNumberData.number_type || 'longcode',
      is_active: true,
      sms_enabled: purchasedNumberData.capabilities?.includes('sms') || false,
      voice_enabled: purchasedNumberData.capabilities?.includes('voice') || true,
      fax_enabled: purchasedNumberData.capabilities?.includes('fax') || false,
      purchased_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const { data: newDbRecord, error: dbError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .insert(phoneData)
      .select()
      .single()

    if (dbError) {
      console.error('DB Insert Error after purchase:', dbError)
      throw new Error(`Failed to save the purchased number to the database: ${dbError.message}`)
    }

    console.log('Successfully saved purchased number to database')

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully purchased ${phoneNumber} for ${tenant.company_name}`,
      phone_number: newDbRecord,
      tenant_id: tenantId,
      tenant_name: tenant.company_name,
      using_subproject: usingSubproject,
      project_id: projectId,
      signalwire_data: purchasedNumberData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in purchase-phone-number-v2:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      function: 'purchase-phone-number-v2',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})