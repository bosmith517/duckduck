import { jobActivityService } from '../services/jobActivityService'
import { supabase } from '../../supabaseClient'

/**
 * Utility to automatically log activities when certain actions happen
 */

// Log when photos are uploaded
export const logPhotoUpload = async (jobId: string, photoCount: number = 1) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (profile?.tenant_id) {
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: 'photo_uploaded',
      activityCategory: 'user',
      title: `${photoCount} photo${photoCount > 1 ? 's' : ''} uploaded`,
      description: `New photo${photoCount > 1 ? 's' : ''} added to job documentation`,
      isVisibleToCustomer: true,
      metadata: { photoCount }
    })
  }
}

// Log status changes
export const logStatusChange = async (jobId: string, oldStatus: string, newStatus: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (profile?.tenant_id) {
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: 'status_changed',
      activityCategory: 'system',
      title: `Status updated to ${newStatus}`,
      description: `Job status changed from ${oldStatus} to ${newStatus}`,
      isVisibleToCustomer: true,
      isMilestone: ['completed', 'in_progress'].includes(newStatus.toLowerCase()),
      metadata: { oldStatus, newStatus }
    })
  }
}

// Log when work starts
export const logWorkStarted = async (jobId: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (profile?.tenant_id) {
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: 'work_started',
      activityCategory: 'technician',
      title: 'Work started',
      description: 'Technician has begun working on the job',
      isVisibleToCustomer: true,
      isMilestone: true
    })
  }
}

// Log notes
export const logNoteAdded = async (jobId: string, noteContent: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (profile?.tenant_id) {
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: 'note_added',
      activityCategory: 'user',
      title: 'Note added',
      description: noteContent.substring(0, 200) + (noteContent.length > 200 ? '...' : ''),
      isVisibleToCustomer: false, // Notes are usually internal
      metadata: { noteLength: noteContent.length }
    })
  }
}

// Log location updates (when tracking is active)
export const logLocationUpdate = async (jobId: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (profile?.tenant_id) {
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: 'location_update',
      activityCategory: 'technician',
      title: 'Technician on the way',
      description: 'Live location tracking has been activated',
      isVisibleToCustomer: true
    })
  }
}

// Helper to manually create test activities
export const createTestActivities = async (jobId: string) => {
  console.log('Creating test activities for job:', jobId)
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('id', user?.id)
    .single()

  if (!profile?.tenant_id) {
    console.error('No tenant ID found')
    return
  }

  const testActivities = [
    {
      activityType: 'job_created' as const,
      title: 'Job created',
      description: 'New job was created in the system',
      isVisibleToCustomer: true,
      delay: 0
    },
    {
      activityType: 'technician_assigned' as const,
      title: 'Technician assigned',
      description: 'Mike Rodriguez has been assigned to this job',
      isVisibleToCustomer: true,
      delay: 1000
    },
    {
      activityType: 'work_started' as const,
      title: 'Work started',
      description: 'Technician has arrived and begun work',
      isVisibleToCustomer: true,
      isMilestone: true,
      delay: 2000
    },
    {
      activityType: 'photo_uploaded' as const,
      title: '5 photos uploaded',
      description: 'Documentation photos added',
      isVisibleToCustomer: true,
      metadata: { photoCount: 5 },
      delay: 3000
    },
    {
      activityType: 'note_added' as const,
      title: 'Internal note added',
      description: 'Discovered additional issues with HVAC filter housing',
      isVisibleToCustomer: false,
      delay: 4000
    }
  ]

  for (const activity of testActivities) {
    await new Promise(resolve => setTimeout(resolve, activity.delay))
    
    await jobActivityService.logActivity({
      jobId,
      tenantId: profile.tenant_id,
      userId: user?.id,
      activityType: activity.activityType,
      activityCategory: 'user',
      title: activity.title,
      description: activity.description,
      isVisibleToCustomer: activity.isVisibleToCustomer,
      isMilestone: activity.isMilestone,
      metadata: activity.metadata
    })
  }

  console.log('✅ Test activities created')
}