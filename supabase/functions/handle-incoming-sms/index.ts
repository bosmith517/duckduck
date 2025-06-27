// supabase/functions/handle-incoming-sms/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  try {
    // SignalWire sends data as form-urlencoded, not JSON
    const formData = await req.formData()
    const fromNumber = formData.get('From') as string
    const toNumber = formData.get('To') as string
    const body = formData.get('Body') as string
    const messageSid = formData.get('MessageSid') as string

    if (!fromNumber || !toNumber || !body || !messageSid) {
        throw new Error("Incoming webhook is missing required SignalWire parameters.");
    }
    
    // --- Find the corresponding contact and tenant in our database ---
    // We need to find which contact sent the message and which tenant owns the 'To' number
    const { data: numberData, error: numberError } = await supabaseAdmin
        .from('tenant_phone_numbers')
        .select('tenant_id')
        .eq('phone_number', toNumber)
        .single();
    
    if (numberError || !numberData) {
        throw new Error(`Received SMS to unassigned number: ${toNumber}`);
    }
    const tenant_id = numberData.tenant_id;

    // Now find the contact with the matching 'From' number for that tenant
    const { data: contactData, error: contactError } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('phone', fromNumber)
        .eq('tenant_id', tenant_id)
        .single();
    
    if (contactError || !contactData) {
        throw new Error(`Could not find a contact with phone number ${fromNumber} for the tenant.`);
    }
    const contact_id = contactData.id;

    // --- Log the inbound message to our database ---
    const { error: insertError } = await supabaseAdmin
      .from('sms_messages')
      .insert({
        tenant_id,
        contact_id,
        from_number: fromNumber,
        to_number: toNumber,
        body,
        direction: 'inbound',
        status: 'received',
        provider_id: messageSid,
      })

    if (insertError) {
      throw insertError;
    }

    // SignalWire expects a 200 OK response with an empty body to acknowledge receipt
    return new Response(null, { status: 204 });

  } catch (error) {
    console.error('Error in handle-incoming-sms webhook:', error.message)
    // It's often best to return a 200 OK even on error so SignalWire doesn't retry,
    // but log the error for debugging.
    return new Response(JSON.stringify({ error: "Failed to process incoming message." }), { status: 500 })
  }
})