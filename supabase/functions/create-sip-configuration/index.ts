// supabase/functions/create-sip-configuration/index.ts
// Creates SIP configuration for a tenant's SignalWire subproject

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UniversalLogger, loggedDatabaseOperation } from '../_shared/universal-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Initialize logger
  let logger: UniversalLogger | null = null
  
  try {
    console.log('Starting create-sip-configuration function')
    
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

    // Get request data
    const requestData = await req.json()
    const { tenantId, subprojectId, companyName } = requestData
    if (!tenantId || !subprojectId) {
      throw new Error('Missing tenantId or subprojectId')
    }

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Initialize logger with admin client
    logger = new UniversalLogger(supabaseAdmin, 'create-sip-configuration', tenantId, user.id)
    logger.setRequestData(requestData)

    console.log('Creating SIP configuration for tenant:', tenantId, 'subproject:', subprojectId)

    // Generate SIP domain
    // Format: {taurustech}{last12ofSubprojectId}.sip.signalwire.com
    const last12 = subprojectId.slice(-12).toLowerCase()
    const sipDomain = `taurustech${last12}.sip.signalwire.com`
    
    // Generate SIP credentials
    const sipUsername = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`
    const sipPassword = generateSecurePassword()

    // Store SIP configuration in database with logging
    const sipConfigData = {
      tenant_id: tenantId,
      sip_domain: sipDomain,
      sip_server: sipDomain,
      sip_username: sipUsername,
      sip_password: sipPassword, // In production, encrypt this
      transport: 'WSS',
      is_active: true,
      signalwire_space_url: Deno.env.get('SIGNALWIRE_SPACE_URL'),
      signalwire_project_id: subprojectId,
      name: `${companyName} - Main SIP`,
      created_at: new Date().toISOString()
    }

    const { data: sipConfig, error: sipError } = await loggedDatabaseOperation(
      logger,
      'sip_configurations',
      'insert',
      () => supabaseAdmin
        .from('sip_configurations')
        .insert(sipConfigData)
        .select()
        .single(),
      sipConfigData
    )

    if (sipError) {
      console.error('Error saving SIP configuration:', sipError)
      logger.setError(new Error(`Failed to save SIP configuration: ${sipError.message}`))
      
      // Check if this is called from onboarding (non-blocking) or directly (blocking)
      const isOnboardingCall = requestData.from_onboarding || false
      if (!isOnboardingCall) {
        throw new Error(`Failed to save SIP configuration: ${sipError.message}`)
      }
    }

    if (!sipConfig && !sipError) {
      const error = new Error('SIP configuration was not created - no data returned')
      logger.setError(error)
      
      const isOnboardingCall = requestData.from_onboarding || false
      if (!isOnboardingCall) {
        throw error
      }
    }

    if (sipConfig) {
      console.log('Created SIP configuration:', sipConfig.id, 'with domain:', sipDomain)
      
      // Create SignalWire credentials for users with logging
      const credentialsData = {
        user_id: user.id,
        sip_username: sipUsername,
        sip_password: sipPassword,
        sip_domain: sipDomain,
        space_url: Deno.env.get('SIGNALWIRE_SPACE_URL'),
        is_active: true,
        created_at: new Date().toISOString()
      }

      const { error: credError } = await loggedDatabaseOperation(
        logger,
        'signalwire_credentials',
        'insert',
        () => supabaseAdmin
          .from('signalwire_credentials')
          .insert(credentialsData),
        credentialsData
      )

      if (credError) {
        console.error('Error saving SignalWire credentials:', credError)
        logger.setError(new Error(`Failed to save SignalWire credentials: ${credError.message}`))
        
        const isOnboardingCall = requestData.from_onboarding || false
        if (!isOnboardingCall) {
          throw new Error(`Failed to save SignalWire credentials: ${credError.message}`)
        }
      }
    }

    // Return success response
    const responseData = {
      success: true,
      sipConfiguration: sipConfig ? {
        id: sipConfig.id,
        sip_domain: sipDomain,
        sip_username: sipUsername,
        sip_server: sipDomain,
        transport: 'WSS'
      } : null,
      message: sipConfig ? 'SIP configuration created successfully' : 'SIP configuration creation completed with issues - check logs',
      has_errors: !sipConfig || sipError || credError
    }

    logger.setResponseData(responseData)
    logger.setSuccess(!!sipConfig && !sipError)
    await logger.saveLog()

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-sip-configuration:', error.message)
    
    if (logger) {
      logger.setError(error)
      logger.setSuccess(false)
      await logger.saveLog()
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString(),
      function: 'create-sip-configuration'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to generate secure password
function generateSecurePassword(): string {
  const length = 24
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  
  // Use crypto.getRandomValues for secure random generation
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length]
  }
  
  return password
}