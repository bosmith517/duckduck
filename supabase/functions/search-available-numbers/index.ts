// supabase/functions/search-available-numbers/index.ts
// SECURE VERSION: Requires authentication and validates tenant

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

    // Step 2: Get user's tenant information
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only admins can search for new phone numbers
    if (!['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to search for phone numbers')
    }

    // Step 3: Validate tenant exists and is active
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_active')
      .eq('id', userProfile.tenant_id)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Step 4: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 5: Get search criteria from the frontend request
    const { 
      areacode, 
      number_type = 'local', 
      starts_with, 
      contains, 
      ends_with, 
      max_results = 10, 
      region, 
      city 
    } = await req.json()

    // Step 3: Construct the SignalWire API URL with search parameters
    const searchParams = new URLSearchParams()
    if (areacode) searchParams.append('areacode', areacode)
    if (starts_with) searchParams.append('starts_with', starts_with)
    if (contains) searchParams.append('contains', contains)
    if (ends_with) searchParams.append('ends_with', ends_with)
    if (max_results) searchParams.append('max_results', max_results.toString())
    if (region) searchParams.append('region', region)
    if (city) searchParams.append('city', city)
    searchParams.append('number_type', number_type)

    // ** UPDATED TO USE NEW RELAY REST API **
    const apiUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/search?${searchParams.toString()}`

    // Step 6: Make authenticated request to SignalWire
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const signalwireResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    if (!signalwireResponse.ok) {
      const errorBody = await signalwireResponse.text()
      throw new Error(`SignalWire API error: ${signalwireResponse.status} ${errorBody}`)
    }
    
    // Step 7: Parse the response and return filtered results
    const data = await signalwireResponse.json()
    const availableNumbers = data.available_phone_numbers || data.data || []

    console.log(`Found ${availableNumbers.length} available numbers for tenant ${tenant.name}`)

    return new Response(JSON.stringify({
      success: true,
      tenant_id: userProfile.tenant_id,
      tenant_name: tenant.name,
      available_numbers: availableNumbers,
      search_criteria: {
        areacode,
        number_type,
        starts_with,
        contains,
        ends_with,
        region,
        city
      },
      total_count: availableNumbers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in search-available-numbers function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
