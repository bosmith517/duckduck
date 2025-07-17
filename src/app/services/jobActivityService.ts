import { supabase } from '../../supabaseClient'

export interface JobActivityParams {
  jobId?: string
  leadId?: string
  tenantId: string
  userId?: string
  activityType: 
    // Lead activities
    | 'lead_created'
    | 'lead_called'
    | 'lead_contacted'
    | 'lead_qualified'
    | 'lead_unqualified'
    | 'lead_status_changed'
    | 'lead_assigned'
    | 'lead_follow_up_scheduled'
    | 'lead_follow_up_completed'
    | 'lead_converted'
    | 'site_visit_scheduled'
    | 'site_visit_completed'
    | 'site_visit_cancelled'
    // Job activities
    | 'job_created'
    | 'estimate_created' 
    | 'estimate_revised'
    | 'estimate_sent'
    | 'estimate_viewed'
    | 'estimate_accepted'
    | 'estimate_declined'
    | 'work_started'
    | 'work_completed'
    | 'work_paused'
    | 'photo_uploaded'
    | 'note_added'
    | 'status_changed'
    | 'payment_received'
    | 'invoice_created'
    | 'invoice_sent'
    | 'technician_assigned'
    | 'location_update'
    | 'call_made'
    | 'sms_sent'
    | 'email_sent'
    | 'photo_batch_uploaded'
    | 'photo_deleted'
    | 'other'
  activityCategory?: 'system' | 'user' | 'customer' | 'technician' | 'admin'
  title: string
  description?: string
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, any>
  isVisibleToCustomer?: boolean
  isMilestone?: boolean
}

export interface JobActivity {
  id: string
  tenant_id: string
  job_id?: string
  lead_id?: string
  user_id?: string
  activity_type: string
  activity_category: string
  title: string
  description?: string
  reference_id?: string
  reference_type?: string
  metadata?: Record<string, any>
  is_visible_to_customer: boolean
  is_milestone: boolean
  created_at: string
  user_profiles?: {
    first_name: string
    last_name: string
    role: string
  }
}

class JobActivityService {
  /**
   * Log a new job activity
   */
  async logActivity(params: JobActivityParams): Promise<JobActivity | null> {
    try {
      // Validate that either jobId or leadId is provided
      if (!params.jobId && !params.leadId) {
        throw new Error('Either jobId or leadId must be provided')
      }

      const { data, error } = await supabase
        .from('job_activity_log')
        .insert({
          job_id: params.jobId || null,
          lead_id: params.leadId || null,
          tenant_id: params.tenantId,
          user_id: params.userId,
          activity_type: params.activityType,
          activity_category: params.activityCategory || 'system',
          title: params.title,
          description: params.description,
          reference_id: params.referenceId,
          reference_type: params.referenceType,
          metadata: params.metadata || {},
          is_visible_to_customer: params.isVisibleToCustomer || false,
          is_milestone: params.isMilestone || false,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error logging job activity:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in logActivity:', error)
      return null
    }
  }

  /**
   * Get all activities for a job
   */
  async getJobActivities(jobId: string, includeNonCustomerVisible: boolean = true): Promise<JobActivity[]> {
    try {
      let query = supabase
        .from('job_activity_log')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            role
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      // Filter for customer visibility if needed
      if (!includeNonCustomerVisible) {
        query = query.eq('is_visible_to_customer', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching job activities:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getJobActivities:', error)
      return []
    }
  }

  /**
   * Get all activities for a lead
   */
  async getLeadActivities(leadId: string, includeNonCustomerVisible: boolean = true): Promise<JobActivity[]> {
    try {
      let query = supabase
        .from('job_activity_log')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            role
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      // Filter for customer visibility if needed
      if (!includeNonCustomerVisible) {
        query = query.eq('is_visible_to_customer', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching lead activities:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getLeadActivities:', error)
      return []
    }
  }

  /**
   * Get complete customer journey activities (lead + job)
   * This gets all activities related to a customer journey from lead to job completion
   */
  async getCustomerJourneyActivities(leadId: string, jobId?: string, includeNonCustomerVisible: boolean = true): Promise<JobActivity[]> {
    try {
      let query = supabase
        .from('job_activity_log')
        .select(`
          *,
          user_profiles (
            first_name,
            last_name,
            role
          )
        `)

      // Build the query to get activities for both lead and job
      if (jobId) {
        query = query.or(`lead_id.eq.${leadId},job_id.eq.${jobId}`)
      } else {
        query = query.eq('lead_id', leadId)
      }

      query = query.order('created_at', { ascending: false })

      // Filter for customer visibility if needed
      if (!includeNonCustomerVisible) {
        query = query.eq('is_visible_to_customer', true)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching customer journey activities:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getCustomerJourneyActivities:', error)
      return []
    }
  }

  /**
   * Helper methods for common activity types
   */
  
  // Lead activity helpers
  async logLeadCreated(
    leadId: string,
    tenantId: string,
    userId: string,
    leadSource: string,
    callerName: string,
    phoneNumber: string,
    initialRequest: string
  ) {
    return this.logActivity({
      leadId,
      tenantId,
      userId,
      activityType: 'lead_created',
      activityCategory: 'system',
      title: 'Lead Created',
      description: `New lead from ${leadSource}: ${callerName}`,
      metadata: { leadSource, callerName, phoneNumber, initialRequest },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logLeadAssigned(
    leadId: string,
    tenantId: string,
    userId: string,
    assignedToId: string,
    assignedToName: string
  ) {
    return this.logActivity({
      leadId,
      tenantId,
      userId,
      activityType: 'lead_assigned',
      activityCategory: 'user',
      title: 'Lead Assigned',
      description: `Lead assigned to ${assignedToName}`,
      referenceId: assignedToId,
      referenceType: 'user',
      metadata: { assignedToId, assignedToName },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logLeadStatusChange(
    leadId: string,
    tenantId: string,
    userId: string,
    oldStatus: string,
    newStatus: string
  ) {
    return this.logActivity({
      leadId,
      tenantId,
      userId,
      activityType: 'lead_status_changed',
      activityCategory: 'user',
      title: `Lead Status Changed to ${newStatus}`,
      description: `Lead status updated from "${oldStatus}" to "${newStatus}"`,
      metadata: { oldStatus, newStatus },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logSiteVisitScheduled(
    leadId: string,
    tenantId: string,
    userId: string,
    visitDate: string,
    assignedTo?: string
  ) {
    return this.logActivity({
      leadId,
      tenantId,
      userId,
      activityType: 'site_visit_scheduled',
      activityCategory: 'user',
      title: 'Site Visit Scheduled',
      description: `Site visit scheduled for ${new Date(visitDate).toLocaleDateString()}`,
      metadata: { visitDate, assignedTo },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logSiteVisitCompleted(
    leadId: string,
    tenantId: string,
    userId: string,
    visitNotes: string,
    visitDate?: string
  ) {
    return this.logActivity({
      leadId,
      tenantId,
      userId,
      activityType: 'site_visit_completed',
      activityCategory: 'user',
      title: 'Site Visit Completed',
      description: `Site visit completed. Notes: ${visitNotes.substring(0, 200)}`,
      metadata: { visitNotes, visitDate },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logLeadConverted(
    leadId: string,
    tenantId: string,
    userId: string,
    jobId: string,
    jobNumber?: string,
    estimatedValue?: number
  ) {
    return this.logActivity({
      leadId,
      jobId,
      tenantId,
      userId,
      activityType: 'lead_converted',
      activityCategory: 'user',
      title: 'Lead Converted to Job',
      description: `Lead successfully converted to job ${jobNumber || jobId}`,
      referenceId: jobId,
      referenceType: 'job',
      metadata: { jobId, jobNumber, estimatedValue },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  // Job activity helpers
  async logEstimateCreated(
    jobId: string, 
    tenantId: string, 
    userId: string, 
    estimateId: string,
    estimateTotal: number
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: 'estimate_created',
      activityCategory: 'user',
      title: 'Estimate Created',
      description: `New estimate created with total amount of $${estimateTotal.toFixed(2)}`,
      referenceId: estimateId,
      referenceType: 'estimate',
      metadata: { estimateTotal },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logStatusChange(
    jobId: string,
    tenantId: string,
    userId: string,
    oldStatus: string,
    newStatus: string
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: 'status_changed',
      activityCategory: 'user',
      title: `Status Changed to ${newStatus}`,
      description: `Job status updated from "${oldStatus}" to "${newStatus}"`,
      metadata: { oldStatus, newStatus },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logTechnicianAssigned(
    jobId: string,
    tenantId: string,
    userId: string,
    technicianId: string,
    technicianName: string
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: 'technician_assigned',
      activityCategory: 'user',
      title: 'Technician Assigned',
      description: `${technicianName} has been assigned to this job`,
      referenceId: technicianId,
      referenceType: 'technician',
      metadata: { technicianId, technicianName },
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }

  async logPhotoUploaded(
    jobId: string,
    tenantId: string,
    userId: string,
    photoId: string,
    photoDescription: string
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: 'photo_uploaded',
      activityCategory: 'technician',
      title: 'Photo Added',
      description: `New photo uploaded: ${photoDescription}`,
      referenceId: photoId,
      referenceType: 'photo',
      metadata: { photoDescription },
      isVisibleToCustomer: true,
      isMilestone: false
    })
  }

  async logPhotoBatchUploaded(
    jobId: string,
    photoCount: number,
    photoType: string,
    userId: string
  ) {
    return this.logActivity({
      jobId,
      tenantId: '', // Will be set by logActivity from job lookup
      userId,
      activityType: 'photo_batch_uploaded',
      activityCategory: 'technician',
      title: `${photoCount} Photos Added`,
      description: `${photoCount} ${photoType.replace('_', ' ')} photos uploaded`,
      metadata: { 
        photoCount,
        photoType,
        batchUpload: true
      },
      isVisibleToCustomer: true,
      isMilestone: false
    })
  }

  async logPhotoDeleted(
    jobId: string,
    tenantId: string
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId: '', // Will be set by context
      activityType: 'photo_deleted',
      activityCategory: 'technician',
      title: 'Photo Deleted',
      description: 'A photo was removed from the job',
      isVisibleToCustomer: false,
      isMilestone: false
    })
  }

  async logNoteAdded(
    jobId: string,
    tenantId: string,
    userId: string,
    noteContent: string,
    isCustomerVisible: boolean = false
  ) {
    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: 'note_added',
      activityCategory: 'user',
      title: isCustomerVisible ? 'Customer Update' : 'Internal Note Added',
      description: noteContent,
      metadata: { noteLength: noteContent.length },
      isVisibleToCustomer: isCustomerVisible,
      isMilestone: false
    })
  }

  async logWorkUpdate(
    jobId: string,
    tenantId: string,
    userId: string,
    workStatus: 'started' | 'completed' | 'paused',
    details?: string
  ) {
    const statusTitles = {
      started: 'Work Started',
      completed: 'Work Completed',
      paused: 'Work Paused'
    }

    return this.logActivity({
      jobId,
      tenantId,
      userId,
      activityType: `work_${workStatus}` as any,
      activityCategory: 'technician',
      title: statusTitles[workStatus],
      description: details || `Work has been ${workStatus}`,
      metadata: { workStatus, details },
      isVisibleToCustomer: true,
      isMilestone: workStatus !== 'paused'
    })
  }
}

export const jobActivityService = new JobActivityService()