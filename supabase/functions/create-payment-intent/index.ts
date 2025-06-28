import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request body
    const body = await req.json()
    const { 
      invoice_id, 
      amount, 
      currency = 'usd', 
      customer_email, 
      customer_name,
      save_payment_method = false 
    } = body

    if (!invoice_id || !amount || !customer_email) {
      throw new Error('Missing required fields: invoice_id, amount, customer_email')
    }

    console.log('Creating payment intent for invoice:', invoice_id, 'amount:', amount)

    // Get invoice details for validation
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        project_title,
        total_amount,
        payment_status,
        tenant_id,
        accounts!inner(name),
        contacts!inner(first_name, last_name, email)
      `)
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found')
    }

    // Validate amount matches invoice
    const expectedAmount = Math.round(invoice.total_amount * 100) // Convert to cents
    if (amount !== expectedAmount) {
      throw new Error(`Amount mismatch. Expected: ${expectedAmount}, received: ${amount}`)
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null
    
    // Check if we have a saved Stripe customer for this email
    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('email', customer_email)
      .eq('tenant_id', invoice.tenant_id)
      .single()

    if (existingCustomer) {
      stripeCustomerId = existingCustomer.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: customer_email,
          name: customer_name,
          metadata: JSON.stringify({
            tenant_id: invoice.tenant_id,
            invoice_id: invoice_id
          })
        })
      })

      if (!customerResponse.ok) {
        const errorText = await customerResponse.text()
        throw new Error(`Failed to create Stripe customer: ${errorText}`)
      }

      const stripeCustomer = await customerResponse.json()
      stripeCustomerId = stripeCustomer.id

      // Save customer to our database
      await supabase
        .from('stripe_customers')
        .insert({
          tenant_id: invoice.tenant_id,
          email: customer_email,
          name: customer_name,
          stripe_customer_id: stripeCustomerId
        })
    }

    // Create PaymentIntent
    const paymentIntentData = new URLSearchParams({
      amount: amount.toString(),
      currency: currency,
      customer: stripeCustomerId!,
      'metadata[invoice_id]': invoice_id,
      'metadata[tenant_id]': invoice.tenant_id,
      'metadata[invoice_number]': invoice.invoice_number,
      description: `Payment for ${invoice.invoice_number} - ${invoice.project_title}`,
      receipt_email: customer_email,
      statement_descriptor: invoice.accounts.name.substring(0, 22), // Max 22 chars
    })

    if (save_payment_method) {
      paymentIntentData.append('setup_future_usage', 'on_session')
    }

    const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paymentIntentData
    })

    if (!paymentIntentResponse.ok) {
      const errorText = await paymentIntentResponse.text()
      throw new Error(`Failed to create payment intent: ${errorText}`)
    }

    const paymentIntent = await paymentIntentResponse.json()

    console.log('Payment intent created successfully:', paymentIntent.id)

    // Log the payment attempt
    await supabase
      .from('payment_attempts')
      .insert({
        tenant_id: invoice.tenant_id,
        invoice_id: invoice_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount: invoice.total_amount,
        currency: currency,
        customer_email: customer_email,
        status: 'pending',
        created_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        customer_id: stripeCustomerId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})