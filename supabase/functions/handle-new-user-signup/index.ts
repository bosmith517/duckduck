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
    const { email, firstName, lastName, companyName, userId } = await req.json()

    // Use the service role key to bypass RLS policies during setup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('Creating tenant and user profile for:', { email, companyName, userId })

    // Step 1: Create tenant (company) using service role to bypass RLS
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert([
        {
          name: companyName,
          subdomain: companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
          plan: 'basic',
          is_active: true
        }
      ])
      .select()
      .single()

    if (tenantError) {
      console.error('Error creating tenant:', tenantError)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to create tenant',
        details: tenantError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created tenant:', tenantData)

    // Step 2: Create user profile using service role to bypass RLS
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert([
        {
          id: userId,
          tenant_id: tenantData.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: 'admin',
          is_active: true
        }
      ])
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Failed to create user profile',
        details: profileError 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Created user profile:', profileData)

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
    console.error('Error in handle-new-user-signup:', err)
    return new Response(JSON.stringify({ 
      success: false,
      error: `Function error: ${err.message}`,
      details: err
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})