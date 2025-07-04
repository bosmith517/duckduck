import { supabase } from '../../supabaseClient'
import { WorkflowAutomationService } from './workflowAutomationService'

// ===== TYPE DEFINITIONS =====

export type JobStatus = 
  | 'new' 
  | 'site_visit_scheduled' 
  | 'site_visit_completed'
  | 'estimate_draft'
  | 'estimate_sent'
  | 'under_negotiation'
  | 'approved'
  | 'deposit_paid'
  | 'permitting'
  | 'team_assigned'
  | 'materials_ordered'
  | 'scheduled'
  | 'in_progress'
  | 'milestone_reached'
  | 'awaiting_inspection'
  | 'final_review'
  | 'invoice_sent'
  | 'completed'

export type LeadStatus = 
  | 'new'
  | 'site_visit_scheduled'
  | 'site_visit_completed'
  | 'estimate_ready'
  | 'converted'
  | 'unqualified'

export interface WorkflowTransition {
  fromStatus: string
  toStatus: string
  prerequisites?: string[]
  autoConditions?: Record<string, any>
  requiredFields?: string[]
}

export interface JobMilestone {
  id: string
  job_id: string
  milestone_name: string
  milestone_type: 'payment' | 'progress' | 'inspection' | 'approval'
  sequence_order: number
  amount?: number
  percentage_of_total?: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  target_date?: string
  requirements?: string
}

export interface JobInspection {
  id: string
  job_id: string
  trade: string
  phase: 'rough' | 'final'
  required: boolean
  status: 'pending' | 'scheduled' | 'passed' | 'failed' | 'waived'
  scheduled_date?: string
  inspector_name?: string
  result?: 'pass' | 'fail' | 'conditional'
  notes?: string
}

// ===== WORKFLOW SERVICE CLASS =====

class WorkflowService {
  
  // ===== STATUS TRANSITION LOGIC =====
  
  private statusTransitions: Record<string, WorkflowTransition[]> = {
    // Lead workflow
    'new': [
      { fromStatus: 'new', toStatus: 'site_visit_scheduled' }
    ],
    'site_visit_scheduled': [
      { fromStatus: 'site_visit_scheduled', toStatus: 'site_visit_completed' }
    ],
    'site_visit_completed': [
      { fromStatus: 'site_visit_completed', toStatus: 'estimate_ready' }
    ],
    
    // Job workflow (starts from estimate approval)
    'approved': [
      { fromStatus: 'approved', toStatus: 'deposit_paid', prerequisites: ['deposit_received'] }
    ],
    'deposit_paid': [
      { fromStatus: 'deposit_paid', toStatus: 'permitting', autoConditions: { permits_required: true } },
      { fromStatus: 'deposit_paid', toStatus: 'team_assigned', autoConditions: { permits_required: false } }
    ],
    'permitting': [
      { fromStatus: 'permitting', toStatus: 'team_assigned', prerequisites: ['permits_approved'] }
    ],
    'team_assigned': [
      { fromStatus: 'team_assigned', toStatus: 'materials_ordered' }
    ],
    'materials_ordered': [
      { fromStatus: 'materials_ordered', toStatus: 'scheduled', prerequisites: ['materials_delivered', 'permits_ready'] }
    ],
    'scheduled': [
      { fromStatus: 'scheduled', toStatus: 'in_progress' }
    ],
    'in_progress': [
      { fromStatus: 'in_progress', toStatus: 'milestone_reached', autoConditions: { milestone_completed: true } },
      { fromStatus: 'in_progress', toStatus: 'awaiting_inspection', autoConditions: { inspection_required: true } }
    ],
    'milestone_reached': [
      { fromStatus: 'milestone_reached', toStatus: 'in_progress', autoConditions: { work_remaining: true } },
      { fromStatus: 'milestone_reached', toStatus: 'final_review', autoConditions: { work_complete: true } }
    ],
    'awaiting_inspection': [
      { fromStatus: 'awaiting_inspection', toStatus: 'in_progress', prerequisites: ['inspection_passed'] }
    ],
    'final_review': [
      { fromStatus: 'final_review', toStatus: 'invoice_sent', prerequisites: ['client_approval'] }
    ],
    'invoice_sent': [
      { fromStatus: 'invoice_sent', toStatus: 'completed', prerequisites: ['final_payment_received'] }
    ]
  }

  // ===== CORE WORKFLOW METHODS =====

  /**
   * Advance job to next status with validation
   */
  async advanceJobStatus(jobId: string, newStatus: JobStatus, userId: string, notes?: string): Promise<boolean> {
    try {
      // Get current job
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        throw new Error('Job not found')
      }

      // Validate transition
      const isValidTransition = await this.validateStatusTransition(job, newStatus)
      if (!isValidTransition) {
        throw new Error(`Invalid status transition from ${job.status} to ${newStatus}`)
      }

      // Update job status
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (updateError) throw updateError

      // Log the status change
      await this.logStatusChange(jobId, job.status, newStatus, userId, notes)

      // Execute post-transition actions
      await this.executePostTransitionActions(jobId, newStatus, job)

      return true
    } catch (error) {
      console.error('Error advancing job status:', error)
      throw error
    }
  }

  /**
   * Validate if status transition is allowed
   */
  private async validateStatusTransition(job: any, newStatus: JobStatus): Promise<boolean> {
    const currentStatus = job.status
    const allowedTransitions = this.statusTransitions[currentStatus] || []
    
    // Check if transition is defined
    const transition = allowedTransitions.find(t => t.toStatus === newStatus)
    if (!transition) return false

    // Check prerequisites
    if (transition.prerequisites) {
      for (const prerequisite of transition.prerequisites) {
        const isMet = await this.checkPrerequisite(job.id, prerequisite)
        if (!isMet) return false
      }
    }

    return true
  }

  /**
   * Check if a prerequisite is met
   */
  private async checkPrerequisite(jobId: string, prerequisite: string): Promise<boolean> {
    switch (prerequisite) {
      case 'deposit_received':
        return await this.checkDepositReceived(jobId)
      case 'permits_approved':
        return await this.checkPermitsApproved(jobId)
      case 'materials_delivered':
        return await this.checkMaterialsDelivered(jobId)
      case 'inspection_passed':
        return await this.checkInspectionsPassed(jobId)
      case 'client_approval':
        return await this.checkClientApproval(jobId)
      case 'final_payment_received':
        return await this.checkFinalPaymentReceived(jobId)
      default:
        return true
    }
  }

  // ===== PREREQUISITE CHECKERS =====

  private async checkDepositReceived(jobId: string): Promise<boolean> {
    const { data } = await supabase
      .from('job_milestones')
      .select('*')
      .eq('job_id', jobId)
      .eq('milestone_name', 'deposit')
      .eq('status', 'completed')
      .single()
    
    return !!data
  }

  private async checkPermitsApproved(jobId: string): Promise<boolean> {
    const { data: permits } = await supabase
      .from('job_permits')
      .select('*')
      .eq('job_id', jobId)
    
    if (!permits || permits.length === 0) return true // No permits required
    
    return permits.every(permit => permit.status === 'approved')
  }

  private async checkMaterialsDelivered(jobId: string): Promise<boolean> {
    const { data: orders } = await supabase
      .from('job_material_orders')
      .select('*')
      .eq('job_id', jobId)
    
    if (!orders || orders.length === 0) return true // No materials ordered
    
    return orders.every(order => order.status === 'delivered')
  }

  private async checkInspectionsPassed(jobId: string): Promise<boolean> {
    const { data: inspections } = await supabase
      .from('job_inspections')
      .select('*')
      .eq('job_id', jobId)
      .eq('required', true)
    
    if (!inspections || inspections.length === 0) return true // No inspections required
    
    return inspections.every(inspection => 
      inspection.status === 'passed' || inspection.status === 'waived'
    )
  }

  private async checkClientApproval(jobId: string): Promise<boolean> {
    // Check for final walkthrough milestone completion
    const { data } = await supabase
      .from('job_milestones')
      .select('*')
      .eq('job_id', jobId)
      .eq('milestone_name', 'final_walkthrough')
      .eq('status', 'completed')
      .single()
    
    return !!data
  }

  private async checkFinalPaymentReceived(jobId: string): Promise<boolean> {
    const { data } = await supabase
      .from('job_milestones')
      .select('*')
      .eq('job_id', jobId)
      .eq('milestone_name', 'final_payment')
      .eq('status', 'completed')
      .single()
    
    return !!data
  }

  // ===== POST-TRANSITION ACTIONS =====

  /**
   * Execute automated actions after status change
   */
  private async executePostTransitionActions(jobId: string, newStatus: JobStatus, job: any): Promise<void> {
    switch (newStatus) {
      case 'deposit_paid':
        await this.createDefaultMilestones(jobId, job)
        await this.createRequiredInspections(jobId, job)
        break
      case 'permitting':
        await this.createRequiredPermits(jobId, job)
        break
      case 'team_assigned':
        // Could trigger notification to assigned team members
        break
      case 'scheduled':
        // Could create calendar events
        break
      case 'completed':
        await this.createWarrantyRecord(jobId, job)
        break
    }
  }

  // ===== MILESTONE MANAGEMENT =====

  /**
   * Create default payment milestones for a job
   */
  async createDefaultMilestones(jobId: string, job: any): Promise<void> {
    const totalAmount = job.estimated_cost || 0
    
    const defaultMilestones = [
      { name: 'deposit', percentage: 30, type: 'payment' },
      { name: 'material_delivery', percentage: 25, type: 'progress' },
      { name: 'rough_complete', percentage: 25, type: 'progress' },
      { name: 'final_completion', percentage: 20, type: 'payment' }
    ]

    for (let i = 0; i < defaultMilestones.length; i++) {
      const milestone = defaultMilestones[i]
      await supabase
        .from('job_milestones')
        .insert({
          job_id: jobId,
          tenant_id: job.tenant_id,
          milestone_name: milestone.name,
          milestone_type: milestone.type,
          sequence_order: i + 1,
          percentage_of_total: milestone.percentage,
          amount: (totalAmount * milestone.percentage) / 100,
          status: milestone.name === 'deposit' ? 'completed' : 'pending'
        })
    }
  }

  // ===== INSPECTION MANAGEMENT =====

  /**
   * Create required inspections based on job type
   */
  async createRequiredInspections(jobId: string, job: any): Promise<void> {
    // This would be configurable based on job type and local requirements
    const jobType = job.service_type || 'general'
    const inspectionConfig = this.getInspectionConfig(jobType)
    
    for (const inspection of inspectionConfig) {
      await supabase
        .from('job_inspections')
        .insert({
          job_id: jobId,
          tenant_id: job.tenant_id,
          trade: inspection.trade,
          phase: inspection.phase,
          inspection_type: 'city',
          required: inspection.required,
          status: 'pending'
        })
    }
  }

  private getInspectionConfig(jobType: string): any[] {
    const configs: Record<string, any[]> = {
      'electrical': [
        { trade: 'electrical', phase: 'rough', required: true },
        { trade: 'electrical', phase: 'final', required: true }
      ],
      'plumbing': [
        { trade: 'plumbing', phase: 'rough', required: true },
        { trade: 'plumbing', phase: 'final', required: true }
      ],
      'hvac': [
        { trade: 'hvac', phase: 'rough', required: true },
        { trade: 'hvac', phase: 'final', required: true }
      ],
      'general': [
        { trade: 'final', phase: 'final', required: true }
      ]
    }
    
    return configs[jobType] || configs['general']
  }

  // ===== PERMIT MANAGEMENT =====

  /**
   * Create required permits based on job type
   */
  async createRequiredPermits(jobId: string, job: any): Promise<void> {
    const jobType = job.service_type || 'general'
    const permitConfig = this.getPermitConfig(jobType)
    
    for (const permit of permitConfig) {
      await supabase
        .from('job_permits')
        .insert({
          job_id: jobId,
          tenant_id: job.tenant_id,
          permit_type: permit.type,
          authority: permit.authority || 'City',
          status: 'required'
        })
    }
  }

  private getPermitConfig(jobType: string): any[] {
    const configs: Record<string, any[]> = {
      'electrical': [{ type: 'electrical', authority: 'City' }],
      'plumbing': [{ type: 'plumbing', authority: 'City' }],
      'hvac': [{ type: 'mechanical', authority: 'City' }],
      'structural': [{ type: 'building', authority: 'City' }]
    }
    
    return configs[jobType] || []
  }

  // ===== WARRANTY MANAGEMENT =====

  /**
   * Create warranty record when job completes
   */
  async createWarrantyRecord(jobId: string, job: any): Promise<void> {
    // This could create a separate warranty tracking record
    const warrantyMonths = 12 // Default 1 year warranty
    const warrantyEnd = new Date()
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths)
    
    // Could be implemented as a separate warranty table
    console.log(`Creating warranty record for job ${jobId} until ${warrantyEnd}`)
  }

  // ===== ACTIVITY LOGGING =====

  /**
   * Log status changes for audit trail
   */
  private async logStatusChange(
    jobId: string, 
    fromStatus: string, 
    toStatus: string, 
    userId: string, 
    notes?: string
  ): Promise<void> {
    await supabase
      .from('job_activity_log')
      .insert({
        job_id: jobId,
        activity_type: 'status_changed',
        description: `Status changed from ${fromStatus} to ${toStatus}`,
        performed_by: userId,
        notes,
        metadata: {
          from_status: fromStatus,
          to_status: toStatus
        }
      })
  }

  // ===== PUBLIC UTILITY METHODS =====

  /**
   * Get allowed next statuses for a job
   */
  async getAllowedNextStatuses(jobId: string): Promise<JobStatus[]> {
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    
    if (!job) return []
    
    const transitions = this.statusTransitions[job.status] || []
    const allowedStatuses: JobStatus[] = []
    
    for (const transition of transitions) {
      const isValid = await this.validateStatusTransition(job, transition.toStatus as JobStatus)
      if (isValid) {
        allowedStatuses.push(transition.toStatus as JobStatus)
      }
    }
    
    return allowedStatuses
  }

  /**
   * Get job workflow summary
   */
  async getJobWorkflowSummary(jobId: string): Promise<any> {
    const [job, milestones, inspections, permits] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('job_milestones').select('*').eq('job_id', jobId).order('sequence_order'),
      supabase.from('job_inspections').select('*').eq('job_id', jobId),
      supabase.from('job_permits').select('*').eq('job_id', jobId)
    ])
    
    return {
      job: job.data,
      milestones: milestones.data || [],
      inspections: inspections.data || [],
      permits: permits.data || [],
      allowedNextStatuses: await this.getAllowedNextStatuses(jobId)
    }
  }
}

export const workflowService = new WorkflowService()
export default workflowService