import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { supabase } from '../../supabaseClient'
import { journeyEventBus, JOURNEY_EVENTS } from './customerJourneyStore'
import { isFeatureEnabled } from '../../lib/config'

export type QuoteContextType = 'journey' | 'job' | 'standalone'

export interface QuoteLineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  line_total?: number
  item_type?: 'service' | 'material' | 'labor' | 'other'
  sort_order?: number
}

export interface QuoteSchema {
  id: string
  quote_number: string
  tenant_id: string
  lead_id?: string | null
  job_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  context_type: QuoteContextType
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired'
  title: string
  description?: string
  line_items: QuoteLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  valid_until: string
  notes?: string
  version: number
  parent_quote_id?: string | null
  created_at: string
  updated_at: string
  approved_at?: string | null
}

interface QuoteStore {
  // State
  quote: QuoteSchema | null
  quoteId: string | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setQuote: (quote: QuoteSchema) => void
  updateQuote: (updates: Partial<QuoteSchema>) => void
  clearQuote: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Context helpers
  isJourneyQuote: () => boolean
  isChangeOrderQuote: () => boolean
  isStandaloneQuote: () => boolean
  
  // Operations
  loadQuote: (quoteId: string) => Promise<void>
  createQuote: (quoteData: Partial<QuoteSchema>) => Promise<QuoteSchema>
  updateQuoteStatus: (quoteId: string, status: QuoteSchema['status']) => Promise<void>
  approveQuote: (quoteId: string) => void
  
  // Integration with journey
  linkToJourney: (quoteId: string, leadId: string) => Promise<void>
}

export const useQuoteStore = create<QuoteStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        quote: null,
        quoteId: null,
        isLoading: false,
        error: null,

        // Basic setters
        setQuote: (quote) => {
          set({ quote, quoteId: quote.id })
          
          // Emit event if journey feature is enabled
          if (isFeatureEnabled('unifiedJourney') && quote.lead_id) {
            journeyEventBus.emit('journey:quote_created', { quote })
          }
        },

        updateQuote: (updates) =>
          set((state) => ({
            quote: state.quote ? { ...state.quote, ...updates } : null,
          })),

        clearQuote: () => set({ quote: null, quoteId: null, error: null }),

        setLoading: (loading) => set({ isLoading: loading }),
        
        setError: (error) => set({ error }),

        // Context helpers
        isJourneyQuote: () => get().quote?.context_type === 'journey',
        isChangeOrderQuote: () => get().quote?.context_type === 'job',
        isStandaloneQuote: () => get().quote?.context_type === 'standalone',

        // Load quote from database
        loadQuote: async (quoteId) => {
          set({ isLoading: true, error: null })
          
          try {
            const { data, error } = await supabase
              .from('quotes')
              .select(`
                *,
                quote_line_items (*)
              `)
              .eq('id', quoteId)
              .single()

            if (error) throw error

            set({ 
              quote: data as QuoteSchema, 
              quoteId: data.id,
              isLoading: false 
            })
          } catch (error) {
            console.error('Error loading quote:', error)
            set({ 
              error: error instanceof Error ? error.message : 'Failed to load quote',
              isLoading: false 
            })
          }
        },

        // Create new quote
        createQuote: async (quoteData) => {
          set({ isLoading: true, error: null })
          
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            // Generate quote number
            const quoteNumber = await generateQuoteNumber()
            
            const { line_items, ...quoteFields } = quoteData
            
            // Create quote
            const { data: quote, error } = await supabase
              .from('quotes')
              .insert({
                ...quoteFields,
                quote_number: quoteNumber,
                created_by: user.id
              })
              .select()
              .single()

            if (error) throw error

            // Create line items if provided
            if (line_items && line_items.length > 0) {
              const { error: lineItemsError } = await supabase
                .from('quote_line_items')
                .insert(
                  line_items.map((item, index) => ({
                    quote_id: quote.id,
                    tenant_id: quote.tenant_id,
                    ...item,
                    sort_order: index
                  }))
                )

              if (lineItemsError) throw lineItemsError
            }

            const completeQuote = { ...quote, line_items: line_items || [] } as QuoteSchema
            get().setQuote(completeQuote)
            set({ isLoading: false })
            
            return completeQuote
          } catch (error) {
            console.error('Error creating quote:', error)
            set({ 
              error: error instanceof Error ? error.message : 'Failed to create quote',
              isLoading: false 
            })
            throw error
          }
        },

        // Update quote status
        updateQuoteStatus: async (quoteId, status) => {
          try {
            const { error } = await supabase
              .from('quotes')
              .update({ 
                status,
                updated_at: new Date().toISOString(),
                approved_at: status === 'approved' ? new Date().toISOString() : null
              })
              .eq('id', quoteId)

            if (error) throw error

            get().updateQuote({ status, approved_at: status === 'approved' ? new Date().toISOString() : undefined })
            
            if (status === 'approved' && isFeatureEnabled('unifiedJourney')) {
              journeyEventBus.emit('journey:quote_approved', { quoteId })
            }
          } catch (error) {
            console.error('Error updating quote status:', error)
            throw error
          }
        },

        // Approve quote helper
        approveQuote: (quoteId) => {
          get().updateQuoteStatus(quoteId, 'approved')
        },

        // Link standalone quote to journey
        linkToJourney: async (quoteId, leadId) => {
          try {
            const { error } = await supabase
              .from('quotes')
              .update({ 
                lead_id: leadId,
                context_type: 'journey',
                updated_at: new Date().toISOString()
              })
              .eq('id', quoteId)

            if (error) throw error

            get().updateQuote({ 
              lead_id: leadId, 
              context_type: 'journey' 
            })
            
            journeyEventBus.emit('journey:quote_linked', { quoteId, leadId })
          } catch (error) {
            console.error('Error linking quote to journey:', error)
            throw error
          }
        }
      }),
      {
        name: 'quote-storage',
        partialize: (state) => ({ 
          quoteId: state.quoteId,
          // Don't persist quote data itself, just the ID
        }),
      }
    )
  )
)

// Helper function to generate quote numbers
async function generateQuoteNumber(): Promise<string> {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  
  // Get count of quotes created today
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-${month}-${day}T00:00:00.000Z`)
    .lt('created_at', `${year}-${month}-${day}T23:59:59.999Z`)

  const sequence = String((count || 0) + 1).padStart(4, '0')
  return `QTE-${year}${month}${day}-${sequence}`
}