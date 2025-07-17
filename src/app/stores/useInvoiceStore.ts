import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '../../supabaseClient'
import { journeyEventBus, JOURNEY_EVENTS } from './customerJourneyStore'
import { isFeatureEnabled } from '../../lib/config'

export type InvoiceContextType = 'journey' | 'job' | 'quote' | 'standalone'

export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  line_total?: number
  item_type?: 'service' | 'material' | 'labor' | 'other'
  sort_order?: number
}

export interface InvoiceSchema {
  id: string
  invoice_number: string
  tenant_id: string
  lead_id?: string | null
  job_id?: string | null
  quote_id?: string | null
  estimate_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  context_type: InvoiceContextType
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  title?: string
  description?: string
  line_items: InvoiceLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount?: number
  total_amount: number
  amount_paid: number
  balance_due: number
  due_date: string
  terms?: string
  notes?: string
  payment_terms?: 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'due_on_receipt'
  created_at: string
  updated_at: string
  sent_at?: string | null
  paid_at?: string | null
}

interface InvoiceStore {
  // State
  invoice: InvoiceSchema | null
  invoiceId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setInvoice: (invoice: InvoiceSchema) => void
  updateInvoice: (updates: Partial<InvoiceSchema>) => void
  clearInvoice: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Context helpers
  isJourneyInvoice: () => boolean
  isJobInvoice: () => boolean
  isQuoteInvoice: () => boolean
  isStandaloneInvoice: () => boolean
  
  // Operations
  loadInvoice: (invoiceId: string) => Promise<void>
  createInvoice: (invoiceData: Partial<InvoiceSchema>) => Promise<InvoiceSchema>
  updateInvoiceStatus: (invoiceId: string, status: InvoiceSchema['status']) => Promise<void>
  recordPayment: (invoiceId: string, amount: number, paymentMethod?: string) => Promise<void>
  markAsPaid: (invoiceId: string) => Promise<void>
  
  // Integration with journey
  linkToJourney: (invoiceId: string, leadId: string) => Promise<void>
  linkToJob: (invoiceId: string, jobId: string) => Promise<void>
}

export const useInvoiceStore = create<InvoiceStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        invoice: null,
        invoiceId: null,
        isLoading: false,
        error: null,

        // Basic setters
        setInvoice: (invoice) => {
          set({ invoice, invoiceId: invoice.id })
          
          // Emit event if journey feature is enabled
          if (isFeatureEnabled('unifiedJourney') && (invoice.lead_id || invoice.job_id)) {
            journeyEventBus.emit('journey:invoice_created', { invoice })
          }
        },

        updateInvoice: (updates) =>
          set((state) => ({
            invoice: state.invoice ? { ...state.invoice, ...updates } : null,
          })),

        clearInvoice: () => set({ invoice: null, invoiceId: null, error: null }),

        setLoading: (loading) => set({ isLoading: loading }),
        
        setError: (error) => set({ error }),

        // Context helpers
        isJourneyInvoice: () => get().invoice?.context_type === 'journey',
        isJobInvoice: () => get().invoice?.context_type === 'job',
        isQuoteInvoice: () => get().invoice?.context_type === 'quote',
        isStandaloneInvoice: () => get().invoice?.context_type === 'standalone',

        // Load invoice from database
        loadInvoice: async (invoiceId) => {
          set({ isLoading: true, error: null })
          
          try {
            const { data, error } = await supabase
              .from('invoices')
              .select(`
                *,
                invoice_line_items (*),
                invoice_payments (*)
              `)
              .eq('id', invoiceId)
              .single()

            if (error) throw error

            // Calculate balance due from payments
            const totalPaid = data.invoice_payments?.reduce(
              (sum: number, payment: any) => sum + (payment.amount || 0), 
              0
            ) || 0

            set({ 
              invoice: {
                ...data,
                amount_paid: totalPaid,
                balance_due: data.total_amount - totalPaid
              } as InvoiceSchema, 
              invoiceId: data.id,
              isLoading: false 
            })
          } catch (error) {
            console.error('Error loading invoice:', error)
            set({ 
              error: error instanceof Error ? error.message : 'Failed to load invoice',
              isLoading: false 
            })
          }
        },

        // Create new invoice
        createInvoice: async (invoiceData) => {
          set({ isLoading: true, error: null })
          
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Generate invoice number
            const invoiceNumber = await generateInvoiceNumber()
            
            const { line_items, ...invoiceFields } = invoiceData
            
            // Calculate balance due
            const balanceDue = (invoiceData.total_amount || 0) - (invoiceData.amount_paid || 0)
            
            // Create invoice
            const { data: invoice, error } = await supabase
              .from('invoices')
              .insert({
                ...invoiceFields,
                invoice_number: invoiceNumber,
                balance_due: balanceDue,
                created_by: user.id
              })
              .select()
              .single()

            if (error) throw error

            // Create line items if provided
            if (line_items && line_items.length > 0) {
              const { error: lineItemsError } = await supabase
                .from('invoice_line_items')
                .insert(
                  line_items.map((item, index) => ({
                    invoice_id: invoice.id,
                    tenant_id: invoice.tenant_id,
                    ...item,
                    sort_order: index
                  }))
                )

              if (lineItemsError) throw lineItemsError
            }

            // Log activity
            await logInvoiceActivity(invoice, 'invoice_created', user.id)

            const completeInvoice = { 
              ...invoice, 
              line_items: line_items || [],
              amount_paid: 0,
              balance_due: invoice.total_amount
            } as InvoiceSchema
            
            get().setInvoice(completeInvoice)
            set({ isLoading: false })
            
            return completeInvoice
          } catch (error) {
            console.error('Error creating invoice:', error)
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create invoice',
              isLoading: false 
            })
            throw error
          }
        },

        // Update invoice status
        updateInvoiceStatus: async (invoiceId, status) => {
          try {
            const updateData: any = {
              status,
              updated_at: new Date().toISOString()
            }

            // Set sent_at if sending
            if (status === 'sent' && !get().invoice?.sent_at) {
              updateData.sent_at = new Date().toISOString()
            }

            const { error } = await supabase
              .from('invoices')
              .update(updateData)
              .eq('id', invoiceId)

            if (error) throw error

            get().updateInvoice({ status, ...updateData })
            
            if (isFeatureEnabled('unifiedJourney')) {
              journeyEventBus.emit('journey:invoice_status_changed', { invoiceId, status })
            }
          } catch (error) {
            console.error('Error updating invoice status:', error)
            throw error
          }
        },

        // Record a payment
        recordPayment: async (invoiceId, amount, paymentMethod = 'other') => {
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Create payment record
            const { data: payment, error } = await supabase
              .from('invoice_payments')
              .insert({
                invoice_id: invoiceId,
                tenant_id: get().invoice?.tenant_id,
                amount,
                payment_method: paymentMethod,
                payment_date: new Date().toISOString(),
                recorded_by: user.id
              })
              .select()
              .single()

            if (error) throw error

            // Get updated invoice to check if fully paid
            const { data: invoice } = await supabase
              .from('invoices')
              .select('total_amount')
              .eq('id', invoiceId)
              .single()

            // Calculate new totals
            const currentPaid = get().invoice?.amount_paid || 0
            const newAmountPaid = currentPaid + amount
            const newBalanceDue = (invoice?.total_amount || 0) - newAmountPaid

            // Update invoice status if fully paid
            if (newBalanceDue <= 0) {
              await get().updateInvoiceStatus(invoiceId, 'paid')
              
              const { error: paidError } = await supabase
                .from('invoices')
                .update({ 
                  paid_at: new Date().toISOString(),
                  balance_due: 0,
                  amount_paid: invoice?.total_amount || newAmountPaid
                })
                .eq('id', invoiceId)

              if (paidError) throw paidError
            } else {
              // Just update the amounts
              const { error: updateError } = await supabase
                .from('invoices')
                .update({ 
                  amount_paid: newAmountPaid,
                  balance_due: newBalanceDue,
                  status: 'partial'
                })
                .eq('id', invoiceId)

              if (updateError) throw updateError
            }

            get().updateInvoice({ 
              amount_paid: newAmountPaid,
              balance_due: newBalanceDue
            })

            // Log activity
            await logInvoiceActivity(get().invoice!, 'payment_recorded', user.id, {
              payment_id: payment.id,
              amount,
              payment_method: paymentMethod
            })

            if (isFeatureEnabled('unifiedJourney')) {
              journeyEventBus.emit('journey:invoice_payment_recorded', { 
                invoiceId, 
                amount, 
                newBalanceDue 
              })
            }
          } catch (error) {
            console.error('Error recording payment:', error)
            throw error
          }
        },

        // Mark invoice as fully paid
        markAsPaid: async (invoiceId) => {
          const invoice = get().invoice
          if (!invoice) return

          await get().recordPayment(invoiceId, invoice.balance_due, 'manual')
        },

        // Link standalone invoice to journey
        linkToJourney: async (invoiceId, leadId) => {
          try {
            const { error } = await supabase
              .from('invoices')
              .update({ 
                lead_id: leadId,
                context_type: 'journey',
                updated_at: new Date().toISOString()
              })
              .eq('id', invoiceId)

            if (error) throw error

            get().updateInvoice({ 
              lead_id: leadId, 
              context_type: 'journey' 
            })
            
            journeyEventBus.emit('journey:invoice_linked', { invoiceId, leadId })
          } catch (error) {
            console.error('Error linking invoice to journey:', error)
            throw error
          }
        },

        // Link invoice to job
        linkToJob: async (invoiceId, jobId) => {
          try {
            const { error } = await supabase
              .from('invoices')
              .update({ 
                job_id: jobId,
                context_type: 'job',
                updated_at: new Date().toISOString()
              })
              .eq('id', invoiceId)

            if (error) throw error

            get().updateInvoice({ 
              job_id: jobId, 
              context_type: 'job' 
            })
            
            journeyEventBus.emit('journey:invoice_linked', { invoiceId, jobId })
          } catch (error) {
            console.error('Error linking invoice to job:', error)
            throw error
          }
        }
      }),
      {
        name: 'invoice-storage',
        partialize: (state) => ({ 
          invoiceId: state.invoiceId,
          // Don't persist invoice data itself, just the ID
        }),
      }
    )
  )
)

// Helper function to generate invoice numbers
async function generateInvoiceNumber(): Promise<string> {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  
  // Get count of invoices created today
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-${month}-${day}T00:00:00.000Z`)
    .lt('created_at', `${year}-${month}-${day}T23:59:59.999Z`)

  const sequence = String((count || 0) + 1).padStart(4, '0')
  return `INV-${year}${month}${day}-${sequence}`
}

// Helper function to log invoice activities
async function logInvoiceActivity(
  invoice: any, 
  activityType: string, 
  userId: string,
  metadata?: any
) {
  try {
    await supabase
      .from('activity_logs')
      .insert({
        tenant_id: invoice.tenant_id,
        entity_type: invoice.job_id ? 'job' : invoice.lead_id ? 'lead' : 'invoice',
        entity_id: invoice.job_id || invoice.lead_id || invoice.id,
        activity_type: activityType,
        description: getActivityDescription(activityType, invoice, metadata),
        performed_by: userId,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          amount: invoice.total_amount,
          context_type: invoice.context_type,
          ...metadata
        }
      })
  } catch (error) {
    console.error('Failed to log invoice activity:', error)
  }
}

function getActivityDescription(type: string, invoice: any, metadata?: any): string {
  switch (type) {
    case 'invoice_created':
      return `Invoice ${invoice.invoice_number} created for $${invoice.total_amount}`
    case 'payment_recorded':
      return `Payment of $${metadata?.amount} recorded on invoice ${invoice.invoice_number}`
    default:
      return `Invoice ${invoice.invoice_number} updated`
  }
}