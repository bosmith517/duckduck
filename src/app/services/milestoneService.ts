import { supabase } from '../../supabaseClient'
import { WorkflowAutomationService } from './workflowAutomationService'

export interface JobMilestone {
  id: string
  job_id: string
  tenant_id: string
  milestone_name: string
  milestone_type: 'payment' | 'progress' | 'inspection' | 'approval'
  sequence_order: number
  amount?: number
  percentage_of_total?: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  target_date?: string
  completed_at?: string
  completed_by?: string
  requirements?: string
  notes?: string
  attachments?: any[]
  created_at: string
  updated_at: string
}

export interface MilestoneTemplate {
  milestone_name: string
  milestone_type: 'payment' | 'progress' | 'inspection' | 'approval'
  sequence_order: number
  percentage_of_total?: number
  requirements?: string
  typical_days_from_start?: number
}

export class MilestoneService {
  // Standard milestone templates for different contract types
  private static MILESTONE_TEMPLATES: Record<string, MilestoneTemplate[]> = {
    standard_construction: [
      {
        milestone_name: 'Contract Signing',
        milestone_type: 'approval',
        sequence_order: 1,
        requirements: 'Signed contract and initial paperwork',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Deposit Payment',
        milestone_type: 'payment',
        sequence_order: 2,
        percentage_of_total: 25,
        requirements: 'Initial deposit to secure job and materials',
        typical_days_from_start: 1
      },
      {
        milestone_name: 'Permits Obtained',
        milestone_type: 'approval',
        sequence_order: 3,
        requirements: 'All required permits approved and issued',
        typical_days_from_start: 7
      },
      {
        milestone_name: 'Materials Delivered',
        milestone_type: 'progress',
        sequence_order: 4,
        requirements: 'All materials on-site and verified',
        typical_days_from_start: 10
      },
      {
        milestone_name: 'Work 50% Complete',
        milestone_type: 'progress',
        sequence_order: 5,
        requirements: 'Halfway milestone - rough work complete',
        typical_days_from_start: 15
      },
      {
        milestone_name: 'Progress Payment',
        milestone_type: 'payment',
        sequence_order: 6,
        percentage_of_total: 40,
        requirements: 'Payment for work completed to date',
        typical_days_from_start: 16
      },
      {
        milestone_name: 'Rough Inspections Passed',
        milestone_type: 'inspection',
        sequence_order: 7,
        requirements: 'All rough inspections completed and passed',
        typical_days_from_start: 20
      },
      {
        milestone_name: 'Work 90% Complete',
        milestone_type: 'progress',
        sequence_order: 8,
        requirements: 'Substantial completion achieved',
        typical_days_from_start: 25
      },
      {
        milestone_name: 'Final Inspections Passed',
        milestone_type: 'inspection',
        sequence_order: 9,
        requirements: 'All final inspections completed and passed',
        typical_days_from_start: 28
      },
      {
        milestone_name: 'Project Completion',
        milestone_type: 'progress',
        sequence_order: 10,
        requirements: 'All work completed to satisfaction',
        typical_days_from_start: 30
      },
      {
        milestone_name: 'Final Payment',
        milestone_type: 'payment',
        sequence_order: 11,
        percentage_of_total: 35,
        requirements: 'Final payment upon completion',
        typical_days_from_start: 31
      }
    ],
    electrical_service: [
      {
        milestone_name: 'Service Call Scheduled',
        milestone_type: 'approval',
        sequence_order: 1,
        requirements: 'Customer confirms appointment',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Diagnostic Complete',
        milestone_type: 'progress',
        sequence_order: 2,
        requirements: 'Issue identified and solution proposed',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Work Authorization',
        milestone_type: 'approval',
        sequence_order: 3,
        requirements: 'Customer approves work and pricing',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Work Complete',
        milestone_type: 'progress',
        sequence_order: 4,
        requirements: 'All electrical work completed',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Payment Due',
        milestone_type: 'payment',
        sequence_order: 5,
        percentage_of_total: 100,
        requirements: 'Payment upon completion',
        typical_days_from_start: 0
      }
    ],
    large_project: [
      {
        milestone_name: 'Contract Execution',
        milestone_type: 'approval',
        sequence_order: 1,
        requirements: 'Fully executed contract with all parties',
        typical_days_from_start: 0
      },
      {
        milestone_name: 'Initial Payment',
        milestone_type: 'payment',
        sequence_order: 2,
        percentage_of_total: 15,
        requirements: 'Initial mobilization payment',
        typical_days_from_start: 3
      },
      {
        milestone_name: 'Engineering Complete',
        milestone_type: 'progress',
        sequence_order: 3,
        requirements: 'All engineering and design work completed',
        typical_days_from_start: 14
      },
      {
        milestone_name: 'Permits and Approvals',
        milestone_type: 'approval',
        sequence_order: 4,
        requirements: 'All permits obtained and approved',
        typical_days_from_start: 21
      },
      {
        milestone_name: 'Materials Procurement',
        milestone_type: 'progress',
        sequence_order: 5,
        requirements: 'All materials ordered and delivered',
        typical_days_from_start: 28
      },
      {
        milestone_name: 'First Progress Payment',
        milestone_type: 'payment',
        sequence_order: 6,
        percentage_of_total: 20,
        requirements: 'Payment for mobilization and materials',
        typical_days_from_start: 30
      },
      {
        milestone_name: 'Foundation Complete',
        milestone_type: 'progress',
        sequence_order: 7,
        requirements: 'All foundation work completed',
        typical_days_from_start: 45
      },
      {
        milestone_name: 'Rough Work Complete',
        milestone_type: 'progress',
        sequence_order: 8,
        requirements: 'All rough electrical, plumbing, HVAC complete',
        typical_days_from_start: 60
      },
      {
        milestone_name: 'Second Progress Payment',
        milestone_type: 'payment',
        sequence_order: 9,
        percentage_of_total: 25,
        requirements: 'Payment for rough work completion',
        typical_days_from_start: 61
      },
      {
        milestone_name: 'Rough Inspections',
        milestone_type: 'inspection',
        sequence_order: 10,
        requirements: 'All rough inspections passed',
        typical_days_from_start: 65
      },
      {
        milestone_name: 'Finish Work Complete',
        milestone_type: 'progress',
        sequence_order: 11,
        requirements: 'All finish work completed',
        typical_days_from_start: 85
      },
      {
        milestone_name: 'Third Progress Payment',
        milestone_type: 'payment',
        sequence_order: 12,
        percentage_of_total: 25,
        requirements: 'Payment for finish work',
        typical_days_from_start: 86
      },
      {
        milestone_name: 'Final Inspections',
        milestone_type: 'inspection',
        sequence_order: 13,
        requirements: 'All final inspections passed',
        typical_days_from_start: 90
      },
      {
        milestone_name: 'Project Closeout',
        milestone_type: 'progress',
        sequence_order: 14,
        requirements: 'All documentation and warranties provided',
        typical_days_from_start: 95
      },
      {
        milestone_name: 'Final Payment',
        milestone_type: 'payment',
        sequence_order: 15,
        percentage_of_total: 15,
        requirements: 'Retention release and final payment',
        typical_days_from_start: 100
      }
    ]
  }

  static async createMilestonesForJob(
    jobId: string, 
    projectType: string = 'standard_construction',
    totalJobValue?: number,
    startDate?: string
  ): Promise<JobMilestone[]> {
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

      // Get milestone templates for project type
      const templates = this.MILESTONE_TEMPLATES[projectType] || this.MILESTONE_TEMPLATES.standard_construction

      // Check if milestones already exist
      const { data: existingMilestones } = await supabase
        .from('job_milestones')
        .select('id')
        .eq('job_id', jobId)

      if (existingMilestones && existingMilestones.length > 0) {
        throw new Error('Milestones already exist for this job')
      }

      const projectStartDate = startDate ? new Date(startDate) : new Date()

      // Create milestone records
      const milestoneRecords = templates.map(template => {
        const targetDate = new Date(projectStartDate)
        if (template.typical_days_from_start) {
          targetDate.setDate(targetDate.getDate() + template.typical_days_from_start)
        }

        const amount = totalJobValue && template.percentage_of_total 
          ? Math.round((totalJobValue * template.percentage_of_total) / 100)
          : undefined

        return {
          job_id: jobId,
          tenant_id: userProfile.tenant_id,
          milestone_name: template.milestone_name,
          milestone_type: template.milestone_type,
          sequence_order: template.sequence_order,
          amount,
          percentage_of_total: template.percentage_of_total,
          status: 'pending' as const,
          target_date: targetDate.toISOString().split('T')[0], // Date only
          requirements: template.requirements
        }
      })

      const { data, error } = await supabase
        .from('job_milestones')
        .insert(milestoneRecords)
        .select()

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error creating milestones:', error)
      throw error
    }
  }

  static async getMilestonesForJob(jobId: string): Promise<JobMilestone[]> {
    try {
      const { data, error } = await supabase
        .from('job_milestones')
        .select('*')
        .eq('job_id', jobId)
        .order('sequence_order', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching milestones:', error)
      throw error
    }
  }

  static async updateMilestoneStatus(
    milestoneId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped',
    notes?: string,
    attachments?: any[]
  ): Promise<void> {
    try {
      // Get the current milestone to capture the old status for workflow automation
      const { data: currentMilestone, error: fetchError } = await supabase
        .from('job_milestones')
        .select('*')
        .eq('id', milestoneId)
        .single()

      if (fetchError) throw fetchError

      const updateData: any = {
        status,
        notes,
        updated_at: new Date().toISOString()
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
        
        // Get current user to record who completed it
        const { data: user } = await supabase.auth.getUser()
        if (user.user) {
          updateData.completed_by = user.user.id
        }
      }

      if (attachments) {
        updateData.attachments = attachments
      }

      const { error } = await supabase
        .from('job_milestones')
        .update(updateData)
        .eq('id', milestoneId)

      if (error) throw error

      // Trigger workflow automation for milestone status changes
      try {
        await WorkflowAutomationService.triggerWorkflow(
          'milestone',
          milestoneId,
          'status_change',
          {
            old_status: currentMilestone.status,
            new_status: status,
            milestone_type: currentMilestone.milestone_type,
            milestone_name: currentMilestone.milestone_name,
            job_id: currentMilestone.job_id,
            notes,
            changed_at: new Date().toISOString()
          }
        )
      } catch (workflowError) {
        console.warn('Workflow automation trigger failed:', workflowError)
        // Don't fail the milestone update if workflow automation fails
      }

    } catch (error) {
      console.error('Error updating milestone status:', error)
      throw error
    }
  }

  static async getUpcomingMilestones(tenantId: string, days: number = 7): Promise<JobMilestone[]> {
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + days)

      const { data, error } = await supabase
        .from('job_milestones')
        .select(`
          *,
          jobs:job_id (
            id,
            title,
            account:accounts(name),
            location_address
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'in_progress'])
        .lte('target_date', endDate.toISOString().split('T')[0])
        .order('target_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching upcoming milestones:', error)
      throw error
    }
  }

  static async getOverdueMilestones(tenantId: string): Promise<JobMilestone[]> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('job_milestones')
        .select(`
          *,
          jobs:job_id (
            id,
            title,
            account:accounts(name),
            location_address
          )
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'in_progress'])
        .lt('target_date', today)
        .order('target_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching overdue milestones:', error)
      throw error
    }
  }

  static async getMilestonesByStatus(
    tenantId: string,
    status: string
  ): Promise<JobMilestone[]> {
    try {
      const { data, error } = await supabase
        .from('job_milestones')
        .select(`
          *,
          jobs:job_id (
            id,
            title,
            account:accounts(name),
            location_address
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .order('target_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching milestones by status:', error)
      throw error
    }
  }

  static async getPaymentMilestones(tenantId: string): Promise<JobMilestone[]> {
    try {
      const { data, error } = await supabase
        .from('job_milestones')
        .select(`
          *,
          jobs:job_id (
            id,
            title,
            account:accounts(name),
            location_address,
            estimated_cost
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('milestone_type', 'payment')
        .order('target_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching payment milestones:', error)
      throw error
    }
  }

  static async calculateJobProgress(jobId: string): Promise<{
    total_milestones: number
    completed_milestones: number
    progress_percentage: number
    next_milestone?: JobMilestone
  }> {
    try {
      const milestones = await this.getMilestonesForJob(jobId)
      
      const totalMilestones = milestones.length
      const completedMilestones = milestones.filter(m => m.status === 'completed').length
      const progressPercentage = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0
      
      const nextMilestone = milestones.find(m => 
        m.status === 'pending' || m.status === 'in_progress'
      )

      return {
        total_milestones: totalMilestones,
        completed_milestones: completedMilestones,
        progress_percentage: progressPercentage,
        next_milestone: nextMilestone
      }
    } catch (error) {
      console.error('Error calculating job progress:', error)
      throw error
    }
  }

  static getMilestoneTemplates(projectType: string): MilestoneTemplate[] {
    return this.MILESTONE_TEMPLATES[projectType] || this.MILESTONE_TEMPLATES.standard_construction
  }

  static getAvailableProjectTypes(): string[] {
    return Object.keys(this.MILESTONE_TEMPLATES)
  }
}