import { supabase } from '../../supabaseClient'

export interface Estimate {
  id: string
  tenant_id: string
  account_id: string
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
}

export interface EstimateWithAccount extends Estimate {
  accounts: {
    name: string
  } | null
}

class EstimatesService {
  async getEstimates(searchTerm?: string, statusFilter?: string): Promise<EstimateWithAccount[]> {
    try {
      let query = supabase
        .from('estimates')
        .select(`
          *,
          accounts!inner(name)
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
          accounts.name.ilike.%${searchTerm}%
        `)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching estimates:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getEstimates:', error)
      throw error
    }
  }

  async createEstimate(estimateData: Partial<Estimate>): Promise<Estimate> {
    try {
      // Generate estimate number
      const estimateNumber = await this.generateEstimateNumber()
      
      const { data, error } = await supabase
        .from('estimates')
        .insert([{
          ...estimateData,
          estimate_number: estimateNumber,
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating estimate:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createEstimate:', error)
      throw error
    }
  }

  async updateEstimate(id: string, estimateData: Partial<Estimate>): Promise<Estimate> {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .update({
          ...estimateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating estimate:', error)
        throw error
      }

      return data
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
}

export const estimatesService = new EstimatesService()
