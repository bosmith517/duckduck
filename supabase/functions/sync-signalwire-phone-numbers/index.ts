import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get SignalWire credentials from environment
    const signalwireProjectId = Deno.env.get('SIGNALWIRE_PROJECT_ID')
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')

    if (!signalwireProjectId || !signalwireApiToken) {
      throw new Error('SignalWire credentials not configured')
    }

    // Get tenant_id from request body or use default
    const { tenant_id } = await req.json().catch(() => ({}))
    
    if (!tenant_id) {
      throw new Error('tenant_id is required')
    }

    console.log(`Syncing phone numbers for tenant: ${tenant_id}`)

    // Fetch phone numbers from SignalWire
    const signalwireUrl = `https://${signalwireProjectId}.signalwire.com/api/laml/v2/Accounts/${signalwireProjectId}/IncomingPhoneNumbers`
    const auth = btoa(`${signalwireProjectId}:${signalwireApiToken}`)

    const response = await fetch(signalwireUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`SignalWire API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`Found ${data.incoming_phone_numbers?.length || 0} phone numbers in SignalWire`)

    if (!data.incoming_phone_numbers || data.incoming_phone_numbers.length === 0) {
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

    // Prepare phone numbers for insertion
    const phoneNumbersToInsert = data.incoming_phone_numbers.map((phone: any) => ({
      tenant_id: tenant_id,
      number: phone.phone_number,
      friendly_name: phone.friendly_name || phone.phone_number,
      signalwire_sid: phone.sid,
      capabilities: {
        voice: phone.capabilities?.voice || false,
        sms: phone.capabilities?.sms || false,
        mms: phone.capabilities?.mms || false,
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // First, mark all existing numbers for this tenant as inactive
    const { error: deactivateError } = await supabaseClient
      .from('signalwire_phone_numbers')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenant_id)

    if (deactivateError) {
      console.error('Error deactivating existing numbers:', deactivateError)
    }

    // Insert or update phone numbers
    for (const phoneNumber of phoneNumbersToInsert) {
      // Try to update existing record first
      const { data: existingNumber } = await supabaseClient
        .from('signalwire_phone_numbers')
        .select('id')
        .eq('tenant_id', tenant_id)
        .eq('number', phoneNumber.number)
        .single()

      if (existingNumber) {
        // Update existing record
        const { error: updateError } = await supabaseClient
          .from('signalwire_phone_numbers')
          .update({
            friendly_name: phoneNumber.friendly_name,
            signalwire_sid: phoneNumber.signalwire_sid,
            capabilities: phoneNumber.capabilities,
            is_active: true,
            updated_at: phoneNumber.updated_at,
          })
          .eq('id', existingNumber.id)

        if (updateError) {
          console.error(`Error updating phone number ${phoneNumber.number}:`, updateError)
        } else {
          console.log(`Updated phone number: ${phoneNumber.number}`)
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseClient
          .from('signalwire_phone_numbers')
          .insert(phoneNumber)

        if (insertError) {
          console.error(`Error inserting phone number ${phoneNumber.number}:`, insertError)
        } else {
          console.log(`Inserted phone number: ${phoneNumber.number}`)
        }
      }
    }

    // Get the final list of active phone numbers for this tenant
    const { data: finalNumbers, error: fetchError } = await supabaseClient
      .from('signalwire_phone_numbers')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Error fetching synced numbers: ${fetchError.message}`)
    }

    console.log(`Successfully synced ${finalNumbers?.length || 0} phone numbers`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully synced ${finalNumbers?.length || 0} phone numbers`,
        phoneNumbers: finalNumbers || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error syncing phone numbers:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
