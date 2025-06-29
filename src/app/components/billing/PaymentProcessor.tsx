import React, { useState, useEffect } from 'react'
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!)

interface PaymentProcessorProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: (paymentData: PaymentResult) => void
  invoice: {
    id: string
    invoice_number: string
    project_title: string
    total_amount: number
    tenant_id: string
  }
  customer: {
    name: string
    email: string
  }
}

interface PaymentResult {
  payment_id: string
  amount: number
  payment_method: string
  transaction_id: string
  processor_fee: number
  net_amount: number
}

const PaymentForm: React.FC<{
  invoice: PaymentProcessorProps['invoice']
  customer: PaymentProcessorProps['customer']
  onSuccess: (result: PaymentResult) => void
  onCancel: () => void
}> = ({ invoice, customer, onSuccess, onCancel }) => {
  const stripe = useStripe()
  const elements = useElements()
  
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach' | 'paypal'>('card')
  const [savePaymentMethod, setSavePaymentMethod] = useState(false)
  const [billingDetails, setBillingDetails] = useState({
    name: customer.name,
    email: customer.email,
    address: {
      line1: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US'
    }
  })

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      showToast.error('Payment system is not ready. Please try again.')
      return
    }

    const card = elements.getElement(CardElement)
    if (!card) {
      showToast.error('Card information is required')
      return
    }

    setLoading(true)
    try {
      // Create payment intent on the server
      const { data: paymentIntent, error: intentError } = await supabase.functions.invoke(
        'create-payment-intent',
        {
          body: {
            invoice_id: invoice.id,
            amount: Math.round(invoice.total_amount * 100), // Convert to cents
            currency: 'usd',
            customer_email: customer.email,
            customer_name: customer.name,
            save_payment_method: savePaymentMethod
          }
        }
      )

      if (intentError) {
        throw new Error(`Failed to create payment intent: ${intentError.message}`)
      }

      // Confirm payment with Stripe
      const { error: confirmError, paymentIntent: confirmedIntent } = await stripe.confirmCardPayment(
        paymentIntent.client_secret,
        {
          payment_method: {
            card: card,
            billing_details: billingDetails
          }
        }
      )

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed')
      }

      if (confirmedIntent?.status === 'succeeded') {
        // Record the payment in our database
        const paymentData = {
          invoice_id: invoice.id,
          tenant_id: invoice.tenant_id,
          payment_method: 'credit_card',
          amount: invoice.total_amount,
          transaction_id: confirmedIntent.id,
          processor: 'stripe',
          processor_fee: (invoice.total_amount * 0.029) + 0.30, // Stripe's typical fee
          payment_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        }

        const { error: recordError } = await supabase
          .from('invoice_payments')
          .insert(paymentData)

        if (recordError) {
          throw new Error(`Payment succeeded but failed to record: ${recordError.message}`)
        }

        // Update invoice payment status
        await updateInvoicePaymentStatus(invoice.id)

        const result: PaymentResult = {
          payment_id: confirmedIntent.id,
          amount: invoice.total_amount,
          payment_method: 'credit_card',
          transaction_id: confirmedIntent.id,
          processor_fee: paymentData.processor_fee,
          net_amount: invoice.total_amount - paymentData.processor_fee
        }

        showToast.success('Payment processed successfully!')
        onSuccess(result)
      } else {
        throw new Error('Payment was not completed successfully')
      }

    } catch (error: any) {
      console.error('Payment error:', error)
      showToast.error(error.message || 'Payment failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateInvoicePaymentStatus = async (invoiceId: string) => {
    // Calculate total payments for this invoice
    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('amount')
      .eq('invoice_id', invoiceId)

    const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    
    let paymentStatus = 'unpaid'
    if (totalPaid >= invoice.total_amount) {
      paymentStatus = 'paid'
    } else if (totalPaid > 0) {
      paymentStatus = 'partial'
    }

    await supabase
      .from('invoices')
      .update({ 
        payment_status: paymentStatus,
        viewed_at: new Date().toISOString() // Mark as viewed when paid
      })
      .eq('id', invoiceId)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Payment Summary */}
      <div className="alert alert-light-primary mb-6">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h6 className="alert-heading mb-1">Invoice Payment</h6>
            <p className="mb-0">
              {invoice.invoice_number} - {invoice.project_title}
            </p>
          </div>
          <div className="text-end">
            <div className="fs-2x fw-bold text-primary">
              {formatCurrency(invoice.total_amount)}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-6">
        <label className="form-label required">Payment Method</label>
        <div className="row g-3">
          <div className="col-md-4">
            <div className={`card border ${paymentMethod === 'card' ? 'border-primary' : 'border-light'} cursor-pointer`}>
              <div className="card-body text-center py-4" onClick={() => setPaymentMethod('card')}>
                <i className="ki-duotone ki-credit-card fs-2x text-primary mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold">Credit/Debit Card</div>
                <div className="text-muted fs-7">Visa, Mastercard, Amex</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className={`card border ${paymentMethod === 'ach' ? 'border-primary' : 'border-light'} cursor-pointer opacity-50`}>
              <div className="card-body text-center py-4">
                <i className="ki-duotone ki-bank fs-2x text-muted mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-muted">Bank Transfer</div>
                <div className="text-muted fs-7">Coming Soon</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className={`card border ${paymentMethod === 'paypal' ? 'border-primary' : 'border-light'} cursor-pointer opacity-50`}>
              <div className="card-body text-center py-4">
                <i className="ki-duotone ki-paypal fs-2x text-muted mb-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="fw-bold text-muted">PayPal</div>
                <div className="text-muted fs-7">Coming Soon</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="row g-4 mb-6">
        <div className="col-md-6">
          <label className="form-label required">Full Name</label>
          <input
            type="text"
            className="form-control"
            value={billingDetails.name}
            onChange={(e) => setBillingDetails(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="col-md-6">
          <label className="form-label required">Email</label>
          <input
            type="email"
            className="form-control"
            value={billingDetails.email}
            onChange={(e) => setBillingDetails(prev => ({ ...prev, email: e.target.value }))}
            required
          />
        </div>
      </div>

      {/* Card Information */}
      {paymentMethod === 'card' && (
        <div className="mb-6">
          <label className="form-label required">Card Information</label>
          <div className="card border border-light">
            <div className="card-body">
              <CardElement options={cardElementOptions} />
            </div>
          </div>
          <div className="form-text">
            <i className="ki-duotone ki-shield-tick fs-6 text-success me-1">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Your payment information is encrypted and secure
          </div>
        </div>
      )}

      {/* Billing Address */}
      <div className="row g-4 mb-6">
        <div className="col-12">
          <label className="form-label">Billing Address</label>
          <input
            type="text"
            className="form-control"
            placeholder="Street address"
            value={billingDetails.address.line1}
            onChange={(e) => setBillingDetails(prev => ({ 
              ...prev, 
              address: { ...prev.address, line1: e.target.value }
            }))}
          />
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="City"
            value={billingDetails.address.city}
            onChange={(e) => setBillingDetails(prev => ({ 
              ...prev, 
              address: { ...prev.address, city: e.target.value }
            }))}
          />
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="State"
            value={billingDetails.address.state}
            onChange={(e) => setBillingDetails(prev => ({ 
              ...prev, 
              address: { ...prev.address, state: e.target.value }
            }))}
          />
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="ZIP Code"
            value={billingDetails.address.postal_code}
            onChange={(e) => setBillingDetails(prev => ({ 
              ...prev, 
              address: { ...prev.address, postal_code: e.target.value }
            }))}
          />
        </div>
      </div>

      {/* Save Payment Method */}
      <div className="form-check form-check-custom form-check-solid mb-6">
        <input
          className="form-check-input"
          type="checkbox"
          checked={savePaymentMethod}
          onChange={(e) => setSavePaymentMethod(e.target.checked)}
        />
        <label className="form-check-label">
          Save payment method for future use
        </label>
      </div>

      {/* Processing Fees */}
      <div className="alert alert-light-info mb-6">
        <h6 className="alert-heading">Payment Processing</h6>
        <div className="d-flex justify-content-between">
          <span>Invoice Amount:</span>
          <span>{formatCurrency(invoice.total_amount)}</span>
        </div>
        <div className="d-flex justify-content-between text-muted fs-7">
          <span>Processing Fee (2.9% + $0.30):</span>
          <span>{formatCurrency((invoice.total_amount * 0.029) + 0.30)}</span>
        </div>
        <hr className="my-2" />
        <div className="d-flex justify-content-between fw-bold">
          <span>Total to Charge:</span>
          <span>{formatCurrency(invoice.total_amount)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="d-flex justify-content-between">
        <button
          type="button"
          className="btn btn-light text-dark"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-success"
          disabled={!stripe || loading}
        >
          {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
          <i className="ki-duotone ki-shield-tick fs-5 me-2">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          Pay {formatCurrency(invoice.total_amount)}
        </button>
      </div>
    </form>
  )
}

const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  invoice,
  customer
}) => {
  if (!isOpen) return null

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title">
              <i className="ki-duotone ki-credit-card fs-2 text-success me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Secure Payment
            </h3>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>

          <div className="modal-body">
            <Elements stripe={stripePromise}>
              <PaymentForm
                invoice={invoice}
                customer={customer}
                onSuccess={onPaymentSuccess}
                onCancel={onClose}
              />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentProcessor