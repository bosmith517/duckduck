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
    // Get environment variables
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!

    if (!signalwireSpaceUrl || !signalwireApiToken) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    const { tenant_id } = await req.json()

    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    console.log(`Fetching phone numbers for tenant: ${tenant_id}`)

    // Get phone numbers from SignalWire Relay API using Basic Auth
    // Remove https:// if it exists in the space URL
    const cleanSpaceUrl = signalwireSpaceUrl.replace(/^https?:\/\//, '')
    const apiUrl = `https://${cleanSpaceUrl}/api/relay/rest/phone_numbers`
    
    // Create Basic Auth header (space_url:api_token)
    const credentials = `${cleanSpaceUrl}:${signalwireApiToken}`
    const encodedCredentials = btoa(credentials)
    const auth = `Basic ${encodedCredentials}`

    console.log(`Making request to: ${apiUrl}`)

    const signalwireResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json'
      }
    })

    if (!signalwireResponse.ok) {
      return new Response(
        JSON.stringify({ error: `SignalWire returned ${signalwireResponse.status}` }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: signalwireResponse.status
        }
      )
    }
    
    const data = await signalwireResponse.json()
    
    // Return the raw SignalWire response as suggested
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

    console.log(`Found ${data.data?.length || 0} phone numbers in SignalWire`)

    if (!data.data || data.data.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No phone numbers found in SignalWire account',
          phoneNumbers: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    // Sync with our database
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // First, mark all existing numbers for this tenant as inactive
    const { error: deactivateError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenant_id)

    if (deactivateError) {
      console.error('Error deactivating existing numbers:', deactivateError)
    }

    // Sync phone numbers to our database
    const syncedNumbers = []
    for (const phoneNumber of data.data) {
      const phoneData = {
        tenant_id: tenant_id,
        number: phoneNumber.number,
        friendly_name: phoneNumber.name || phoneNumber.number,
        signalwire_sid: phoneNumber.id,
        capabilities: {
          voice: phoneNumber.capabilities?.includes('voice') || false,
          sms: phoneNumber.capabilities?.includes('sms') || false,
          mms: phoneNumber.capabilities?.includes('mms') || false,
        },
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Try to update existing record first
      const { data: existingNumber } = await supabaseAdmin
        .from('signalwire_phone_numbers')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('number', phoneData.number)
        .single()

      if (existingNumber) {
        // Update existing record
        const { error: updateError } = await supabaseAdmin
          .from('signalwire_phone_numbers')
          .update({
            friendly_name: phoneData.friendly_name,
            signalwire_sid: phoneData.signalwire_sid,
            capabilities: phoneData.capabilities,
            is_active: true,
            updated_at: phoneData.updated_at,
          })
          .eq('id', existingNumber.id)

        if (updateError) {
          console.error(`Error updating phone number ${phoneData.number}:`, updateError)
        } else {
          console.log(`Updated phone number: ${phoneData.number}`)
          syncedNumbers.push(phoneData)
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseAdmin
          .from('signalwire_phone_numbers')
          .insert(phoneData)

        if (insertError) {
          console.error(`Error inserting phone number ${phoneData.number}:`, insertError)
        } else {
          console.log(`Inserted phone number: ${phoneData.number}`)
          syncedNumbers.push(phoneData)
        }
      }
    }

    console.log(`Successfully synced ${syncedNumbers.length} phone numbers`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${syncedNumbers.length} phone numbers`,
        phoneNumbers: syncedNumbers,
        rawData: data // Include raw SignalWire response for debugging
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in list-signalwire-phone-numbers function:', error.message)
    
    // Get environment variables for error reporting
    const spaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')
    const apiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')
    
    // Provide detailed error information for debugging
    const errorDetails = {
      success: false,
      error: error.message,
      details: {
        hasSpaceUrl: !!spaceUrl,
        hasApiToken: !!apiToken,
        spaceUrlValue: spaceUrl ? 'Set (hidden)' : 'Not set',
        apiTokenValue: apiToken ? 'Set (hidden)' : 'Not set',
        constructedUrl: spaceUrl ? `https://${spaceUrl.replace(/^https?:\/\//, '')}/api/relay/rest/phone_numbers` : 'Could not construct URL',
        authMethod: 'Basic Auth (space_url:api_token)',
        timestamp: new Date().toISOString()
      }
    }
    
    return new Response(JSON.stringify(errorDetails), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
