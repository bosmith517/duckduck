// Update SIP endpoint with phone number for outbound calls
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
    // Authenticate user
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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id) {
      throw new Error('User profile not found')
    }

    // Admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user's SIP configuration
    const { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!sipConfig) {
      throw new Error('No SIP configuration found for user')
    }

    // Get active phone number for the tenant
    const { data: phoneNumbers } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('number')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .limit(1)
      
    const activePhoneNumber = phoneNumbers?.[0]?.number
    if (!activePhoneNumber) {
      throw new Error('No active phone number found for tenant')
    }

    console.log('Updating SIP endpoint with phone number:', activePhoneNumber)

    // Update SIP endpoint in SignalWire
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    if (!sipConfig.signalwire_endpoint_id) {
      throw new Error('SIP endpoint ID not found in configuration')
    }

    const auth = btoa(`${projectId}:${apiToken}`)
    const updateUrl = `https://${spaceUrl}/api/relay/rest/endpoints/sip/${sipConfig.signalwire_endpoint_id}`
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        send_as: activePhoneNumber
      })
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      throw new Error(`Failed to update SIP endpoint: ${errorText}`)
    }

    const result = await updateResponse.json()
    console.log('SIP endpoint updated:', result)

    return new Response(JSON.stringify({
      success: true,
      message: 'SIP endpoint updated with phone number',
      phone_number: activePhoneNumber,
      endpoint_id: sipConfig.signalwire_endpoint_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in update-sip-endpoint-phone:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})