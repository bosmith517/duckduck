import { supabase } from '../../supabaseClient'

export interface LineItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  line_total?: number
  item_type?: 'service' | 'material' | 'labor' | 'other'
  sort_order?: number
}

export interface Estimate {
  id: string
  tenant_id: string
  account_id?: string | null // Nullable for individual customers
  contact_id?: string | null // For individual customers
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
  total_amount: number
  created_at: string
  updated_at: string
  // Additional fields for UI
  estimate_number?: string
  client_name?: string
  project_title?: string
  description?: string
  valid_until?: string
  labor_cost?: number
  material_cost?: number
  notes?: string
  lineItems?: LineItem[]
}

export interface EstimateWithAccount extends Estimate {
  accounts: {
    name: string
  } | null
  contact: {
    name: string
    first_name: string
    last_name: string
  } | null
}

class EstimatesService {
  async getEstimates(searchTerm?: string, statusFilter?: string): Promise<EstimateWithAccount[]> {
    try {
      let query = supabase
        .from('estimates')
        .select(`
          *,
          accounts(name),
          contacts(name, first_name, last_name)
        `)
        .order('created_at', { ascending: false })

      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply search filter
      if (searchTerm) {
        query = query.or(`
          estimate_number.ilike.%${searchTerm}%,
          project_title.ilike.%${searchTerm}%,
          description.ilike.%${searchTerm}%,
          accounts.name.ilike.%${searchTerm}%,
          contacts.name.ilike.%${searchTerm}%,
          contacts.first_name.ilike.%${searchTerm}%,
          contacts.last_name.ilike.%${searchTerm}%
        `)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching estimates:', error)
        throw error
      }

      // For the list view, we don't need line items for performance
      // Line items will be fetched when viewing individual estimates
      return data || []
    } catch (error) {
      console.error('Error in getEstimates:', error)
      throw error
    }
  }

  async createEstimate(estimateData: Partial<Estimate> & { lineItems?: LineItem[] }): Promise<EstimateWithAccount> {
    try {
      // Generate estimate number
      const estimateNumber = await this.generateEstimateNumber()
      
      // Extract line items from estimate data
      const { lineItems, ...estimateFields } = estimateData
      
      const { data, error } = await supabase
        .from('estimates')
        .insert([{
          ...estimateFields,
          estimate_number: estimateNumber,
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating estimate:', error)
        throw error
      }

      // Create line items if provided
      if (lineItems && lineItems.length > 0) {
        await this.createLineItems(data.id, data.tenant_id, lineItems)
      }

      // Return estimate with line items
      return await this.getEstimateWithLineItems(data.id)
    } catch (error) {
      console.error('Error in createEstimate:', error)
      throw error
    }
  }

  async updateEstimate(id: string, estimateData: Partial<Estimate> & { lineItems?: LineItem[] }): Promise<EstimateWithAccount> {
    try {
      // Extract line items from estimate data
      const { lineItems, ...estimateFields } = estimateData
      
      const { data, error } = await supabase
        .from('estimates')
        .update({
          ...estimateFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating estimate:', error)
        throw error
      }

      // Update line items if provided
      if (lineItems !== undefined) {
        // Delete existing line items
        await supabase
          .from('estimate_line_items')
          .delete()
          .eq('estimate_id', id)
        
        // Create new line items
        if (lineItems.length > 0) {
          await this.createLineItems(id, data.tenant_id, lineItems)
        }
      }

      // Return estimate with line items
      return await this.getEstimateWithLineItems(id)
    } catch (error) {
      console.error('Error in updateEstimate:', error)
      throw error
    }
  }

  async deleteEstimate(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting estimate:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in deleteEstimate:', error)
      throw error
    }
  }

  async convertEstimateToJob(estimateId: string, jobData: any, paymentSchedule: any[]): Promise<{ job: any, schedules: any[] }> {
    try {
      // Start a transaction-like operation
      // First, get the estimate details
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', estimateId)
        .single()

      if (estimateError) throw estimateError

      // Generate job number
      const jobNumber = await this.generateJobNumber()

      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          ...jobData,
          job_number: jobNumber,
          account_id: estimate.account_id,
          tenant_id: estimate.tenant_id,
          estimated_cost: estimate.total_amount,
        }])
        .select()
        .single()

      if (jobError) throw jobError

      // Create payment schedules
      const schedulesWithJobId = paymentSchedule.map(schedule => ({
        ...schedule,
        job_id: job.id,
        tenant_id: estimate.tenant_id,
      }))

      const { data: schedules, error: schedulesError } = await supabase
        .from('job_payment_schedules')
        .insert(schedulesWithJobId)
        .select()

      if (schedulesError) throw schedulesError

      // Update estimate status to approved
      await this.updateEstimate(estimateId, { status: 'approved' })

      return { job, schedules }
    } catch (error) {
      console.error('Error in convertEstimateToJob:', error)
      throw error
    }
  }

  private async generateEstimateNumber(): Promise<string> {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    
    // Get count of estimates created today
    const { count } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-${day}T00:00:00.000Z`)
      .lt('created_at', `${year}-${month}-${day}T23:59:59.999Z`)

    const sequence = String((count || 0) + 1).padStart(4, '0')
    return `EST-${year}${month}${day}-${sequence}`
  }

  private async generateJobNumber(): Promise<string> {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    
    // Get count of jobs created today
    const { count } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-${month}-${day}T00:00:00.000Z`)
      .lt('created_at', `${year}-${month}-${day}T23:59:59.999Z`)

    const sequence = String((count || 0) + 1).padStart(4, '0')
    return `JOB-${year}${month}${day}-${sequence}`
  }

  private async createLineItems(estimateId: string, tenantId: string, lineItems: LineItem[]): Promise<void> {
    const lineItemsToInsert = lineItems.map((item, index) => ({
      estimate_id: estimateId,
      tenant_id: tenantId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.quantity * item.unit_price,
      item_type: item.item_type || 'service',
      sort_order: index
    }))

    const { error } = await supabase
      .from('estimate_line_items')
      .insert(lineItemsToInsert)

    if (error) {
      console.error('Error creating line items:', error)
      throw error
    }
  }

  private async getEstimateWithLineItems(estimateId: string): Promise<EstimateWithAccount> {
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select(`
        *,
        accounts(name),
        contacts(name, first_name, last_name)
      `)
      .eq('id', estimateId)
      .single()

    if (estimateError) {
      console.error('Error fetching estimate:', estimateError)
      throw estimateError
    }

    const { data: lineItems, error: lineItemsError } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order')

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError)
      throw lineItemsError
    }

    return {
      ...estimate,
      lineItems: lineItems?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        line_total: Number(item.line_total),
        item_type: item.item_type,
        sort_order: item.sort_order
      })) || []
    }
  }

  async getEstimateById(id: string): Promise<EstimateWithAccount | null> {
    try {
      return await this.getEstimateWithLineItems(id)
    } catch (error) {
      console.error('Error in getEstimateById:', error)
      return null
    }
  }
}

export const estimatesService = new EstimatesService()
