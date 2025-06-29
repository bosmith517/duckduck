import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

    if (!supabaseUrl || !supabaseServiceKey || !stripeWebhookSecret) {
      throw new Error('Missing required environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get Stripe signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('No Stripe signature found')
    }

    // Get raw body for signature verification
    const body = await req.arrayBuffer()
    const bodyString = new TextDecoder().decode(body)

    // Verify webhook signature (simplified - in production use proper crypto verification)
    console.log('Received Stripe webhook with signature:', signature.substring(0, 20) + '...')

    // Parse the event
    const event = JSON.parse(bodyString)
    console.log('Processing Stripe event:', event.type, 'for object:', event.data?.object?.id)

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(supabase, event.data.object)
        break
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(supabase, event.data.object)
        break
        
      case 'payment_method.attached':
        await handlePaymentMethodAttached(supabase, event.data.object)
        break
        
      case 'invoice.payment_succeeded':
        // Handle Stripe invoice payments (if using Stripe invoicing)
        console.log('Stripe invoice payment succeeded:', event.data.object.id)
        break
        
      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing Stripe webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handlePaymentSucceeded(supabase: any, paymentIntent: any) {
  console.log('Processing successful payment:', paymentIntent.id)
  
  const invoiceId = paymentIntent.metadata?.invoice_id
  const tenantId = paymentIntent.metadata?.tenant_id
  
  if (!invoiceId || !tenantId) {
    console.error('Missing metadata in payment intent:', paymentIntent.id)
    return
  }

  try {
    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('total_amount, payment_status')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found: ' + invoiceId)
    }

    // Calculate processor fee (Stripe's typical fee: 2.9% + $0.30)
    const amount = paymentIntent.amount / 100 // Convert from cents
    const processorFee = (amount * 0.029) + 0.30

    // Record the payment
    const { error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        tenant_id: tenantId,
        payment_method: 'credit_card',
        amount: amount,
        transaction_id: paymentIntent.id,
        processor: 'stripe',
        processor_fee: processorFee,
        payment_date: new Date().toISOString().split('T')[0],
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          stripe_customer_id: paymentIntent.customer,
          payment_method_id: paymentIntent.payment_method,
          receipt_url: paymentIntent.charges?.data?.[0]?.receipt_url
        },
        created_at: new Date().toISOString()
      })

    if (paymentError) {
      throw new Error('Failed to record payment: ' + paymentError.message)
    }

    // Update payment attempt status
    await supabase
      .from('payment_attempts')
      .update({ 
        status: 'succeeded',
        completed_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    // Calculate new payment status
    const { data: allPayments } = await supabase
      .from('invoice_payments')
      .select('amount')
      .eq('invoice_id', invoiceId)

    const totalPaid = allPayments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0
    
    let paymentStatus = 'unpaid'
    if (totalPaid >= invoice.total_amount) {
      paymentStatus = 'paid'
    } else if (totalPaid > 0) {
      paymentStatus = 'partial'
    }

    // Update invoice payment status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        payment_status: paymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (updateError) {
      throw new Error('Failed to update invoice status: ' + updateError.message)
    }

    // Send payment confirmation email (optional)
    if (paymentStatus === 'paid') {
      await sendPaymentConfirmationEmail(supabase, invoiceId, amount, paymentIntent.id)
    }

    console.log('Payment processed successfully for invoice:', invoiceId, 'Amount:', amount)

  } catch (error) {
    console.error('Error handling payment success:', error)
    
    // Log the error for troubleshooting
    await supabase
      .from('webhook_errors')
      .insert({
        event_type: 'payment_intent.succeeded',
        stripe_object_id: paymentIntent.id,
        error_message: error.message,
        raw_data: paymentIntent,
        created_at: new Date().toISOString()
      })
  }
}

async function handlePaymentFailed(supabase: any, paymentIntent: any) {
  console.log('Processing failed payment:', paymentIntent.id)
  
  const invoiceId = paymentIntent.metadata?.invoice_id
  
  if (!invoiceId) {
    console.error('Missing invoice_id in payment intent metadata')
    return
  }

  try {
    // Update payment attempt status
    await supabase
      .from('payment_attempts')
      .update({ 
        status: 'failed',
        error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
        completed_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    // Log the failure for follow-up
    await supabase
      .from('payment_failures')
      .insert({
        invoice_id: invoiceId,
        stripe_payment_intent_id: paymentIntent.id,
        failure_reason: paymentIntent.last_payment_error?.message || 'Unknown error',
        failure_code: paymentIntent.last_payment_error?.code,
        created_at: new Date().toISOString()
      })

    console.log('Payment failure recorded for invoice:', invoiceId)

  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}

async function handlePaymentMethodAttached(supabase: any, paymentMethod: any) {
  console.log('Payment method attached:', paymentMethod.id)
  
  try {
    // Save payment method for future use
    await supabase
      .from('saved_payment_methods')
      .insert({
        stripe_payment_method_id: paymentMethod.id,
        stripe_customer_id: paymentMethod.customer,
        type: paymentMethod.type,
        card_brand: paymentMethod.card?.brand,
        card_last4: paymentMethod.card?.last4,
        card_exp_month: paymentMethod.card?.exp_month,
        card_exp_year: paymentMethod.card?.exp_year,
        is_active: true,
        created_at: new Date().toISOString()
      })

    console.log('Payment method saved successfully')

  } catch (error) {
    console.error('Error saving payment method:', error)
  }
}

async function sendPaymentConfirmationEmail(supabase: any, invoiceId: string, amount: number, transactionId: string) {
  try {
    // Get invoice and customer details
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        invoice_number,
        project_title,
        accounts!inner(name),
        contacts!inner(email, first_name, last_name)
      `)
      .eq('id', invoiceId)
      .single()

    if (!invoice) {
      console.error('Invoice not found for confirmation email:', invoiceId)
      return
    }

    // In a real implementation, you would send an email here
    // Using a service like SendGrid, Postmark, or AWS SES
    console.log('Would send payment confirmation email to:', invoice.contacts.email)
    console.log('Payment details:', {
      invoice_number: invoice.invoice_number,
      amount: amount,
      transaction_id: transactionId
    })

    // Example: Queue email for sending
    await supabase
      .from('email_queue')
      .insert({
        to_email: invoice.contacts.email,
        to_name: `${invoice.contacts.first_name} ${invoice.contacts.last_name}`,
        subject: `Payment Confirmation - Invoice ${invoice.invoice_number}`,
        template: 'payment_confirmation',
        template_data: {
          customer_name: invoice.contacts.first_name,
          invoice_number: invoice.invoice_number,
          project_title: invoice.project_title,
          amount: amount,
          transaction_id: transactionId,
          company_name: invoice.accounts.name
        },
        status: 'pending',
        created_at: new Date().toISOString()
      })

  } catch (error) {
    console.error('Error sending payment confirmation email:', error)
  }
}