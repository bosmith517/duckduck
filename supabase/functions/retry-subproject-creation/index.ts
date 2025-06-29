// supabase/functions/retry-subproject-creation/index.ts
// Admin function to retry subproject creation for failed tenants

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
    console.log('Starting retry-subproject-creation function')
    
    // Authenticate admin user
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

    // Verify admin access
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userProfile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    // Get request data
    const { tenantId } = await req.json()
    if (!tenantId) {
      throw new Error('Missing tenantId')
    }

    // Use admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get tenant information
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('company_name, subproject_status, subproject_error')
      .eq('id', tenantId)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Tenant not found')
    }

    console.log('Retrying subproject creation for:', tenant.company_name)

    // Mark as retry in progress
    await supabaseAdmin
      .from('tenants')
      .update({ 
        subproject_status: 'retrying',
        subproject_retry_attempted_at: new Date().toISOString()
      })
      .eq('id', tenantId)

    // Attempt to create subproject
    const subprojectResponse = await supabase.functions.invoke('create-signalwire-subproject', {
      body: {
        tenantId,
        companyName: tenant.company_name
      }
    })

    if (subprojectResponse.error) {
      // Log the retry failure
      await supabaseAdmin
        .from('tenants')
        .update({ 
          subproject_status: 'failed',
          subproject_error: `Retry failed: ${subprojectResponse.error.message}`,
          subproject_retry_needed: true
        })
        .eq('id', tenantId)

      throw new Error(`Subproject creation retry failed: ${subprojectResponse.error.message}`)
    }

    // Success - update status
    await supabaseAdmin
      .from('tenants')
      .update({ 
        subproject_status: 'created',
        subproject_created_at: new Date().toISOString(),
        subproject_error: null,
        subproject_retry_needed: false
      })
      .eq('id', tenantId)

    // Update admin notification to resolved
    await supabaseAdmin
      .from('admin_notifications')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id
      })
      .eq('tenant_id', tenantId)
      .eq('type', 'subproject_creation_failed')
      .eq('status', 'pending')

    console.log('Subproject creation retry successful for tenant:', tenantId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Subproject created successfully on retry',
      subproject: subprojectResponse.data?.subproject
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in retry-subproject-creation:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})