// supabase/functions/verify-phone-numbers/index.ts
// Verifies phone numbers in database against SignalWire API

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

    // Get admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all phone numbers from database for this tenant
    const { data: dbNumbers, error: dbError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)

    if (dbError) throw dbError

    // Get SignalWire credentials
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Get all phone numbers from SignalWire
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)
    const listUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers`
    
    console.log('Fetching phone numbers from SignalWire API:', listUrl)
    
    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SignalWire API error:', response.status, errorText)
      throw new Error(`SignalWire API error: ${response.status}`)
    }

    const signalwireData = await response.json()
    const signalwireNumbers = signalwireData.data || []

    // Compare database with SignalWire
    const comparison = {
      database_numbers: dbNumbers || [],
      signalwire_numbers: signalwireNumbers,
      in_db_not_in_sw: [],
      in_sw_not_in_db: [],
      matched: []
    }

    // Find numbers in DB but not in SignalWire
    for (const dbNum of (dbNumbers || [])) {
      const found = signalwireNumbers.find((swNum: any) => 
        swNum.number === dbNum.number || 
        swNum.e164 === dbNum.number ||
        swNum.id === dbNum.signalwire_number_id
      )
      
      if (!found) {
        comparison.in_db_not_in_sw.push({
          number: dbNum.number,
          db_id: dbNum.id,
          signalwire_id: dbNum.signalwire_number_id,
          created_at: dbNum.created_at
        })
      } else {
        comparison.matched.push({
          number: dbNum.number,
          db_id: dbNum.id,
          sw_id: found.id
        })
      }
    }

    // Find numbers in SignalWire but not in DB
    for (const swNum of signalwireNumbers) {
      const found = (dbNumbers || []).find((dbNum: any) => 
        dbNum.number === swNum.number || 
        dbNum.number === swNum.e164 ||
        dbNum.signalwire_number_id === swNum.id
      )
      
      if (!found) {
        comparison.in_sw_not_in_db.push({
          number: swNum.number || swNum.e164,
          sw_id: swNum.id,
          capabilities: swNum.capabilities
        })
      }
    }

    // Also check tenant's SignalWire configuration
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id, company_name, signalwire_subproject_id, signalwire_subproject_token, signalwire_subproject_space')
      .eq('id', userProfile.tenant_id)
      .single()

    return new Response(JSON.stringify({
      tenant_info: {
        id: tenant?.id,
        name: tenant?.company_name,
        has_subproject: !!tenant?.signalwire_subproject_id,
        subproject_id: tenant?.signalwire_subproject_id
      },
      using_main_project: true,
      main_project_id: signalwireProjectId,
      comparison,
      summary: {
        total_in_database: dbNumbers?.length || 0,
        total_in_signalwire: signalwireNumbers.length,
        missing_from_signalwire: comparison.in_db_not_in_sw.length,
        missing_from_database: comparison.in_sw_not_in_db.length,
        matched: comparison.matched.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in verify-phone-numbers:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})