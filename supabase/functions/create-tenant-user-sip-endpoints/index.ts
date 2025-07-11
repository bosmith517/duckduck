// Create SIP endpoints for all users in a tenant
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

    // Get user profile and verify admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id || userProfile.role !== 'admin') {
      throw new Error('Admin access required')
    }

    // Admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all users in the tenant without SIP configs
    const { data: usersWithoutSip, error: queryError } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        email,
        tenant_id,
        first_name,
        last_name,
        sip_configurations!left(id)
      `)
      .eq('tenant_id', userProfile.tenant_id)
      .is('sip_configurations.id', null)

    if (queryError) {
      throw new Error(`Failed to query users: ${queryError.message}`)
    }

    const results = []

    // Create SIP endpoints for each user
    for (const userToProcess of usersWithoutSip || []) {
      try {
        console.log(`Creating SIP endpoint for user: ${userToProcess.email}`)
        
        const sipResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-user-sip-endpoint`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userToProcess.id,
            email: userToProcess.email,
            tenantId: userToProcess.tenant_id
          })
        })

        if (sipResponse.ok) {
          const sipResult = await sipResponse.json()
          results.push({
            userId: userToProcess.id,
            email: userToProcess.email,
            success: true,
            sipUsername: sipResult.sipConfig?.sip_username
          })
        } else {
          results.push({
            userId: userToProcess.id,
            email: userToProcess.email,
            success: false,
            error: await sipResponse.text()
          })
        }
      } catch (error) {
        results.push({
          userId: userToProcess.id,
          email: userToProcess.email,
          success: false,
          error: error.message
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.length} users`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-tenant-user-sip-endpoints:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})