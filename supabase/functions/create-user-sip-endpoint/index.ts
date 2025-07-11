// Create SIP endpoint for a user
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
    const { userId, email, tenantId } = await req.json()
    
    if (!userId || !email || !tenantId) {
      throw new Error('Missing required parameters: userId, email, and tenantId')
    }

    console.log('Creating SIP endpoint for user:', { userId, email, tenantId })

    // Admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if user already has SIP configuration
    const { data: existingSip } = await supabaseAdmin
      .from('sip_configurations')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    if (existingSip) {
      console.log('User already has SIP configuration:', existingSip.sip_username)
      return new Response(JSON.stringify({
        success: true,
        message: 'SIP endpoint already exists',
        sipConfig: existingSip
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // SignalWire credentials
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')!
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    // Generate SIP username from email
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
    
    // Check if username already exists across all tenants
    const { data: existingUsernames } = await supabaseAdmin
      .from('sip_configurations')
      .select('sip_username')
      .eq('sip_username', emailPrefix)

    let sipUsername = emailPrefix
    if (existingUsernames && existingUsernames.length > 0) {
      // Add numeric suffix to make it unique
      sipUsername = `${emailPrefix}${existingUsernames.length + 1}`
      console.log('Username collision detected, using:', sipUsername)
    }

    const sipPassword = generateRandomPassword()
    
    // Use the standard domain: taurustech-tradeworkspro.sip.signalwire.com
    const sipDomain = 'taurustech-tradeworkspro.sip.signalwire.com'
    const endpointName = 'taurustech-tradeworkspro'

    console.log('Creating SIP user:', {
      username: sipUsername,
      domain: sipDomain,
      endpoint: endpointName
    })

    // Create SIP user in SignalWire
    const auth = btoa(`${projectId}:${apiToken}`)
    const createUserUrl = `https://${spaceUrl}/api/relay/rest/sip_endpoints/${endpointName}/users`
    
    const createResponse = await fetch(createUserUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: sipUsername,
        password: sipPassword,
        caller_id: null, // Will be set when they get a phone number
        enabled: true
      })
    })

    let userCreatedInSignalWire = false
    
    if (createResponse.ok) {
      console.log('SIP user created successfully in SignalWire')
      userCreatedInSignalWire = true
    } else {
      const errorText = await createResponse.text()
      console.error('Failed to create SIP user in SignalWire:', errorText)
      
      // If 409, user might already exist
      if (createResponse.status === 409) {
        console.log('User might already exist, continuing...')
        userCreatedInSignalWire = true
      }
    }

    // Store SIP configuration in database
    const { data: newSipConfig, error: insertError } = await supabaseAdmin
      .from('sip_configurations')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        sip_username: sipUsername,
        sip_password_encrypted: sipPassword,
        sip_domain: sipDomain,
        sip_proxy: sipDomain,
        signalwire_project_id: projectId,
        is_active: true,
        service_plan: 'basic',
        monthly_rate: 0, // User-level, billed at tenant level
        per_minute_rate: 0,
        included_minutes: 0,
        notes: `User SIP endpoint - ${userCreatedInSignalWire ? 'Auto-created' : 'Manual setup needed'}`
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to save SIP configuration: ${insertError.message}`)
    }

    console.log('SIP configuration saved for user:', userId)

    return new Response(JSON.stringify({
      success: true,
      message: userCreatedInSignalWire 
        ? 'SIP endpoint created successfully' 
        : 'SIP configuration created, manual setup may be needed',
      sipConfig: newSipConfig,
      userCreatedInSignalWire
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-user-sip-endpoint:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})