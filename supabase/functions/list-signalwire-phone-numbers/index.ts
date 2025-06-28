import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Step 1: Get the user's access token from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const jwt = authHeader.replace('Bearer ', '')

    // Step 2: Create a Supabase client to validate the user if needed (good practice)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      }
    )

    // Validate the user and get tenant information
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${userError?.message || 'Invalid token'}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's tenant information - CRITICAL for multi-tenant security
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role to validate tenant and get tenant-specific phone numbers
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate tenant exists and is active
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, is_active')
      .eq('id', userProfile.tenant_id)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: 'Invalid or inactive tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Step 3: Prepare SignalWire API credentials from environment variables
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID') // <-- Correction: Get Project ID

    // Check that all required secrets are set
    if (!spaceUrl || !apiToken || !projectId) {
      return new Response(JSON.stringify({ error: 'Server configuration error: SignalWire environment variables are missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // <-- Correction: Use Project ID for username in Basic Auth
    const basicAuth = btoa(`${projectId}:${apiToken}`)

    // Step 4: Make the authenticated request to the SignalWire Relay REST API
    const swRes = await fetch(`https://${spaceUrl}/api/relay/rest/phone_numbers`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
    })

    const responseBody = await swRes.text()
    
    // If SignalWire returns an error, forward it to the client
    if (!swRes.ok) {
      return new Response(JSON.stringify({ error: `SignalWire error: ${swRes.status} - ${responseBody}` }), {
        status: swRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse SignalWire response
    const signalwireData = JSON.parse(responseBody)
    
    console.log('Raw SignalWire API response:', JSON.stringify(signalwireData, null, 2))
    
    // Get tenant's phone numbers from local database for filtering
    const { data: tenantNumbers, error: numbersError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('number, signalwire_number_id, is_active')
      .eq('tenant_id', userProfile.tenant_id)

    console.log('Local database numbers:', { tenantNumbers, numbersError })

    if (numbersError) {
      console.error('Error fetching tenant phone numbers:', numbersError)
    }

    // For now, return ALL SignalWire numbers since we're using it as the source of truth
    // TODO: Implement proper tenant-based filtering once database sync is working
    let filteredNumbers = []
    if (signalwireData.data && Array.isArray(signalwireData.data)) {
      console.log('All SignalWire numbers found:', signalwireData.data.length)
      filteredNumbers = signalwireData.data
    }

    // Sync any missing numbers to local database
    if (filteredNumbers.length > 0) {
      const numbersToSync = filteredNumbers.filter((swNumber: any) => {
        const existsLocally = tenantNumbers?.some(localNum => 
          localNum.signalwire_number_id === swNumber.id
        )
        return !existsLocally
      })

      if (numbersToSync.length > 0) {
        const { error: syncError } = await supabaseAdmin
          .from('signalwire_phone_numbers')
          .upsert(
            numbersToSync.map((num: any) => ({
              tenant_id: userProfile.tenant_id,
              number: num.number,
              signalwire_number_id: num.id,
              number_type: num.number_type || 'longcode',
              is_active: true,
              sms_enabled: num.capabilities?.includes('sms') || false,
              voice_enabled: num.capabilities?.includes('voice') || true,
              fax_enabled: num.capabilities?.includes('fax') || false
            }))
          )

        if (syncError) {
          console.error('Error syncing phone numbers:', syncError)
        }
      }
    }

    // Return tenant-filtered response
    const response = {
      success: true,
      tenant_id: userProfile.tenant_id,
      tenant_name: tenant.name,
      phoneNumbers: filteredNumbers,
      data: filteredNumbers, // For backward compatibility
      total_count: filteredNumbers.length
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    // Catch any unexpected errors during function execution
    return new Response(JSON.stringify({ error: `Function error: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})