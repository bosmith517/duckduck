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
    const signalwireApiKeySid = Deno.env.get('SIGNALWIRE_API_KEY_SID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!

    if (!signalwireApiKeySid || !signalwireApiToken || !signalwireSpaceUrl) {
      throw new Error('Server configuration error: Missing SignalWire credentials.')
    }

    const { phoneNumberId, updates } = await req.json()
    if (!phoneNumberId) {
      throw new Error('Missing phoneNumberId in the request.')
    }

    // Update the phone number via SignalWire API
    const updateUrl = `https://${signalwireSpaceUrl}/api/relay/rest/phone_numbers/${phoneNumberId}`
    
    const auth = btoa(`${signalwireApiKeySid}:${signalwireApiToken}`);

    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.text()
      throw new Error(`SignalWire update failed: ${updateResponse.status} ${errorBody}`)
    }
    
    const updatedNumberData = await updateResponse.json()
    
    // Update our database record
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: updatedDbRecord, error: dbError } = await supabaseAdmin
      .from('signalwire_phone_numbers')
      .update({
        name: updatedNumberData.name,
        call_handler: updatedNumberData.call_handler,
        call_receive_mode: updatedNumberData.call_receive_mode,
        call_request_url: updatedNumberData.call_request_url,
        call_request_method: updatedNumberData.call_request_method,
        call_fallback_url: updatedNumberData.call_fallback_url,
        call_fallback_method: updatedNumberData.call_fallback_method,
        call_status_callback_url: updatedNumberData.call_status_callback_url,
        call_status_callback_method: updatedNumberData.call_status_callback_method,
        call_laml_application_id: updatedNumberData.call_laml_application_id,
        call_dialogflow_agent_id: updatedNumberData.call_dialogflow_agent_id,
        call_relay_topic: updatedNumberData.call_relay_topic,
        call_relay_topic_status_callback_url: updatedNumberData.call_relay_topic_status_callback_url,
        call_relay_context: updatedNumberData.call_relay_context,
        call_relay_context_status_callback_url: updatedNumberData.call_relay_context_status_callback_url,
        call_relay_application: updatedNumberData.call_relay_application,
        call_relay_connector_id: updatedNumberData.call_relay_connector_id,
        call_sip_endpoint_id: updatedNumberData.call_sip_endpoint_id,
        call_verto_resource: updatedNumberData.call_verto_resource,
        call_video_room_id: updatedNumberData.call_video_room_id,
        message_handler: updatedNumberData.message_handler,
        message_request_url: updatedNumberData.message_request_url,
        message_request_method: updatedNumberData.message_request_method,
        message_fallback_url: updatedNumberData.message_fallback_url,
        message_fallback_method: updatedNumberData.message_fallback_method,
        message_laml_application_id: updatedNumberData.message_laml_application_id,
        message_relay_topic: updatedNumberData.message_relay_topic,
        message_relay_context: updatedNumberData.message_relay_context,
        message_relay_application: updatedNumberData.message_relay_application,
        signalwire_updated_at: updatedNumberData.updated_at,
        updated_at: new Date().toISOString()
      })
      .eq('signalwire_id', phoneNumberId)
      .select()
      .single()

    if (dbError) {
      console.error('DB Update Error:', dbError)
      throw new Error('Failed to update the phone number in the database.')
    }

    return new Response(JSON.stringify(updatedDbRecord), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in update-signalwire-phone-number function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
