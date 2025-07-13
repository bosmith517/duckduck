// Check SIP endpoint configuration in SignalWire
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

    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    
    const result = {
      sipConfig: {
        username: sipConfig.sip_username,
        domain: sipConfig.sip_domain,
        endpoint_id: sipConfig.signalwire_endpoint_id,
        has_password: !!sipConfig.sip_password_encrypted
      },
      signalwireEndpoint: null as any,
      phoneNumbers: [] as any[],
      issues: [] as string[],
      recommendations: [] as string[]
    }
    
    // Get SignalWire endpoint details if ID exists
    if (sipConfig.signalwire_endpoint_id) {
      const auth = btoa(`${projectId}:${apiToken}`)
      const endpointUrl = `https://${spaceUrl}/api/relay/rest/endpoints/sip/${sipConfig.signalwire_endpoint_id}`
      
      console.log('Fetching endpoint:', endpointUrl)
      
      const endpointResponse = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      })
      
      if (endpointResponse.ok) {
        const endpoint = await endpointResponse.json()
        result.signalwireEndpoint = {
          id: endpoint.id,
          username: endpoint.username,
          caller_id: endpoint.caller_id,
          send_as: endpoint.send_as,
          status: endpoint.status
        }
        
        // Check for issues
        if (!endpoint.send_as) {
          result.issues.push('SIP endpoint has no phone number configured for outbound calls')
          result.recommendations.push('Run "Update SIP Phone Number" to fix this')
        }
        
        if (endpoint.username !== sipConfig.sip_username) {
          result.issues.push(`Username mismatch: DB has "${sipConfig.sip_username}", SignalWire has "${endpoint.username}"`)
          result.recommendations.push('Consider recreating the SIP endpoint')
        }
      } else {
        const errorText = await endpointResponse.text()
        console.error('Failed to fetch endpoint:', errorText)
        result.issues.push(`SignalWire endpoint ID exists in DB but not found in SignalWire: ${errorText}`)
        result.recommendations.push('Run "Create/Fix SIP Endpoint" to recreate')
      }
    } else {
      result.issues.push('No SignalWire endpoint ID stored in database')
      result.recommendations.push('Run "Create/Fix SIP Endpoint" to create one')
    }
    
    // Get active phone numbers
    const { data: phoneNumbers } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('number, is_active')
      .eq('tenant_id', userProfile.tenant_id)
      .order('is_active', { ascending: false })
      
    result.phoneNumbers = phoneNumbers || []
    
    if (result.phoneNumbers.length === 0) {
      result.issues.push('No phone numbers found for tenant')
      result.recommendations.push('Purchase a phone number for your tenant')
    } else if (!result.phoneNumbers.find(p => p.is_active)) {
      result.issues.push('No active phone number set for tenant')
      result.recommendations.push('Set one of your phone numbers as active')
    }
    
    // Overall status
    const hasIssues = result.issues.length > 0
    const status = hasIssues ? 'issues_found' : 'configured_correctly'
    
    return new Response(JSON.stringify({
      success: true,
      status,
      ...result,
      summary: hasIssues 
        ? `Found ${result.issues.length} issue(s) with your SIP configuration`
        : 'SIP endpoint is configured correctly'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in check-sip-endpoint-config:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})