import { supabase } from '../../supabaseClient'

export interface Invoice {
  id: string
  tenant_id: string
  account_id?: string
  contact_id?: string
  job_id?: string
  status: string
  total_amount: number
  paid_amount?: number
  due_date?: string
  invoice_number?: string
  created_at: string
  updated_at: string
  // Additional fields for UI
  description?: string
  issue_date?: string
}

export interface InvoiceItem {
  id: string
  tenant_id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  created_at: string
  updated_at: string
}

export interface InvoiceWithDetails extends Invoice {
  accounts?: {
    id: string
    name: string
  } | null
  contacts?: {
    id: string
    name?: string
    first_name?: string
    last_name?: string
  } | null
  jobs?: {
    id: string
    title: string
    job_number: string
  } | null
  invoice_items?: InvoiceItem[]
}

class InvoicesService {
  async getInvoices(searchTerm?: string, statusFilter?: string): Promise<InvoiceWithDetails[]> {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          accounts(id, name),
          contacts(id, name, first_name, last_name),
          jobs(id, title, job_number),
          invoice_items(*)
        `)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`
          invoice_number.ilike.%${searchTerm}%,
          description.ilike.%${searchTerm}%,
          accounts.name.ilike.%${searchTerm}%,
          jobs.title.ilike.%${searchTerm}%,
          jobs.job_number.ilike.%${searchTerm}%
        `)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching invoices:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getInvoices:', error)
      throw error
    }
  }

  async createInvoice(invoiceData: Partial<Invoice>, lineItems: Partial<InvoiceItem>[]): Promise<Invoice> {
    try {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber()
      
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          ...invoiceData,
          invoice_number: invoiceNumber,
          status: invoiceData.status || 'draft',
          paid_amount: 0,
          issue_date: new Date().toISOString(),
        }])
        .select()
        .single()

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError)
        throw invoiceError
      }

      // Create invoice items
      if (lineItems.length > 0) {
        const itemsWithInvoiceId = lineItems.map(item => ({
          ...item,
          invoice_id: invoice.id,
          tenant_id: invoice.tenant_id,
        }))

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId)

        if (itemsError) {
          console.error('Error creating invoice items:', itemsError)
          throw itemsError
        }
      }

      return invoice
    } catch (error) {
      console.error('Error in createInvoice:', error)
      throw error
    }
  }

  async updateInvoice(id: string, invoiceData: Partial<Invoice>): Promise<Invoice> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({
          ...invoiceData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating invoice:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateInvoice:', error)
      throw error
    }
  }

  async deleteInvoice(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting invoice:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteInvoice:', error)
      throw error
    }
  }

  async recordPayment(invoiceId: string, paymentAmount: number, paymentDate: string): Promise<Invoice> {
    try {
      // Get current invoice
      const { data: currentInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (fetchError) throw fetchError

      const newPaidAmount = (currentInvoice.paid_amount || 0) + paymentAmount
      const newStatus = newPaidAmount >= currentInvoice.total_amount ? 'paid' : 'partial'

      const { data, error } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .select()
        .single()

      if (error) {
        console.error('Error recording payment:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in recordPayment:', error)
      throw error
    }
  }

  async generateInvoiceFromMilestone(milestoneId: string): Promise<Invoice> {
    try {
      // Get milestone details with job and account info
      const { data: milestone, error: milestoneError } = await supabase
        .from('job_payment_schedules')
        .select(`
          *,
          jobs!inner(
            id,
            title,
            job_number,
            account_id,
            tenant_id,
            accounts!inner(id, name)
          )
        `)
        .eq('id', milestoneId)
        .single()

      if (milestoneError) throw milestoneError

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber()

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          tenant_id: milestone.tenant_id,
          account_id: milestone.jobs.account_id,
          job_id: milestone.job_id,
          status: 'sent',
          total_amount: milestone.amount_due,
          paid_amount: 0,
          due_date: milestone.due_date,
          invoice_number: invoiceNumber,
          description: `Invoice for ${milestone.milestone_name} - ${milestone.jobs.title}`,
          issue_date: new Date().toISOString(),
        }])
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice item
      const { error: itemError } = await supabase
        .from('invoice_items')
        .insert([{
          tenant_id: milestone.tenant_id,
          invoice_id: invoice.id,
          description: milestone.milestone_name,
          quantity: 1,
          unit_price: milestone.amount_due,
        }])

      if (itemError) throw itemError

      // Update milestone status and link to invoice
      const { error: updateError } = await supabase
        .from('job_payment_schedules')
        .update({
          status: 'Invoiced',
          invoice_id: invoice.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', milestoneId)

      if (updateError) throw updateError

      return invoice
    } catch (error) {
      console.error('Error in generateInvoiceFromMilestone:', error)
      throw error
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
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
}

export const invoicesService = new InvoicesService()
