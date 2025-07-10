// supabase/functions/purchase-phone-number/index.ts
// CORRECTED VERSION: Uses the correct API Key SID for authentication.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UniversalLogger, loggedDatabaseOperation, loggedExternalApiCall } from '../_shared/universal-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let logger: UniversalLogger | null = null

  try {
    // Step 1: Authenticate the user
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

    // Step 2: Get user's tenant and validate permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only admins can purchase phone numbers (unless from onboarding)
    const requestData = await req.json()
    const { phoneNumber, tenantId, from_onboarding = false } = requestData
    
    if (!from_onboarding && !['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to purchase phone numbers')
    }

    // Step 3: Initialize logger and validate request
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    logger = new UniversalLogger(supabaseAdmin, 'purchase-phone-number', tenantId, user.id)
    logger.setRequestData(requestData)
    
    console.log('Purchase request data:', { phoneNumber, tenantId, from_onboarding })
    
    if (!phoneNumber || !tenantId) {
      throw new Error('Missing phoneNumber or tenantId in the request.')
    }

    // Validate user belongs to the specified tenant (unless from onboarding)
    if (!from_onboarding && userProfile.tenant_id !== tenantId) {
      throw new Error('Cannot purchase phone numbers for other tenants')
    }

    // Step 4: Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await loggedDatabaseOperation(
      logger,
      'tenants',
      'select',
      () => supabaseAdmin
        .from('tenants')
        .select('id, company_name, is_active, signalwire_subproject_id, signalwire_subproject_token, signalwire_subproject_space')
        .eq('id', tenantId)
        .eq('is_active', true)
        .single()
    )

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Step 5: Get SignalWire credentials - prefer tenant's subproject
    let signalwireProjectId: string
    let signalwireApiToken: string
    let signalwireSpaceUrl: string
    let usingSubproject = false

    if (tenant.signalwire_subproject_id && tenant.signalwire_subproject_token) {
      // Use tenant's subproject credentials
      signalwireProjectId = tenant.signalwire_subproject_id
      signalwireApiToken = tenant.signalwire_subproject_token
      signalwireSpaceUrl = tenant.signalwire_subproject_space || Deno.env.get('SIGNALWIRE_SPACE_URL')!
      usingSubproject = true
      console.log('Using tenant subproject for purchase:', signalwireProjectId)
    } else {
      // Fall back to main project credentials
      signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
      signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
      signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
      usingSubproject = false
      console.log('Using main project for purchase (no subproject found)')
    }

    console.log('SignalWire credentials check:', {
      hasProjectId: !!signalwireProjectId,
      hasApiToken: !!signalwireApiToken,
      hasSpaceUrl: !!signalwireSpaceUrl,
      spaceUrl: signalwireSpaceUrl
    })

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 6: Call the SignalWire API to purchase the number
    const purchaseUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const purchaseRequest = { number: phoneNumber }

    const purchasedNumberData = await loggedExternalApiCall(
      logger,
      'SignalWire',
      purchaseUrl,
      purchaseRequest,
      async () => {
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
          console.error(`SignalWire API Error - URL: ${purchaseUrl}`)
          console.error(`SignalWire API Error - Body: ${errorBody}`)
          throw new Error(`SignalWire purchase failed: ${purchaseResponse.status} - ${errorBody}`)
        }
        
        const data = await purchaseResponse.json()
        console.log('Successfully purchased number from SignalWire:', data)
        return data
      }
    )
    
    // Step 7: Save the purchased number to the correct database table
    const phoneData = {
      tenant_id: tenantId,
      number: purchasedNumberData.number || phoneNumber,
      signalwire_number_id: purchasedNumberData.id,
      signalwire_project_id: signalwireProjectId, // Store which project owns this number
      number_type: purchasedNumberData.number_type || 'longcode',
      is_active: true,
      sms_enabled: purchasedNumberData.capabilities?.includes('sms') || false,
      voice_enabled: purchasedNumberData.capabilities?.includes('voice') || true,
      fax_enabled: purchasedNumberData.capabilities?.includes('fax') || false,
      purchased_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const { data: newDbRecord, error: dbError } = await loggedDatabaseOperation(
      logger,
      'signalwire_phone_numbers',
      'insert',
      () => supabaseAdmin
        .from('signalwire_phone_numbers')
        .insert(phoneData)
        .select()
        .single(),
      phoneData
    )

    if (dbError) {
      console.error('DB Insert Error after purchase:', dbError)
      throw new Error(`Failed to save the purchased number to the database: ${dbError.message}`)
    }

    if (!newDbRecord) {
      throw new Error('Phone number was not saved to database - no record returned')
    }

    console.log('Successfully saved purchased number to database:', newDbRecord)

    // Step 8: Return success response
    const responseData = {
      success: true,
      message: `Successfully purchased ${phoneNumber} for ${tenant.company_name}`,
      phone_number: newDbRecord,
      tenant_id: tenantId,
      tenant_name: tenant.company_name,
      signalwire_data: purchasedNumberData
    }

    logger.setResponseData(responseData)
    logger.setSuccess(true)
    await logger.saveLog()

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in purchase-phone-number function:', error.message)
    
    if (logger) {
      logger.setError(error)
      logger.setSuccess(false)
      await logger.saveLog()
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      function: 'purchase-phone-number',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
