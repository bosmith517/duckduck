import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TrackReferralRequest {
  referralCode: string
  referredName: string
  referredEmail: string
  referredPhone?: string
  source?: string
  landingPage?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { 
      referralCode, 
      referredName, 
      referredEmail, 
      referredPhone,
      source = 'direct_link',
      landingPage
    } = await req.json() as TrackReferralRequest

    // Get IP address and user agent
    const ipAddress = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Validate referral code exists and is active
    const { data: referralCodeData, error: codeError } = await supabaseClient
      .from('referral_codes')
      .select('*')
      .eq('code', referralCode)
      .eq('is_active', true)
      .single()

    if (codeError || !referralCodeData) {
      throw new Error('Invalid or inactive referral code')
    }

    // Check if this email has already been referred
    const { data: existingReferral } = await supabaseClient
      .from('referral_tracking')
      .select('id')
      .eq('referred_email', referredEmail)
      .eq('referral_code_id', referralCodeData.id)
      .single()

    if (existingReferral) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Referral already tracked',
          referralId: existingReferral.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the referral tracking record
    const { data: referralTracking, error: trackingError } = await supabaseClient
      .from('referral_tracking')
      .insert({
        tenant_id: referralCodeData.tenant_id,
        referral_code_id: referralCodeData.id,
        referred_name: referredName,
        referred_email: referredEmail,
        referred_phone: referredPhone,
        referral_source: source,
        landing_page: landingPage,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: 'pending'
      })
      .select()
      .single()

    if (trackingError) {
      throw new Error(`Failed to track referral: ${trackingError.message}`)
    }

    // Update referral code stats
    await supabaseClient
      .from('referral_codes')
      .update({ 
        total_referrals: referralCodeData.total_referrals + 1,
        last_shared_at: new Date().toISOString()
      })
      .eq('id', referralCodeData.id)

    // Create a lead record
    const { data: lead, error: leadError } = await supabaseClient
      .from('leads')
      .insert({
        tenant_id: referralCodeData.tenant_id,
        name: referredName,
        email: referredEmail,
        phone: referredPhone,
        status: 'new',
        source: 'referral',
        metadata: { 
          referral_code: referralCode,
          referring_customer_id: referralCodeData.customer_id,
          referral_tracking_id: referralTracking.id
        }
      })
      .select()
      .single()

    if (!leadError && lead) {
      // Update tracking with lead ID
      await supabaseClient
        .from('referral_tracking')
        .update({ referred_lead_id: lead.id })
        .eq('id', referralTracking.id)
    }

    // Get referring customer info for notification
    const { data: referringCustomer } = await supabaseClient
      .from('contacts')
      .select('first_name, last_name, email')
      .eq('id', referralCodeData.customer_id)
      .single()

    // Send notification email to referring customer
    if (referringCustomer?.email) {
      await supabaseClient.functions.invoke('send-email', {
        body: {
          to: referringCustomer.email,
          subject: 'Your referral has been received!',
          body: `
            <h2>Thank you for your referral!</h2>
            <p>Hi ${referringCustomer.first_name},</p>
            <p>Great news! ${referredName} has clicked on your referral link and expressed interest in our services.</p>
            <p>We'll reach out to them soon, and if they become a customer, you'll earn your referral reward!</p>
            <p>Keep track of all your referrals in your customer portal.</p>
            <p>Thank you for spreading the word!</p>
          `,
          tenantId: referralCodeData.tenant_id
        }
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Referral tracked successfully',
        referralId: referralTracking.id,
        leadId: lead?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error tracking referral:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to track referral' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})