import { useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useSupabaseAuth } from '../modules/auth/core/SupabaseAuth'
import ClientPortalService from '../services/clientPortalService'

export const useJobPortalIntegration = () => {
  const { userProfile } = useSupabaseAuth()

  useEffect(() => {
    if (!userProfile?.tenant_id) return

    // Listen for new job insertions
    const subscription = supabase
      .channel('job-portal-integration')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: `tenant_id=eq.${userProfile.tenant_id}`
        },
        async (payload) => {
          const newJob = payload.new
          
          // Only generate portal for jobs with customers
          if (newJob.contact_id || newJob.account_id) {
            console.log('New job detected, generating portal token...', newJob.id)
            
            try {
              const success = await ClientPortalService.autoGeneratePortalForJob(newJob.id)
              if (success) {
                console.log('Portal token generated and notifications sent for job:', newJob.id)
              }
            } catch (error) {
              console.error('Error auto-generating portal for job:', newJob.id, error)
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userProfile?.tenant_id])

  // Manual trigger for existing jobs
  const generatePortalForJob = async (jobId: string): Promise<boolean> => {
    try {
      return await ClientPortalService.autoGeneratePortalForJob(jobId)
    } catch (error) {
      console.error('Error generating portal for job:', error)
      return false
    }
  }

  return {
    generatePortalForJob
  }
}