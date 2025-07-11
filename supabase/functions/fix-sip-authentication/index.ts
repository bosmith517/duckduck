// Fix SIP authentication by ensuring credentials exist in SignalWire
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to generate a random password
function generateRandomPassword(length = 24): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
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

    // Admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get SIP configuration
    const { data: sipConfig, error: sipError } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('tenant_id', userProfile.tenant_id)
      .eq('is_active', true)
      .single()

    if (sipError || !sipConfig) {
      throw new Error('No SIP configuration found. Please run create-sip-endpoint first.')
    }

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    console.log('Current SIP config:', {
      username: sipConfig.sip_username,
      domain: sipConfig.sip_domain,
      hasPassword: !!sipConfig.sip_password_encrypted
    })

    // Get endpoint name from domain
    const endpointName = sipConfig.sip_domain.split('.')[0] // e.g., taurustech-9b70eb096555

    // Generate a new password to ensure sync
    const newPassword = generateRandomPassword()
    
    // Create or update SIP user via SignalWire API
    const auth = btoa(`${projectId}:${apiToken}`)
    
    // First, check if the user exists
    const checkUserUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}/users/${sipConfig.sip_username}`
    const checkResponse = await fetch(checkUserUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    let userUpdated = false
    
    if (checkResponse.ok) {
      console.log('User exists, updating password...')
      
      // Update existing user with new password
      const updateResponse = await fetch(checkUserUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          password: newPassword,
          enabled: true,
          caller_id: '+16308471792' // Use your actual phone number
        })
      })

      if (updateResponse.ok) {
        console.log('Successfully updated SIP user password')
        userUpdated = true
      } else {
        console.error('Failed to update user:', await updateResponse.text())
      }
    } else {
      console.log('User does not exist, creating...')
      
      // Create new user
      const createUserUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}/users`
      const createResponse = await fetch(createUserUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: sipConfig.sip_username,
          password: newPassword,
          caller_id: '+16308471792', // Use your actual phone number
          enabled: true
        })
      })

      if (createResponse.ok) {
        console.log('Successfully created SIP user')
        userUpdated = true
      } else {
        const errorText = await createResponse.text()
        console.error('Failed to create user:', errorText)
        
        // If 409 conflict, user already exists
        if (createResponse.status === 409) {
          console.log('User already exists, this might be a password sync issue')
          // Try to delete and recreate
          const deleteResponse = await fetch(checkUserUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          })
          
          if (deleteResponse.ok) {
            console.log('Deleted existing user, recreating...')
            // Try create again
            const retryResponse = await fetch(createUserUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                username: sipConfig.sip_username,
                password: newPassword,
                caller_id: '+16308471792',
                enabled: true
              })
            })
            
            if (retryResponse.ok) {
              console.log('Successfully recreated SIP user')
              userUpdated = true
            }
          }
        }
      }
    }

    // Update database with new password
    if (userUpdated) {
      const { error: updateError } = await supabaseAdmin
        .from('sip_configurations')
        .update({
          sip_password_encrypted: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', sipConfig.id)

      if (updateError) {
        console.error('Failed to update database:', updateError)
      } else {
        console.log('Database updated with new password')
      }
    }

    // Return the credentials
    return new Response(JSON.stringify({
      success: userUpdated,
      sip_username: sipConfig.sip_username,
      sip_domain: sipConfig.sip_domain,
      sip_password: userUpdated ? newPassword : sipConfig.sip_password_encrypted,
      message: userUpdated 
        ? 'SIP authentication fixed! The phone system should work now. Please refresh the page and try calling again.' 
        : 'Failed to update SIP credentials in SignalWire. Please check the logs.',
      endpoint_name: endpointName,
      user_updated: userUpdated
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