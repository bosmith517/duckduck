// supabase/functions/release-signalwire-phone-number/index.ts
// SECURE VERSION: Multi-tenant with authentication and proper validation

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

    // Step 2: Get user's tenant information and validate permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only admins can release phone numbers
    if (!['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to release phone numbers')
    }

    // Step 3: Get request data
    const { phoneNumberId, tenantId } = await req.json()
    if (!phoneNumberId) {
      throw new Error('Missing phoneNumberId in the request.')
    }

    // Validate user belongs to the specified tenant (if provided)
    const finalTenantId = tenantId || userProfile.tenant_id
    if (userProfile.tenant_id !== finalTenantId) {
      throw new Error('Cannot release phone numbers for other tenants')
    }

    // Step 4: Validate tenant and phone number ownership
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_active')
      .eq('id', finalTenantId)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Step 5: Validate phone number belongs to this tenant
    const { data: phoneNumber, error: phoneError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('id, number, signalwire_number_id, tenant_id, is_active')
      .eq('signalwire_number_id', phoneNumberId)
      .eq('tenant_id', finalTenantId)
      .single()

    if (phoneError || !phoneNumber) {
      throw new Error('Phone number not found or does not belong to your organization')
    }

    if (!phoneNumber.is_active) {
      throw new Error('Phone number is already inactive')
    }

    // Step 6: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 7: Release the phone number via SignalWire API
    const releaseUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/${phoneNumberId}`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const releaseResponse = await fetch(releaseUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    if (!releaseResponse.ok) {
      const errorBody = await releaseResponse.text()
      throw new Error(`SignalWire release failed: ${releaseResponse.status} - ${errorBody}`)
    }
    
    console.log(`Successfully released phone number ${phoneNumber.number} from SignalWire`)

    // Step 8: Update database record to mark as inactive
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .update({
        is_active: false,
        released_at: new Date().toISOString()
      })
      .eq('id', phoneNumber.id)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      throw new Error(`Failed to update database record: ${updateError.message}`)
    }

    console.log(`Successfully updated database record for released number: ${phoneNumber.number}`)

    // Step 9: Return success response
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully released phone number ${phoneNumber.number} for ${tenant.name}`,
      phone_number: updatedRecord,
      tenant_id: finalTenantId,
      tenant_name: tenant.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in release-signalwire-phone-number function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})