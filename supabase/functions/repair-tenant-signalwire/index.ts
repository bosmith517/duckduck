// Repair tenant SignalWire configuration
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
    // Authenticate
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
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile || !['admin', 'owner'].includes(userProfile.role)) {
      throw new Error('Insufficient permissions')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if tenant has SIP configuration with subproject info
    const { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('signalwire_project_id, signalwire_api_token')
      .eq('tenant_id', userProfile.tenant_id)
      .single()

    if (!sipConfig || !sipConfig.signalwire_project_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No SignalWire subproject found in SIP configuration'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Update tenant with correct column names
    const { error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        signalwire_subproject_id: sipConfig.signalwire_project_id,
        signalwire_subproject_token: sipConfig.signalwire_api_token,
        signalwire_subproject_space: Deno.env.get('SIGNALWIRE_SPACE_URL'),
        updated_at: new Date().toISOString()
      })
      .eq('id', userProfile.tenant_id)

    if (updateError) {
      throw new Error(`Failed to update tenant: ${updateError.message}`)
    }

    // Also fix any phone numbers that might be using the wrong project
    const { data: phoneNumbers } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('id, signalwire_project_id')
      .eq('tenant_id', userProfile.tenant_id)

    if (phoneNumbers && phoneNumbers.length > 0) {
      for (const phone of phoneNumbers) {
        if (!phone.signalwire_project_id || phone.signalwire_project_id === Deno.env.get('SIGNALWIRE_PROJECT_ID')) {
          // Update to use subproject ID
          await supabaseAdmin
            .from('signalwire_phone_numbers')
            .update({ signalwire_project_id: sipConfig.signalwire_project_id })
            .eq('id', phone.id)
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Tenant SignalWire configuration repaired',
      subproject_id: sipConfig.signalwire_project_id,
      updated_fields: {
        signalwire_subproject_id: sipConfig.signalwire_project_id,
        signalwire_subproject_token: '***hidden***',
        signalwire_subproject_space: Deno.env.get('SIGNALWIRE_SPACE_URL')
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in repair-tenant-signalwire:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})