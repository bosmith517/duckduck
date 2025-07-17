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
  lead_id?: string | null // Reference to source lead
  job_id?: string | null // Reference to converted job (only after approval)
  status: 'draft' | 'sent' | 'pending_review' | 'awaiting_site_visit' | 'site_visit_scheduled' | 'under_negotiation' | 'revised' | 'approved' | 'rejected' | 'expired'
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
  equipment_cost?: number
  overhead_cost?: number
  notes?: string
  version?: number
  parent_estimate_id?: string
  lineItems?: LineItem[]
}

export interface EstimateWithAccount extends Estimate {
  accounts: {
    name: string
  } | null
  contacts: {  // Changed from 'contact' to 'contacts' to match Supabase response
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

      // Log activity if estimate is linked to a job
      if (data.job_id) {
        const user = (await supabase.auth.getUser()).data.user
        
        try {
          await supabase
            .from('job_activity_log')
            .insert([{
              job_id: data.job_id,
              tenant_id: data.tenant_id,
              activity_type: 'estimate_created',
              description: `New estimate ${data.estimate_number} created for $${data.total_amount}`,
              performed_by: user?.id || null,
              details: {
                estimate_id: data.id,
                estimate_number: data.estimate_number,
                amount: data.total_amount,
                status: data.status
              }
            }])
        } catch (activityError) {
          console.error('Failed to log estimate creation activity:', activityError)
        }
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
      // Get the current estimate for comparison
      const { data: oldEstimate } = await supabase
        .from('estimates')
        .select('*, job_id')
        .eq('id', id)
        .single()

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

      // Log activity if estimate is linked to a job
      if (data.job_id || oldEstimate?.job_id) {
        const jobId = data.job_id || oldEstimate?.job_id
        const user = (await supabase.auth.getUser()).data.user
        
        try {
          // Build description of changes
          let changes = []
          if (oldEstimate?.status !== data.status) {
            changes.push(`status changed from ${oldEstimate?.status} to ${data.status}`)
          }
          if (oldEstimate?.total_amount !== data.total_amount) {
            changes.push(`amount changed from $${oldEstimate?.total_amount} to $${data.total_amount}`)
          }
          
          await supabase
            .from('job_activity_log')
            .insert([{
              job_id: jobId,
              tenant_id: data.tenant_id,
              activity_type: 'estimate_updated',
              description: `Estimate ${data.estimate_number} updated${changes.length > 0 ? ': ' + changes.join(', ') : ''}`,
              performed_by: user?.id || null,
              details: {
                estimate_id: id,
                estimate_number: data.estimate_number,
                old_status: oldEstimate?.status,
                new_status: data.status,
                old_amount: oldEstimate?.total_amount,
                new_amount: data.total_amount,
                changes: changes
              }
            }])
        } catch (activityError) {
          console.error('Failed to log estimate update activity:', activityError)
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

  async updateEstimateStatus(id: string, status: string, feedback?: string): Promise<void> {
    try {
      // Get current estimate for tracking
      const { data: currentEstimate } = await supabase
        .from('estimates')
        .select('*, account_id, contact_id, total_amount, initial_amount, negotiation_rounds')
        .eq('id', id)
        .single()

      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      }

      // Add customer feedback if provided
      if (feedback) {
        updateData.customer_feedback = feedback
      }

      const { error } = await supabase
        .from('estimates')
        .update(updateData)
        .eq('id', id)

      if (error) {
        console.error('Error updating estimate status:', error)
        throw error
      }

      // Track negotiation events
      if (currentEstimate && status === 'under_negotiation') {
        const user = (await supabase.auth.getUser()).data.user
        
        await supabase
          .from('estimate_negotiation_events')
          .insert([{
            estimate_id: id,
            tenant_id: currentEstimate.tenant_id,
            event_type: 'counter_offer',
            previous_amount: currentEstimate.total_amount,
            proposed_amount: currentEstimate.total_amount, // Will be updated when revision is created
            customer_comments: feedback || 'Customer requested changes',
            created_by: user?.id || null
          }])

        // Log to job activity if linked to a job
        if (currentEstimate.job_id) {
          await supabase
            .from('job_activity_log')
            .insert({
              job_id: currentEstimate.job_id,
              tenant_id: currentEstimate.tenant_id,
              user_id: user?.id || null,
              activity_type: 'estimate_negotiation',
              activity_category: 'user',
              title: 'Estimate Negotiation',
              description: `Customer requested changes to estimate ${currentEstimate.estimate_number}`,
              metadata: {
                estimate_id: id,
                previous_status: currentEstimate.status,
                new_status: status,
                customer_feedback: feedback,
                negotiation_round: (currentEstimate.negotiation_rounds || 0) + 1
              },
              is_visible_to_customer: true
            })
        }
      }

      // Track rejection
      if (status === 'rejected' && feedback) {
        const user = (await supabase.auth.getUser()).data.user
        
        await supabase
          .from('estimate_negotiation_events')
          .insert([{
            estimate_id: id,
            tenant_id: currentEstimate.tenant_id,
            event_type: 'rejection_reason',
            previous_amount: currentEstimate.total_amount,
            customer_comments: feedback,
            created_by: user?.id || null
          }])
      }
    } catch (error) {
      console.error('Error in updateEstimateStatus:', error)
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

      // Check if this estimate already has a job associated with it
      if (estimate.job_id) {
        // Get the existing job
        const { data: existingJob, error: jobFetchError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', estimate.job_id)
          .single()

        if (jobFetchError) {
          console.error('Error fetching existing job:', jobFetchError)
        } else if (existingJob) {
          throw new Error(`This estimate has already been converted to job ${existingJob.job_number}. Cannot create duplicate jobs.`)
        }
      }

      // Check if a job already exists with this estimate_id to prevent duplicates
      const { data: existingJobs, error: existingJobsError } = await supabase
        .from('jobs')
        .select('id, job_number')
        .eq('estimate_id', estimateId)
        .limit(1)

      if (!existingJobsError && existingJobs && existingJobs.length > 0) {
        throw new Error(`A job (${existingJobs[0].job_number}) already exists for this estimate. Cannot create duplicate jobs.`)
      }

      // Generate job number
      const jobNumber = await this.generateJobNumber()

      // Create the job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .insert([{
          ...jobData,
          job_number: jobNumber,
          account_id: estimate.account_id,
          contact_id: estimate.contact_id,
          tenant_id: estimate.tenant_id,
          estimated_cost: estimate.total_amount,
          contract_price: estimate.total_amount, // Set contract price from estimate
          estimate_id: estimateId, // Store reference to the estimate
          // Set cost breakdowns if available from estimate
          estimated_material_cost: estimate.material_cost || 0,
          estimated_labor_cost: estimate.labor_cost || 0,
          estimated_equipment_cost: estimate.equipment_cost || 0,
          estimated_overhead_cost: estimate.overhead_cost || 0
        }])
        .select()
        .single()

      if (jobError) throw jobError

      // Create payment milestones in the job_milestones table
      const milestonesWithJobId = paymentSchedule.map((schedule, index) => ({
        job_id: job.id,
        tenant_id: estimate.tenant_id,
        milestone_name: schedule.milestone_name,
        milestone_type: 'payment',
        sequence_order: index + 1,
        amount: schedule.amount_due,
        status: 'pending',
        target_date: schedule.due_date,
        requirements: `Payment due: $${schedule.amount_due.toFixed(2)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))

      const { data: milestones, error: milestonesError } = await supabase
        .from('job_milestones')
        .insert(milestonesWithJobId)
        .select()

      if (milestonesError) throw milestonesError

      // Also create in job_payment_schedules for backwards compatibility
      const schedulesWithJobId = paymentSchedule.map(schedule => ({
        ...schedule,
        job_id: job.id,
        tenant_id: estimate.tenant_id,
      }))

      const { data: schedules, error: schedulesError } = await supabase
        .from('job_payment_schedules')
        .insert(schedulesWithJobId)
        .select()

      if (schedulesError) {
        console.error('Error creating payment schedules:', schedulesError)
        // Don't throw - milestones are more important
      }

      // Update estimate status to approved and link to job
      await this.updateEstimate(estimateId, { 
        status: 'approved',
        job_id: job.id 
      })

      // Log activity for job creation from estimate
      try {
        const user = (await supabase.auth.getUser()).data.user
        
        // Log job creation
        await supabase
          .from('job_activity_log')
          .insert([{
            job_id: job.id,
            tenant_id: estimate.tenant_id,
            activity_type: 'status_change',
            description: `Job created from estimate ${estimate.estimate_number}`,
            performed_by: user?.id || null,
            details: {
              estimate_id: estimateId,
              estimate_number: estimate.estimate_number,
              estimate_amount: estimate.total_amount
            }
          }])

        // Log payment milestone creation
        if (milestones && milestones.length > 0) {
          await supabase
            .from('job_activity_log')
            .insert([{
              job_id: job.id,
              tenant_id: estimate.tenant_id,
              activity_type: 'milestone_created',
              description: `Payment schedule created with ${milestones.length} milestones`,
              performed_by: user?.id || null,
              details: {
                milestones: milestones.map(m => ({
                  name: m.milestone_name,
                  amount: m.amount,
                  due_date: m.target_date,
                  type: m.milestone_type
                }))
              }
            }])
        }
      } catch (activityError) {
        console.error('Failed to log job creation activity:', activityError)
        // Don't fail the whole operation if activity logging fails
      }

      return { job, schedules: schedules || [] }
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

  async canConvertToJob(estimateId: string): Promise<{ canConvert: boolean, reason?: string }> {
    try {
      // Get the estimate details
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .select('*, job_id')
        .eq('id', estimateId)
        .single()

      if (estimateError) {
        return { canConvert: false, reason: 'Estimate not found' }
      }

      // Check if estimate already has a job
      if (estimate.job_id) {
        return { canConvert: false, reason: 'Estimate has already been converted to a job' }
      }

      // Check if a job already exists with this estimate_id
      const { data: existingJobs, error: existingJobsError } = await supabase
        .from('jobs')
        .select('id, job_number')
        .eq('estimate_id', estimateId)
        .limit(1)

      if (!existingJobsError && existingJobs && existingJobs.length > 0) {
        return { canConvert: false, reason: `Job ${existingJobs[0].job_number} already exists for this estimate` }
      }

      // Check if estimate status allows conversion
      const convertibleStatuses = ['sent', 'pending_review', 'under_negotiation', 'revised', 'approved']
      if (!convertibleStatuses.includes(estimate.status)) {
        return { canConvert: false, reason: `Estimate status '${estimate.status}' cannot be converted to a job` }
      }

      return { canConvert: true }
    } catch (error) {
      console.error('Error checking if estimate can be converted:', error)
      return { canConvert: false, reason: 'Error checking estimate status' }
    }
  }
}

export const estimatesService = new EstimatesService()
