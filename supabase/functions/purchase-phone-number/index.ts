// supabase/functions/purchase-phone-number/index.ts
// Simplified version without logger dependency

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

    // Step 3: Initialize admin client and validate request
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    console.log('Purchase request data:', { phoneNumber, tenantId, from_onboarding })
    
    if (!phoneNumber || !tenantId) {
      throw new Error('Missing phoneNumber or tenantId in the request.')
    }

    // Validate user belongs to the specified tenant (unless from onboarding)
    if (!from_onboarding && userProfile.tenant_id !== tenantId) {
      throw new Error('Cannot purchase phone numbers for other tenants')
    }

    // Step 4: Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, company_name, is_active')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Step 5: Get SignalWire credentials - always use main project
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    console.log('Using main SignalWire project for purchase')

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

    console.log('Making SignalWire purchase request:', {
      url: purchaseUrl,
      number: phoneNumber
    })

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
    
    const purchasedNumberData = await purchaseResponse.json()
    console.log('Successfully purchased number from SignalWire:', purchasedNumberData)
    
    // Step 7: Save the purchased number to the correct database table
    // Map SignalWire number types to our database constraints
    let dbNumberType = 'local' // default
    if (purchasedNumberData.number_type === 'toll-free' || purchasedNumberData.number_type === 'tollfree') {
      dbNumberType = 'toll-free'
    } else if (purchasedNumberData.number_type === 'international') {
      dbNumberType = 'international'
    }
    
    const phoneData = {
      tenant_id: tenantId,
      number: purchasedNumberData.number || phoneNumber,
      signalwire_number_id: purchasedNumberData.id,
      number_type: dbNumberType,
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

    if (!newDbRecord) {
      throw new Error('Phone number was not saved to database - no record returned')
    }

    console.log('Successfully saved purchased number to database:', newDbRecord)

    // Step 8: Log the purchase in function_execution_logs
    try {
      await supabaseAdmin
        .from('function_execution_logs')
        .insert({
          function_name: 'purchase-phone-number',
          tenant_id: tenantId,
          user_id: user.id,
          request_data: requestData,
          response_data: {
            success: true,
            phone_number: newDbRecord,
            signalwire_data: purchasedNumberData
          },
          success: true,
          execution_time: 0, // We're not tracking time in this simplified version
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('Failed to log function execution:', logError)
      // Don't fail the request just because logging failed
    }

    // Step 9: Return success response
    const responseData = {
      success: true,
      message: `Successfully purchased ${phoneNumber} for ${tenant.company_name}`,
      phone_number: newDbRecord,
      tenant_id: tenantId,
      tenant_name: tenant.company_name,
      signalwire_data: purchasedNumberData
    }

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in purchase-phone-number function:', error.message)
    
    // Try to log the error
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      
      await supabaseAdmin
        .from('function_execution_logs')
        .insert({
          function_name: 'purchase-phone-number',
          error_message: error.message,
          success: false,
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
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