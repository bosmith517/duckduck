import { supabase } from '../../supabaseClient'

export interface JobInspection {
  id: string
  job_id: string
  tenant_id: string
  trade: string
  phase: string
  inspection_type: string
  required: boolean
  prerequisites: string[]
  status: 'pending' | 'scheduled' | 'passed' | 'failed' | 'waived'
  scheduled_date?: string
  completed_date?: string
  inspector_name?: string
  inspector_contact?: string
  result?: 'pass' | 'fail' | 'conditional'
  notes?: string
  punch_list?: string[]
  certificate_number?: string
  created_at: string
  updated_at: string
}

export interface InspectionTemplate {
  trade: string
  phase: string
  inspection_type: string
  required: boolean
  prerequisites: string[]
  typical_duration_days?: number
}

export class InspectionService {
  // Inspection templates by job type
  private static INSPECTION_TEMPLATES: Record<string, InspectionTemplate[]> = {
    electrical: [
      {
        trade: 'electrical',
        phase: 'rough',
        inspection_type: 'city',
        required: true,
        prerequisites: ['permit_approved', 'rough_wiring_complete', 'conduit_installed'],
        typical_duration_days: 1
      },
      {
        trade: 'electrical',
        phase: 'final',
        inspection_type: 'city',
        required: true,
        prerequisites: ['rough_inspection_passed', 'fixtures_installed', 'panel_complete'],
        typical_duration_days: 1
      }
    ],
    plumbing: [
      {
        trade: 'plumbing',
        phase: 'rough',
        inspection_type: 'city',
        required: true,
        prerequisites: ['permit_approved', 'rough_plumbing_complete', 'pressure_test_passed'],
        typical_duration_days: 1
      },
      {
        trade: 'plumbing',
        phase: 'final',
        inspection_type: 'city',
        required: true,
        prerequisites: ['rough_inspection_passed', 'fixtures_installed', 'water_heater_connected'],
        typical_duration_days: 1
      }
    ],
    hvac: [
      {
        trade: 'hvac',
        phase: 'rough',
        inspection_type: 'city',
        required: true,
        prerequisites: ['permit_approved', 'ductwork_complete', 'unit_placement_verified'],
        typical_duration_days: 1
      },
      {
        trade: 'hvac',
        phase: 'final',
        inspection_type: 'city',
        required: true,
        prerequisites: ['rough_inspection_passed', 'equipment_installed', 'system_tested'],
        typical_duration_days: 1
      }
    ],
    general_construction: [
      {
        trade: 'structural',
        phase: 'foundation',
        inspection_type: 'city',
        required: true,
        prerequisites: ['excavation_complete', 'forms_in_place'],
        typical_duration_days: 1
      },
      {
        trade: 'structural',
        phase: 'framing',
        inspection_type: 'city',
        required: true,
        prerequisites: ['foundation_inspection_passed', 'framing_complete'],
        typical_duration_days: 1
      },
      {
        trade: 'structural',
        phase: 'final',
        inspection_type: 'city',
        required: true,
        prerequisites: ['all_rough_inspections_passed', 'finish_work_complete'],
        typical_duration_days: 1
      }
    ],
    roofing: [
      {
        trade: 'roofing',
        phase: 'final',
        inspection_type: 'city',
        required: true,
        prerequisites: ['roofing_complete', 'flashing_installed'],
        typical_duration_days: 1
      }
    ]
  }

  static async createInspectionsForJob(jobId: string, jobType: string): Promise<JobInspection[]> {
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

      // Get inspection templates for job type
      const templates = this.INSPECTION_TEMPLATES[jobType] || this.INSPECTION_TEMPLATES.general_construction

      // Check if inspections already exist
      const { data: existingInspections } = await supabase
        .from('job_inspections')
        .select('id')
        .eq('job_id', jobId)

      if (existingInspections && existingInspections.length > 0) {
        throw new Error('Inspections already exist for this job')
      }

      // Create inspection records
      const inspectionRecords = templates.map(template => ({
        job_id: jobId,
        tenant_id: userProfile.tenant_id,
        trade: template.trade,
        phase: template.phase,
        inspection_type: template.inspection_type,
        required: template.required,
        prerequisites: template.prerequisites,
        status: 'pending' as const
      }))

      const { data, error } = await supabase
        .from('job_inspections')
        .insert(inspectionRecords)
        .select()

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error creating inspections:', error)
      throw error
    }
  }

  static async getInspectionsForJob(jobId: string): Promise<JobInspection[]> {
    try {
      const { data, error } = await supabase
        .from('job_inspections')
        .select('*')
        .eq('job_id', jobId)
        .order('trade', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching inspections:', error)
      throw error
    }
  }

  static async scheduleInspection(
    inspectionId: string, 
    scheduleData: {
      scheduled_date: string
      inspector_name: string
      inspector_contact?: string
      notes?: string
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_inspections')
        .update({
          status: 'scheduled',
          scheduled_date: scheduleData.scheduled_date,
          inspector_name: scheduleData.inspector_name,
          inspector_contact: scheduleData.inspector_contact,
          notes: scheduleData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', inspectionId)

      if (error) throw error
    } catch (error) {
      console.error('Error scheduling inspection:', error)
      throw error
    }
  }

  static async completeInspection(
    inspectionId: string,
    resultData: {
      result: 'pass' | 'fail' | 'conditional'
      notes?: string
      punch_list?: string[]
      certificate_number?: string
    }
  ): Promise<void> {
    try {
      const status = resultData.result === 'pass' ? 'passed' : 'failed'

      const { error } = await supabase
        .from('job_inspections')
        .update({
          status,
          completed_date: new Date().toISOString(),
          result: resultData.result,
          notes: resultData.notes,
          punch_list: resultData.punch_list || [],
          certificate_number: resultData.certificate_number,
          updated_at: new Date().toISOString()
        })
        .eq('id', inspectionId)

      if (error) throw error
    } catch (error) {
      console.error('Error completing inspection:', error)
      throw error
    }
  }

  static async waiveInspection(inspectionId: string, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('job_inspections')
        .update({
          status: 'waived',
          notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', inspectionId)

      if (error) throw error
    } catch (error) {
      console.error('Error waiving inspection:', error)
      throw error
    }
  }

  static async checkPrerequisites(jobId: string, prerequisites: string[]): Promise<boolean> {
    // This would check job milestones, permits, and other prerequisites
    // For now, return true as a simplified implementation
    // In production, you'd query job_milestones, job_permits, etc.
    
    try {
      // Check if all prerequisite milestones are completed
      const { data: milestones } = await supabase
        .from('job_milestones')
        .select('milestone_name, status')
        .eq('job_id', jobId)
        .in('milestone_name', prerequisites)

      if (!milestones) return false

      // All prerequisites must be completed
      return milestones.every(milestone => milestone.status === 'completed')
    } catch (error) {
      console.error('Error checking prerequisites:', error)
      return false
    }
  }

  static async getInspectionsByStatus(
    tenantId: string, 
    status: string
  ): Promise<JobInspection[]> {
    try {
      const { data, error } = await supabase
        .from('job_inspections')
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
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching inspections by status:', error)
      throw error
    }
  }

  static async getUpcomingInspections(tenantId: string, days: number = 7): Promise<JobInspection[]> {
    try {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + days)

      const { data, error } = await supabase
        .from('job_inspections')
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
        .eq('status', 'scheduled')
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString())
        .order('scheduled_date', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching upcoming inspections:', error)
      throw error
    }
  }

  static getInspectionTemplates(jobType: string): InspectionTemplate[] {
    return this.INSPECTION_TEMPLATES[jobType] || this.INSPECTION_TEMPLATES.general_construction
  }
}