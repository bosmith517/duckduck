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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { email, firstName, lastName, companyName, userId } = await req.json()
    
    console.log('=== SIGNUP REQUEST ===')
    console.log('Email:', email)
    console.log('Company:', companyName)
    console.log('User ID:', userId)
    
    // Step 1: Create minimal tenant record with only required fields
    const tenantId = crypto.randomUUID()
    const cleanCompanyName = companyName || 'New Company'
    
    // Insert with explicit column specification
    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        id: tenantId,
        company_name: cleanCompanyName,
        subscription_status: 'trial',
        is_active: true,
        plan: 'basic'
      })

    if (tenantError) {
      console.error('Tenant insert error:', tenantError)
      throw new Error(`Tenant creation failed: ${tenantError.message}`)
    }

    console.log('✅ Tenant created:', tenantId)

    // Step 2: Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        tenant_id: tenantId,
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
        role: 'admin',
        is_active: true
      })

    if (profileError) {
      console.error('Profile insert error:', profileError)
      // Try to clean up the tenant
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
      throw new Error(`Profile creation failed: ${profileError.message}`)
    }

    console.log('✅ Profile created for user:', userId)

    // Step 3: Return success with tenant data
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    const { data: profileData } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return new Response(JSON.stringify({
      success: true,
      message: 'User setup completed successfully',
      data: {
        tenant: tenantData,
        profile: profileData
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('=== SIGNUP ERROR ===')
    console.error('Message:', err.message)
    console.error('Stack:', err.stack)
    
    return new Response(JSON.stringify({ 
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})