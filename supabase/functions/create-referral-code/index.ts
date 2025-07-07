import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateReferralRequest {
  customerId: string
  customMessage?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { customerId, customMessage } = await req.json() as CreateReferralRequest

    // Verify the customer exists and get their info
    const { data: customer, error: customerError } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, tenant_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      throw new Error('Customer not found')
    }

    // Check if referral code already exists
    const { data: existingCode } = await supabaseClient
      .from('referral_codes')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (existingCode) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          referralCode: existingCode,
          message: 'Existing referral code retrieved'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate unique referral code
    const { data: codeResult, error: codeError } = await supabaseClient
      .rpc('generate_referral_code', { p_customer_id: customerId })

    if (codeError || !codeResult) {
      throw new Error('Failed to generate referral code')
    }

    // Create the referral code record
    const { data: newReferralCode, error: insertError } = await supabaseClient
      .from('referral_codes')
      .insert({
        tenant_id: customer.tenant_id,
        customer_id: customerId,
        code: codeResult,
        custom_message: customMessage,
        tier: 'bronze',
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create referral code: ${insertError.message}`)
    }

    // Generate QR code URL (using external service)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      `${Deno.env.get('PUBLIC_SITE_URL')}/refer/${codeResult}`
    )}`

    // Update with QR code URL
    await supabaseClient
      .from('referral_codes')
      .update({ qr_code_url: qrCodeUrl })
      .eq('id', newReferralCode.id)

    // Log the activity
    await supabaseClient
      .from('customer_activity_log')
      .insert({
        tenant_id: customer.tenant_id,
        customer_id: customerId,
        activity_type: 'referral_code_created',
        description: 'Customer created referral code',
        metadata: { referral_code: codeResult }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        referralCode: {
          ...newReferralCode,
          qr_code_url: qrCodeUrl
        },
        message: 'Referral code created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating referral code:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to create referral code' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})