// supabase/functions/manage-phone-numbers/index.ts
// CONSOLIDATED: Phone number management (list, sync, search) with universal logging
// Replaces: list-signalwire-phone-numbers + sync-signalwire-phone-numbers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { UniversalLogger, loggedDatabaseOperation, loggedExternalApiCall } from '../_shared/universal-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let logger: UniversalLogger | null = null

  try {
    // Step 1: Authenticate the user
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

    // Step 2: Get user's tenant information
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new Error('User profile not found')
    }

    // Step 3: Get request parameters
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list' // list, sync, search
    const areaCode = url.searchParams.get('areaCode')
    const maxResults = url.searchParams.get('maxResults') || '10'
    const forceSync = url.searchParams.get('forceSync') === 'true'

    // Use admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Initialize logger
    logger = new UniversalLogger(supabaseAdmin, 'manage-phone-numbers', userProfile.tenant_id, user.id)
    logger.setRequestData({ action, areaCode, maxResults, forceSync, tenant_id: userProfile.tenant_id })

    // Step 4: Validate tenant
    const { data: tenant, error: tenantError } = await loggedDatabaseOperation(
      logger,
      'tenants',
      'select',
      () => supabaseAdmin
        .from('tenants')
        .select('id, company_name, is_active')
        .eq('id', userProfile.tenant_id)
        .eq('is_active', true)
        .single()
    )

    if (tenantError || !tenant) {
      throw new Error('Invalid or inactive tenant')
    }

    // Step 5: Get SignalWire credentials
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    const projectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')

    if (!spaceUrl || !apiToken || !projectId) {
      throw new Error('SignalWire credentials not configured')
    }

    console.log(`Processing ${action} action for tenant: ${tenant.company_name}`)

    let responseData: any = {}

    // Step 6: Handle different actions
    switch (action) {
      case 'search':
        responseData = await handleSearchNumbers(logger, spaceUrl, projectId, apiToken, areaCode, parseInt(maxResults), tenant)
        break
      
      case 'sync':
        responseData = await handleSyncNumbers(logger, supabaseAdmin, spaceUrl, projectId, apiToken, userProfile.tenant_id, tenant)
        break
      
      case 'list':
      default:
        responseData = await handleListNumbers(logger, supabaseAdmin, spaceUrl, projectId, apiToken, userProfile.tenant_id, tenant, forceSync)
        break
    }

    // Step 7: Return response
    logger.setResponseData(responseData)
    logger.setSuccess(true)
    await logger.saveLog()

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in manage-phone-numbers function:', error.message)
    
    if (logger) {
      logger.setError(error)
      logger.setSuccess(false)
      await logger.saveLog()
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      function: 'manage-phone-numbers',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Handle searching for available phone numbers
async function handleSearchNumbers(
  logger: UniversalLogger,
  spaceUrl: string,
  projectId: string,
  apiToken: string,
  areaCode: string | null,
  maxResults: number,
  tenant: any
): Promise<any> {
  console.log('Searching for available phone numbers')

  const searchParams = new URLSearchParams()
  if (areaCode) searchParams.append('areacode', areaCode)
  searchParams.append('max_results', maxResults.toString())
  searchParams.append('number_type', 'local')

  const apiUrl = `https://${spaceUrl}/api/relay/rest/phone_numbers/search?${searchParams.toString()}`
  
  const availableNumbers = await loggedExternalApiCall(
    logger,
    'SignalWire',
    apiUrl,
    { areacode: areaCode, max_results: maxResults },
    async () => {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`SignalWire API error: ${response.status} ${errorBody}`)
      }
      
      const data = await response.json()
      return data.available_phone_numbers || data.data || []
    }
  )

  return {
    success: true,
    action: 'search',
    tenant_id: tenant.id,
    tenant_name: tenant.company_name,
    available_numbers: availableNumbers,
    search_criteria: { areacode: areaCode, max_results: maxResults },
    total_count: availableNumbers.length
  }
}

// Handle syncing phone numbers from SignalWire to local database
async function handleSyncNumbers(
  logger: UniversalLogger,
  supabaseAdmin: any,
  spaceUrl: string,
  projectId: string,
  apiToken: string,
  tenantId: string,
  tenant: any
): Promise<any> {
  console.log('Syncing phone numbers from SignalWire')

  // Fetch phone numbers from SignalWire using Relay REST API (consistent with other functions)
  const apiUrl = `https://${spaceUrl}/api/relay/rest/phone_numbers`
  
  const signalwireNumbers = await loggedExternalApiCall(
    logger,
    'SignalWire',
    apiUrl,
    {},
    async () => {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${projectId}:${apiToken}`)}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`SignalWire API error: ${response.status} - ${errorBody}`)
      }
      
      const data = await response.json()
      return data.data || []
    }
  )

  // Get existing tenant phone numbers
  const { data: existingNumbers } = await loggedDatabaseOperation(
    logger,
    'signalwire_phone_numbers',
    'select',
    () => supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('number, signalwire_number_id, is_active')
      .eq('tenant_id', tenantId)
  )

  let syncedCount = 0
  let updatedCount = 0

  // Process each SignalWire number
  for (const swNumber of signalwireNumbers) {
    const existingNumber = existingNumbers?.find(num => 
      num.signalwire_number_id === swNumber.id || num.number === swNumber.number
    )

    const phoneData = {
      tenant_id: tenantId,
      number: swNumber.number,
      signalwire_number_id: swNumber.id,
      number_type: swNumber.number_type || 'longcode',
      is_active: true,
      sms_enabled: swNumber.capabilities?.includes('sms') || false,
      voice_enabled: swNumber.capabilities?.includes('voice') || true,
      fax_enabled: swNumber.capabilities?.includes('fax') || false,
      updated_at: new Date().toISOString()
    }

    if (existingNumber) {
      // Update existing record
      const { error: updateError } = await loggedDatabaseOperation(
        logger,
        'signalwire_phone_numbers',
        'update',
        () => supabaseAdmin
          .from('signalwire_phone_numbers')
          .update(phoneData)
          .eq('number', swNumber.number)
          .eq('tenant_id', tenantId),
        phoneData
      )

      if (!updateError) {
        updatedCount++
      }
    } else {
      // Insert new record
      phoneData.created_at = new Date().toISOString()
      
      const { error: insertError } = await loggedDatabaseOperation(
        logger,
        'signalwire_phone_numbers',
        'insert',
        () => supabaseAdmin
          .from('signalwire_phone_numbers')
          .insert(phoneData),
        phoneData
      )

      if (!insertError) {
        syncedCount++
      }
    }
  }

  // Get final list of active phone numbers
  const { data: finalNumbers } = await loggedDatabaseOperation(
    logger,
    'signalwire_phone_numbers',
    'select',
    () => supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
  )

  return {
    success: true,
    action: 'sync',
    tenant_id: tenantId,
    tenant_name: tenant.company_name,
    sync_summary: {
      signalwire_numbers_found: signalwireNumbers.length,
      new_numbers_synced: syncedCount,
      existing_numbers_updated: updatedCount,
      total_active_numbers: finalNumbers?.length || 0
    },
    phoneNumbers: finalNumbers || []
  }
}

// Handle listing phone numbers with optional auto-sync
async function handleListNumbers(
  logger: UniversalLogger,
  supabaseAdmin: any,
  spaceUrl: string,
  projectId: string,
  apiToken: string,
  tenantId: string,
  tenant: any,
  forceSync: boolean
): Promise<any> {
  console.log('Listing phone numbers for tenant')

  // Get tenant's phone numbers from local database
  const { data: tenantNumbers, error: numbersError } = await loggedDatabaseOperation(
    logger,
    'signalwire_phone_numbers',
    'select',
    () => supabaseAdmin
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
  )

  if (numbersError) {
    console.error('Error fetching tenant phone numbers:', numbersError)
  }

  // Perform auto-sync if requested or if no numbers found locally
  let syncPerformed = false
  let syncSummary = null

  if (forceSync || !tenantNumbers || tenantNumbers.length === 0) {
    console.log('Performing auto-sync of phone numbers')
    try {
      const syncResult = await handleSyncNumbers(logger, supabaseAdmin, spaceUrl, projectId, apiToken, tenantId, tenant)
      syncPerformed = true
      syncSummary = syncResult.sync_summary
      
      // Get updated list after sync
      const { data: updatedNumbers } = await loggedDatabaseOperation(
        logger,
        'signalwire_phone_numbers',
        'select',
        () => supabaseAdmin
          .from('signalwire_phone_numbers')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
      )
      
      return {
        success: true,
        action: 'list',
        tenant_id: tenantId,
        tenant_name: tenant.company_name,
        phoneNumbers: updatedNumbers || [],
        total_count: updatedNumbers?.length || 0,
        auto_sync_performed: syncPerformed,
        sync_summary: syncSummary
      }
    } catch (syncError) {
      console.error('Auto-sync failed, returning local numbers:', syncError)
      // Continue with local numbers if sync fails
    }
  }

  return {
    success: true,
    action: 'list',
    tenant_id: tenantId,
    tenant_name: tenant.company_name,
    phoneNumbers: tenantNumbers || [],
    total_count: tenantNumbers?.length || 0,
    auto_sync_performed: syncPerformed,
    sync_summary: syncSummary
  }
}