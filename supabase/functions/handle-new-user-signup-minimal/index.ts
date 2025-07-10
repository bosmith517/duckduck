import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
    const body = await req.json()
    console.log('Received body:', JSON.stringify(body))
    
    const { email, firstName, lastName, companyName, userId } = body
    
    if (!userId || !email || !companyName) {
      throw new Error(`Missing required fields: userId=${userId}, email=${email}, companyName=${companyName}`)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // First, let's just try to create a tenant with absolute minimum fields
    console.log('Attempting minimal tenant insert...')
    
    const tenantInsert = {
      company_name: companyName,
      subscription_status: 'trial'
    }
    
    console.log('Tenant insert data:', JSON.stringify(tenantInsert))
    
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert(tenantInsert)
      .select()
      .single()

    if (tenantError) {
      console.error('Tenant error details:', JSON.stringify(tenantError))
      console.error('Tenant error code:', tenantError.code)
      console.error('Tenant error message:', tenantError.message)
      console.error('Tenant error details:', tenantError.details)
      console.error('Tenant error hint:', tenantError.hint)
      
      // Let's try to get column info
      const { data: columns, error: colError } = await supabaseAdmin
        .rpc('get_table_columns', { table_name: 'tenants' })
        .single()
      
      if (!colError && columns) {
        console.log('Tenants table columns:', JSON.stringify(columns))
      }
      
      throw new Error(`Tenant creation failed: ${tenantError.message} (Code: ${tenantError.code})`)
    }

    console.log('Tenant created successfully:', tenant.id)

    // Now create user profile
    const profileInsert = {
      id: userId,
      tenant_id: tenant.id,
      email: email,
      first_name: firstName || '',
      last_name: lastName || '',
      role: 'admin',
      is_active: true
    }
    
    console.log('Profile insert data:', JSON.stringify(profileInsert))
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileInsert)
      .select()
      .single()

    if (profileError) {
      console.error('Profile error:', JSON.stringify(profileError))
      // Clean up tenant
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
      throw new Error(`Profile creation failed: ${profileError.message}`)
    }

    console.log('Profile created successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'User setup completed',
      data: {
        tenant: tenant,
        profile: profile
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Function error:', err.message)
    console.error('Stack:', err.stack)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})