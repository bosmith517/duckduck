// supabase/functions/send-sms/index.ts
// CORRECTED VERSION: Uses the correct API Key SID for authentication.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Correctly renamed variables to match database schema for clarity
    const { to_number, from_number, body, contact_id, user_id, tenant_id } = await req.json()

    if (!to_number || !from_number || !body || !contact_id || !tenant_id) {
      throw new Error('Missing required parameters: to_number, from_number, body, contact_id, or tenant_id.')
    }

    // --- Send SMS via SignalWire (Server-to-Server) ---
    const signalwireSpaceUrl = Deno.env.get('SIGNALWIRE_SPACE_URL')!
    // ** THE FIX IS HERE: Using the API Key SID, not the Project ID **
    const signalwireApiKeySid = Deno.env.get('SIGNALWIRE_API_KEY_SID')!
    const signalwireApiToken = Deno.env.get('SIGNALWIRE_API_TOKEN')!
    
    const auth = btoa(`${signalwireApiKeySid}:${signalwireApiToken}`);

    // ** AND HERE: The URL also uses the API Key SID **
    const response = await fetch(`https://${signalwireSpaceUrl}/api/laml/2010-04-01/Accounts/${signalwireApiKeySid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: to_number,
        From: from_number,
        Body: body
      })
    })

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to send SMS: ${errorData.message}`);
    }

    const responseData = await response.json();
    const provider_id = responseData.sid;

    // --- Log the outbound message to our database ---
    const { error: logError } = await supabaseAdmin
      .from('sms_messages')
      .insert({
        tenant_id,
        contact_id,
        user_id, // This can be null
        from_number,
        to_number,
        body,
        direction: 'outbound',
        status: 'sent',
        provider_id
      })

    if (logError) {
      console.error('Failed to log outbound SMS:', logError.message)
    }

    return new Response(JSON.stringify({ success: true, messageSid: provider_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})