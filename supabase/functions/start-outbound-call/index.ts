// supabase/functions/start-outbound-call/index.ts
// SECURE VERSION: Multi-tenant with authentication and proper call logging

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

    // Step 2: Get user's tenant information and validate role
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Only agents and admins can make calls
    if (!['admin', 'agent', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions to make calls')
    }

    // Step 3: Get request data and validate
    const { to, from, tenantId, contactId } = await req.json()
    if (!to || !from) {
      throw new Error('Missing "to" or "from" phone numbers in the request.')
    }

    // Validate user belongs to the specified tenant (if provided)
    if (tenantId && userProfile.tenant_id !== tenantId) {
      throw new Error('Cannot make calls for other tenants')
    }

    const finalTenantId = tenantId || userProfile.tenant_id

    // Step 4: Validate tenant and get phone number permissions
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

    // Step 5: Validate the "from" number belongs to this tenant
    const { data: fromNumber, error: numberError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('id, number, is_active, voice_enabled')
      .eq('tenant_id', finalTenantId)
      .eq('number', from)
      .eq('is_active', true)
      .eq('voice_enabled', true)
      .single()

    if (numberError || !fromNumber) {
      throw new Error(`Phone number ${from} is not available for your organization or not enabled for voice calls`)
    }

    // Step 6: Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    const baseFunctionUrl = Deno.env.get('SUPABASE_URL')!

    if (!signalwireProjectId || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    // Step 7: Log the call attempt in database BEFORE making the call
    const agentName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || user.email

    const { data: callRecord, error: logError } = await supabaseAdmin
      .from('calls')
      .insert({
        tenant_id: finalTenantId,
        user_id: user.id,
        from_number: from,
        to_number: to,
        direction: 'outbound',
        status: 'dialing',
        contact_id: contactId || null
      })
      .select()
      .single()

    if (logError) {
      console.error('Error logging call:', logError)
      throw new Error('Failed to log call in database')
    }

    // Step 8: For browser-based calling, we can optionally use SIP configuration
    // But for now, let's make it work without requiring SIP config
    const { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('sip_username, sip_password_encrypted')
      .eq('tenant_id', finalTenantId)
      .eq('is_active', true)
      .single()

    // Create a simple LaML URL - use SIP endpoint if available, otherwise use basic handler
    const callHandlerUrl = sipConfig?.sip_username 
      ? `${baseFunctionUrl}/functions/v1/handle-call-control?agent=${encodeURIComponent(sipConfig.sip_username)}`
      : `${baseFunctionUrl}/functions/v1/handle-call-control`

    console.log('SIP config:', sipConfig ? 'Found' : 'Not found')
    console.log('Call handler URL:', callHandlerUrl)

    // Step 9: Initiate the call via SignalWire
    const callUrl = `https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireProjectId}/Calls.json`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`);

    const callResponse = await fetch(callUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Url: callHandlerUrl,
      })
    })

    if (!callResponse.ok) {
      const errorBody = await callResponse.text()
      
      // Update call record to failed status
      await supabaseAdmin
        .from('calls')
        .update({ 
          status: 'failed',
          ended_at: new Date().toISOString()
        })
        .eq('id', callRecord.id)

      throw new Error(`SignalWire call initiation failed: ${callResponse.status} - ${errorBody}`)
    }
    
    const callData = await callResponse.json()
    
    // Step 10: Update call record with SignalWire call SID
    const { error: updateError } = await supabaseAdmin
      .from('calls')
      .update({ 
        call_sid: callData.sid,
        status: 'ringing'
      })
      .eq('id', callRecord.id)

    if (updateError) {
      console.error('Error updating call record:', updateError)
    }

    console.log(`Successfully initiated call from ${from} to ${to} for tenant ${tenant.name}`)
    
    return new Response(JSON.stringify({
      success: true,
      call_sid: callData.sid,
      call_record_id: callRecord.id,
      from: from,
      to: to,
      tenant_id: finalTenantId,
      tenant_name: tenant.name,
      agent: agentName,
      status: 'ringing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in start-outbound-call function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})