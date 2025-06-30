// supabase/functions/repair-tenant-setup/index.ts
// Repairs incomplete tenant setups (missing SIP config, phone numbers, etc.)

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
    console.log('Starting repair-tenant-setup function')
    
    // Authenticate the user
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

    // Get tenant ID from request or user profile
    const { tenantId } = await req.json().catch(() => ({}))
    
    // Use admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // If no tenantId provided, get it from user profile
    let targetTenantId = tenantId
    if (!targetTenantId) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      
      targetTenantId = profile?.tenant_id
    }

    if (!targetTenantId) {
      throw new Error('Could not determine tenant ID')
    }

    console.log('Repairing setup for tenant:', targetTenantId)

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', targetTenantId)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Tenant not found')
    }

    const repairs = {
      subproject: false,
      sipConfig: false,
      phoneNumber: false,
      account: false
    }

    // 1. Check and repair SignalWire subproject
    if (!tenant.signalwire_subproject_id || tenant.subproject_status !== 'created') {
      console.log('Subproject missing or failed, creating...')
      try {
        const { data: subprojectData, error: subprojectError } = await supabase.functions.invoke('create-signalwire-subproject', {
          body: {
            tenantId: targetTenantId,
            companyName: tenant.company_name
          }
        })
        
        if (!subprojectError && subprojectData?.success) {
          repairs.subproject = true
          tenant.signalwire_subproject_id = subprojectData.subproject.id
        }
      } catch (err) {
        console.error('Could not create subproject:', err)
      }
    }

    // 2. Check and repair SIP configuration
    const { data: sipConfigs } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .eq('is_active', true)

    if (!sipConfigs || sipConfigs.length === 0) {
      console.log('SIP configuration missing, creating...')
      if (tenant.signalwire_subproject_id) {
        try {
          const { data: sipData, error: sipError } = await supabase.functions.invoke('create-sip-configuration', {
            body: {
              tenantId: targetTenantId,
              subprojectId: tenant.signalwire_subproject_id,
              companyName: tenant.company_name
            }
          })
          
          if (!sipError && sipData?.success) {
            repairs.sipConfig = true
          }
        } catch (err) {
          console.error('Could not create SIP config:', err)
        }
      }
    }

    // 3. Check and repair phone number provisioning
    const { data: phoneNumbers } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .eq('is_active', true)

    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.log('No phone numbers found, checking for selected number...')
      
      // Check if there's a selected phone number in business_info
      const selectedPhone = tenant.business_info?.selected_phone
      if (selectedPhone) {
        console.log('Found selected phone number:', selectedPhone)
        
        // Add it to signalwire_phone_numbers
        const { error: phoneError } = await supabaseAdmin
          .from('signalwire_phone_numbers')
          .insert({
            tenant_id: targetTenantId,
            number: selectedPhone,
            country_code: '+1',
            area_code: selectedPhone.slice(2, 5),
            number_type: 'local',
            is_active: true,
            sms_enabled: true,
            voice_enabled: true,
            fax_enabled: false,
            created_at: new Date().toISOString(),
            purchased_at: new Date().toISOString()
          })
        
        if (!phoneError) {
          repairs.phoneNumber = true
        } else {
          console.error('Error adding phone number:', phoneError)
        }
      }
    }

    // 4. Check and repair company account
    const { data: accounts } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .eq('type', 'company')

    if (!accounts || accounts.length === 0) {
      console.log('Company account missing, creating...')
      
      const { error: accountError } = await supabaseAdmin
        .from('accounts')
        .insert({
          tenant_id: targetTenantId,
          name: tenant.company_name,
          type: 'company',
          industry: tenant.service_type,
          account_status: 'ACTIVE',
          created_at: new Date().toISOString()
        })
      
      if (!accountError) {
        repairs.account = true
      }
    }

    // Summary report
    const summary = {
      tenant_id: targetTenantId,
      tenant_name: tenant.company_name,
      repairs_performed: repairs,
      current_status: {
        has_subproject: !!tenant.signalwire_subproject_id,
        has_sip_config: sipConfigs && sipConfigs.length > 0,
        has_phone_numbers: phoneNumbers && phoneNumbers.length > 0,
        has_company_account: accounts && accounts.length > 0
      }
    }

    console.log('Repair complete:', summary)

    return new Response(JSON.stringify({
      success: true,
      summary: summary,
      message: 'Tenant setup repair completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in repair-tenant-setup:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})