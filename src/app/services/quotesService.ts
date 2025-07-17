import { supabase } from '../../supabaseClient'
import { QuoteSchema, QuoteLineItem } from '../stores/useQuoteStore'

export type { QuoteLineItem }

export interface Quote {
  id: string
  tenant_id: string
  quote_number?: string
  lead_id?: string | null
  job_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  context_type?: 'journey' | 'job' | 'standalone'
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired'
  title?: string
  description?: string
  subtotal?: number
  tax_rate?: number
  tax_amount?: number
  total_amount: number
  valid_until?: string
  notes?: string
  version?: number
  parent_quote_id?: string | null
  created_at: string
  updated_at: string
  approved_at?: string | null
  line_items?: QuoteLineItem[]
}

export interface QuoteWithRelations extends Quote {
  accounts?: {
    name: string
  } | null
  contacts?: {
    name: string
    first_name: string
    last_name: string
  } | null
  leads?: {
    name: string
    service_type: string
  } | null
  jobs?: {
    title: string
    job_number: string
  } | null
}

class QuotesService {
  async getQuotes(searchTerm?: string, statusFilter?: string): Promise<QuoteWithRelations[]> {
    try {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          accounts!left(name),
          contacts!left(name, first_name, last_name),
          leads!left(name, service_type),
          jobs!left(title, job_number)
        `)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`
          quote_number.ilike.%${searchTerm}%,
          title.ilike.%${searchTerm}%,
          description.ilike.%${searchTerm}%
        `)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching quotes:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getQuotes:', error)
      throw error
    }
  }

  async getQuoteById(id: string): Promise<QuoteWithRelations | null> {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          accounts!left(name),
          contacts!left(name, first_name, last_name),
          leads!left(name, service_type),
          jobs!left(title, job_number)
        `)
        .eq('id', id)
        .single()

      if (quoteError) {
        console.error('Error fetching quote:', quoteError)
        return null
      }

      // Fetch line items
      const { data: lineItems, error: lineItemsError } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', id)
        .order('sort_order')

      if (lineItemsError) {
        console.error('Error fetching line items:', lineItemsError)
      }

      return {
        ...quote,
        line_items: lineItems || []
      }
    } catch (error) {
      console.error('Error in getQuoteById:', error)
      return null
    }
  }

  async createQuote(quoteData: Partial<Quote> & { line_items?: QuoteLineItem[] }): Promise<QuoteWithRelations> {
    try {
      // Generate quote number
      const quoteNumber = await this.generateQuoteNumber()
      
      // Extract line items from quote data
      const { line_items, ...quoteFields } = quoteData
      
      const { data, error } = await supabase
        .from('quotes')
        .insert([{
          ...quoteFields,
          quote_number: quoteNumber,
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating quote:', error)
        throw error
      }

      // Create line items if provided
      if (line_items && line_items.length > 0) {
        await this.createLineItems(data.id, data.tenant_id, line_items)
      }

      // Log activity
      if (data.lead_id || data.job_id) {
        const user = (await supabase.auth.getUser()).data.user
        
        try {
          await supabase
            .from('activity_logs')
            .insert([{
              tenant_id: data.tenant_id,
              entity_type: data.lead_id ? 'lead' : 'job',
              entity_id: data.lead_id || data.job_id,
              activity_type: 'quote_created',
              description: `Quote ${data.quote_number} created for $${data.total_amount}`,
              performed_by: user?.id || null,
              metadata: {
                quote_id: data.id,
                quote_number: data.quote_number,
                amount: data.total_amount,
                status: data.status,
                context_type: data.context_type
              }
            }])
        } catch (activityError) {
          console.error('Failed to log quote creation activity:', activityError)
        }
      }

      // Return quote with line items
      return await this.getQuoteById(data.id) as QuoteWithRelations
    } catch (error) {
      console.error('Error in createQuote:', error)
      throw error
    }
  }

  async updateQuote(id: string, quoteData: Partial<Quote> & { line_items?: QuoteLineItem[] }): Promise<QuoteWithRelations> {
    try {
      // Get current quote for comparison
      const { data: oldQuote } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .single()

      // Extract line items from quote data
      const { line_items, ...quoteFields } = quoteData
      
      const { data, error } = await supabase
        .from('quotes')
        .update({
          ...quoteFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating quote:', error)
        throw error
      }

      // Update line items if provided
      if (line_items !== undefined) {
        // Delete existing line items
        await supabase
          .from('quote_line_items')
          .delete()
          .eq('quote_id', id)
        
        // Create new line items
        if (line_items.length > 0) {
          await this.createLineItems(id, data.tenant_id, line_items)
        }
      }

      // Log activity
      if (data.lead_id || data.job_id) {
        const user = (await supabase.auth.getUser()).data.user
        
        try {
          const changes = []
          if (oldQuote?.status !== data.status) {
            changes.push(`status changed from ${oldQuote?.status} to ${data.status}`)
          }
          if (oldQuote?.total_amount !== data.total_amount) {
            changes.push(`amount changed from $${oldQuote?.total_amount} to $${data.total_amount}`)
          }
          
          await supabase
            .from('activity_logs')
            .insert([{
              tenant_id: data.tenant_id,
              entity_type: data.lead_id ? 'lead' : 'job',
              entity_id: data.lead_id || data.job_id,
              activity_type: 'quote_updated',
              description: `Quote ${data.quote_number} updated${changes.length > 0 ? ': ' + changes.join(', ') : ''}`,
              performed_by: user?.id || null,
              metadata: {
                quote_id: id,
                quote_number: data.quote_number,
                changes
              }
            }])
        } catch (activityError) {
          console.error('Failed to log quote update activity:', activityError)
        }
      }

      // Return updated quote with line items
      return await this.getQuoteById(id) as QuoteWithRelations
    } catch (error) {
      console.error('Error in updateQuote:', error)
      throw error
    }
  }

  async deleteQuote(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting quote:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteQuote:', error)
      throw error
    }
  }

  async updateQuoteStatus(id: string, status: string, feedback?: string): Promise<void> {
    try {
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      }

      // Add feedback if provided
      if (feedback) {
        updateData.customer_feedback = feedback
      }

      // Set approved_at if approving
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('quotes')
        .update(updateData)
        .eq('id', id)

      if (error) {
        console.error('Error updating quote status:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in updateQuoteStatus:', error)
      throw error
    }
  }

  private async generateQuoteNumber(): Promise<string> {
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

  private async createLineItems(quoteId: string, tenantId: string, lineItems: QuoteLineItem[]): Promise<void> {
    const lineItemsToInsert = lineItems.map((item, index) => ({
      quote_id: quoteId,
      tenant_id: tenantId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
      item_type: item.item_type || 'service',
      sort_order: index
    }))

    const { error } = await supabase
      .from('quote_line_items')
      .insert(lineItemsToInsert)

    if (error) {
      console.error('Error creating line items:', error)
      throw error
    }
  }

  async linkToLead(quoteId: string, leadId: string): Promise<void> {
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
    } catch (error) {
      console.error('Error linking quote to lead:', error)
      throw error
    }
  }
}

export const quotesService = new QuotesService()