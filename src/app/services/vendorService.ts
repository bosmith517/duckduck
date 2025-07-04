import { supabase } from '../../supabaseClient'

export interface Vendor {
  id: string
  tenant_id: string
  company_name: string
  contact_name?: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  website?: string
  trade_specialties: string[]
  preferred_vendor: boolean
  active: boolean
  payment_terms?: string
  tax_id?: string
  license_number?: string
  insurance_expiry?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface QuoteRequest {
  id: string
  tenant_id: string
  job_id: string
  request_number: string
  title: string
  description?: string
  trade_category?: string
  requested_delivery_date?: string
  site_address?: string
  status: 'draft' | 'sent' | 'responses_received' | 'awarded' | 'cancelled'
  sent_at?: string
  response_deadline?: string
  created_by?: string
  awarded_to?: string
  notes?: string
  created_at: string
  updated_at: string
  items?: QuoteRequestItem[]
  job?: {
    title: string
    location_address?: string
  }
}

export interface QuoteRequestItem {
  id?: string
  quote_request_id?: string
  item_name: string
  description?: string
  quantity: number
  unit: string
  specifications?: string
  brand_preference?: string
  model_number?: string
  notes?: string
}

export interface VendorQuote {
  id: string
  quote_request_id: string
  vendor_id: string
  quote_number?: string
  total_amount?: number
  tax_amount?: number
  delivery_fee?: number
  quoted_delivery_date?: string
  validity_period: number
  payment_terms?: string
  warranty_terms?: string
  notes?: string
  attachments: any[]
  status: 'submitted' | 'under_review' | 'accepted' | 'rejected'
  submitted_at: string
  reviewed_at?: string
  created_at: string
  updated_at: string
  vendor?: Vendor
  items?: VendorQuoteItem[]
}

export interface VendorQuoteItem {
  id?: string
  vendor_quote_id?: string
  quote_request_item_id: string
  item_name: string
  description?: string
  quantity: number
  unit_price: number
  total_price: number
  brand?: string
  model_number?: string
  specifications?: string
  lead_time_days?: number
  availability_notes?: string
}

export class VendorService {
  static async getVendors(tenantId: string): Promise<Vendor[]> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('company_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching vendors:', error)
      throw error
    }
  }

  static async getVendorsByTrade(tenantId: string, trade: string): Promise<Vendor[]> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .contains('trade_specialties', [trade])
        .order('preferred_vendor', { ascending: false })
        .order('company_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching vendors by trade:', error)
      throw error
    }
  }

  static async createVendor(vendorData: Partial<Vendor>): Promise<Vendor> {
    try {
      // Get user's tenant ID
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('No tenant found for user')
      }

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          tenant_id: userProfile.tenant_id
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating vendor:', error)
      throw error
    }
  }

  static async updateVendor(vendorId: string, vendorData: Partial<Vendor>): Promise<Vendor> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', vendorId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating vendor:', error)
      throw error
    }
  }

  static async deleteVendor(vendorId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ active: false })
        .eq('id', vendorId)

      if (error) throw error
    } catch (error) {
      console.error('Error deactivating vendor:', error)
      throw error
    }
  }
}

export class QuoteRequestService {
  static async getQuoteRequests(tenantId: string): Promise<QuoteRequest[]> {
    try {
      const { data, error } = await supabase
        .from('quote_requests')
        .select(`
          *,
          job:jobs(title, location_address)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching quote requests:', error)
      throw error
    }
  }

  static async getQuoteRequestsForJob(jobId: string): Promise<QuoteRequest[]> {
    try {
      const { data, error } = await supabase
        .from('quote_requests')
        .select(`
          *,
          job:jobs(title, location_address)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching quote requests for job:', error)
      throw error
    }
  }

  static async createQuoteRequest(requestData: {
    job_id: string
    title: string
    description?: string
    trade_category?: string
    requested_delivery_date?: string
    site_address?: string
    items: QuoteRequestItem[]
    response_deadline?: string
    notes?: string
  }): Promise<QuoteRequest> {
    try {
      // Get user's tenant ID and user ID
      const { data: { user } } = await supabase.auth.getUser()
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single()

      if (!userProfile?.tenant_id || !user?.id) {
        throw new Error('No tenant or user found')
      }

      // Generate request number
      const requestNumber = `RFQ-${Date.now()}`

      // Create quote request
      const { data: quoteRequest, error: requestError } = await supabase
        .from('quote_requests')
        .insert({
          ...requestData,
          tenant_id: userProfile.tenant_id,
          created_by: user.id,
          request_number: requestNumber,
          status: 'draft'
        })
        .select()
        .single()

      if (requestError) throw requestError

      // Create quote request items
      if (requestData.items.length > 0) {
        const itemsToInsert = requestData.items.map(item => ({
          ...item,
          quote_request_id: quoteRequest.id
        }))

        const { error: itemsError } = await supabase
          .from('quote_request_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }

      return quoteRequest
    } catch (error) {
      console.error('Error creating quote request:', error)
      throw error
    }
  }

  static async sendQuoteRequestToVendors(
    quoteRequestId: string, 
    vendorIds: string[]
  ): Promise<void> {
    try {
      // Update quote request status
      const { error: updateError } = await supabase
        .from('quote_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', quoteRequestId)

      if (updateError) throw updateError

      // Get quote request details
      const { data: quoteRequest, error: fetchError } = await supabase
        .from('quote_requests')
        .select(`
          *,
          job:jobs(title, location_address),
          items:quote_request_items(*)
        `)
        .eq('id', quoteRequestId)
        .single()

      if (fetchError) throw fetchError

      // Get vendor details
      const { data: vendors, error: vendorsError } = await supabase
        .from('vendors')
        .select('*')
        .in('id', vendorIds)

      if (vendorsError) throw vendorsError

      // Here you would integrate with your email service
      // For now, we'll just log the action
      console.log('Sending quote request to vendors:', {
        quoteRequest,
        vendors,
        items: quoteRequest.items
      })

      // In a real implementation, you would:
      // 1. Generate PDF of the quote request
      // 2. Send emails to vendors with the RFQ details
      // 3. Include a unique link for vendors to submit quotes
      // 4. Log the email sends for tracking

    } catch (error) {
      console.error('Error sending quote request to vendors:', error)
      throw error
    }
  }

  static async getQuotesForRequest(quoteRequestId: string): Promise<VendorQuote[]> {
    try {
      const { data, error } = await supabase
        .from('vendor_quotes')
        .select(`
          *,
          vendor:vendors(*),
          items:vendor_quote_items(*)
        `)
        .eq('quote_request_id', quoteRequestId)
        .order('submitted_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching quotes for request:', error)
      throw error
    }
  }

  static async awardQuote(quoteId: string, quoteRequestId: string): Promise<void> {
    try {
      // Get the vendor quote details
      const { data: quote, error: quoteError } = await supabase
        .from('vendor_quotes')
        .select('vendor_id')
        .eq('id', quoteId)
        .single()

      if (quoteError) throw quoteError

      // Update quote request status and awarded vendor
      const { error: updateRequestError } = await supabase
        .from('quote_requests')
        .update({
          status: 'awarded',
          awarded_to: quote.vendor_id
        })
        .eq('id', quoteRequestId)

      if (updateRequestError) throw updateRequestError

      // Update winning quote status
      const { error: updateQuoteError } = await supabase
        .from('vendor_quotes')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', quoteId)

      if (updateQuoteError) throw updateQuoteError

      // Reject other quotes
      const { error: rejectError } = await supabase
        .from('vendor_quotes')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('quote_request_id', quoteRequestId)
        .neq('id', quoteId)

      if (rejectError) throw rejectError

    } catch (error) {
      console.error('Error awarding quote:', error)
      throw error
    }
  }

  static async generateRequestNumber(): Promise<string> {
    return `RFQ-${Date.now()}`
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }
}