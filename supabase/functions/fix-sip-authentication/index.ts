// Fix SIP authentication by ensuring credentials exist in SignalWire
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
    // Authenticate user
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
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userProfile?.tenant_id) {
      throw new Error('User profile not found')
    }

    console.log('Fixing SIP authentication for user:', user.email)
    
    // Admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Delete ALL old configurations for this user
    const { error: deleteUserError } = await supabaseAdmin
      .from('sip_configurations')
      .delete()
      .eq('user_id', user.id)
      
    if (deleteUserError) {
      console.error('Error deleting user configs:', deleteUserError)
    }
      
    // Delete old tenant-level configs
    const { error: deleteTenantError } = await supabaseAdmin
      .from('sip_configurations')
      .delete()
      .eq('tenant_id', userProfile.tenant_id)
      .is('user_id', null)
      
    if (deleteTenantError) {
      console.error('Error deleting tenant configs:', deleteTenantError)
    }
    
    console.log('Cleaned up old configurations')

    // Use the create-user-sip-endpoint function to properly create/update the user
    const createUserResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-user-sip-endpoint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        tenantId: userProfile.tenant_id
      })
    })
    
    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text()
      throw new Error(`Failed to create SIP endpoint: ${errorText}`)
    }

    const result = await createUserResponse.json()
    console.log('SIP endpoint created/updated:', result)

    // Get the updated configuration
    const { data: sipConfig } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!sipConfig) {
      throw new Error('SIP configuration not found after creation')
    }

    // Return the credentials
    return new Response(JSON.stringify({
      success: true,
      sip_username: sipConfig.sip_username,
      sip_domain: sipConfig.sip_domain,
      sip_password: sipConfig.sip_password_encrypted,
      message: 'SIP authentication fixed! The phone system should work now. Please refresh the page and try calling again.',
      endpoint_name: 'taurustech-tradeworkspro',
      user_created_in_signalwire: result.userCreatedInSignalWire || false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in fix-sip-authentication:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})