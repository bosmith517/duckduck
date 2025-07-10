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
    const requestData = await req.json()
    console.log('Received request data:', JSON.stringify(requestData))
    
    const { email, firstName, lastName, companyName, userId } = requestData

    // Use the service role key to bypass RLS policies during setup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // First, let's check the tenants table structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .limit(0)
    
    console.log('Table check completed')

    // Log what we're about to insert
    const tenantData = {
      company_name: companyName || 'Unknown Company',
      name: companyName || 'Unknown Company',
      subdomain: (companyName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, ''),
      plan: 'basic',
      subscription_status: 'trial',
      is_active: true,
      onboarding_completed: false,
      workflow_preferences: {},
      business_info: {}
    }
    
    console.log('Attempting to insert tenant:', JSON.stringify(tenantData))

    // Try the insert
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert(tenantData)
      .select()
      .single()

    if (tenantError) {
      console.error('Tenant creation error:', JSON.stringify(tenantError))
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Tenant creation failed',
        details: tenantError,
        attempted_data: tenantData
      }), {
        status: 200, // Return 200 so we can see the error in the response
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If tenant creation succeeded, try user profile
    const profileData = {
      id: userId,
      tenant_id: tenant.id,
      email: email || 'no-email@example.com',
      first_name: firstName || 'Unknown',
      last_name: lastName || 'User',
      role: 'admin',
      is_active: true
    }
    
    console.log('Attempting to insert user profile:', JSON.stringify(profileData))

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert(profileData)
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', JSON.stringify(profileError))
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Profile creation failed',
        details: profileError,
        tenant_created: true,
        tenant_id: tenant.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Signup completed successfully',
      data: {
        tenant: tenant,
        profile: profile
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Error in test-signup-debug:', err)
    return new Response(JSON.stringify({ 
      success: false,
      error: `Function error: ${err.message}`,
      stack: err.stack
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})