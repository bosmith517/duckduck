import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase, Job } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { PaymentSchedule } from './components/PaymentSchedule'
import { trackingService } from '../../services/trackingService'
import { showToast } from '../../utils/toast'
import JobCostingDashboard from '../../components/billing/JobCostingDashboard'
import JobPhotoGallery from '../../components/shared/JobPhotoGallery'
import JobActivityTimeline from '../../components/shared/JobActivityTimeline'
import JobDocuments from '../../components/shared/JobDocuments'
import PropertyDetails from '../../components/shared/PropertyDetails'
import { jobActivityService } from '../../services/jobActivityService'
import { JobForm } from './components/JobForm'
import ClientPortalService from '../../services/clientPortalService'
import { createTestActivities } from '../../utils/activityLogger'
import { InspectionManager } from '../../components/jobs/InspectionManager'
import { MilestoneManager } from '../../components/jobs/MilestoneManager'
import { TeamAssignmentManager } from '../../components/jobs/TeamAssignmentManager'
import { MaterialOrderManager } from '../../components/jobs/MaterialOrderManager'
import CopyPortalLink from '../../components/jobs/CopyPortalLink'

interface JobWithRelations {
  id: string
  tenant_id: string
  account_id: string
  contact_id?: string
  lead_id?: string
  created_at: string
  updated_at: string
  status?: string
  description?: string
  start_date?: string
  job_number?: string
  title: string
  priority?: string
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  estimated_cost?: number
  actual_cost?: number
  location_address?: string
  location_city?: string
  location_state?: string
  location_zip?: string
  notes?: string
  estimate_id?: string
  account?: {
    id: string
    name: string
  }
  contact?: {
    id: string
    first_name: string
    last_name: string
  }
  estimates?: Array<{
    id: string
    estimate_number: string
    total_amount: number
    status: string
    created_at: string
    version?: number
  }>
}

const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userProfile } = useSupabaseAuth()
  const [job, setJob] = useState<JobWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('details')
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [showAddNoteModal, setShowAddNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)

  useEffect(() => {
    if (id && userProfile?.tenant_id) {
      fetchJob()
      fetchAccounts()
      fetchContacts()
      checkExistingPortal()
    }
  }, [id, userProfile?.tenant_id])

  // Listen for tab switching from PaymentSchedule component
  useEffect(() => {
    const handleSwitchToMilestones = () => {
      setActiveTab('milestones')
    }

    window.addEventListener('switchToMilestonesTab', handleSwitchToMilestones)
    return () => {
      window.removeEventListener('switchToMilestonesTab', handleSwitchToMilestones)
    }
  }, [])

  const fetchJob = async () => {
    if (!id || !userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          account:accounts(id, name, phone, email),
          contact:contacts(id, first_name, last_name, phone, email)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching job:', error)
        navigate('/jobs')
        return
      }

      // Get ALL estimates related to this job
      // This includes estimates that reference this job OR that this job references
      const { data: allEstimates } = await supabase
        .from('estimates')
        .select('id, estimate_number, total_amount, status, created_at, version')
        .or(`job_id.eq.${id},id.eq.${data.estimate_id}`)
        .order('created_at', { ascending: false })

      setJob({
        ...data,
        estimates: allEstimates || []
      })
    } catch (error) {
      console.error('Error fetching job:', error)
      navigate('/jobs')
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching accounts:', error)
        return
      }

      setAccounts(data || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
    }
  }

  const fetchContacts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, account_id')
        .order('last_name', { ascending: true })

      if (error) {
        console.error('Error fetching contacts:', error)
        return
      }

      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const handleUpdateJob = async (jobData: Partial<Job>) => {
    if (!job?.id || !userProfile?.tenant_id) {
      console.error('Missing job ID or tenant ID', { jobId: job?.id, tenantId: userProfile?.tenant_id })
      showToast.error('Unable to update job - missing required information')
      return
    }

    try {
      // Ensure tenant_id is included for RLS and clean up undefined values
      const updateData = Object.entries({
        ...jobData,
        tenant_id: userProfile.tenant_id,
        updated_at: new Date().toISOString()
      }).reduce((acc, [key, value]) => {
        // Only include defined values (convert undefined to null for Supabase)
        if (value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as any)
      
      const { data, error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', job.id)
        .eq('tenant_id', userProfile.tenant_id) // Add tenant_id to the WHERE clause for RLS
        .select(`
          *,
          account:accounts(id, name, phone, email),
          contact:contacts(id, first_name, last_name, phone, email)
        `)
        .single()

      if (error) {
        console.error('Error updating job:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        showToast.error(`Failed to update job: ${error.message || 'Unknown error'}`)
        return
      }

      // Log status change if status was updated
      if (jobData.status && jobData.status !== job.status && userProfile?.id && userProfile?.tenant_id) {
        try {
          await jobActivityService.logActivity({
            jobId: job.id,
            tenantId: userProfile.tenant_id,
            userId: userProfile.id,
            activityType: 'status_changed',
            activityCategory: 'system',
            title: `Status updated to ${jobData.status}`,
            description: `Job status changed from ${job.status} to ${jobData.status}`,
            isVisibleToCustomer: true,
            isMilestone: ['completed', 'in_progress'].includes(jobData.status.toLowerCase()),
            metadata: { oldStatus: job.status, newStatus: jobData.status }
          })
        } catch (logError) {
          console.error('Failed to log status change activity:', logError)
        }
      }

      setJob(data)
      setShowEditForm(false)
      showToast.success('Job updated successfully')
      // Force refresh the page section to show updated client
      setTimeout(() => {
        fetchJob()
      }, 100)
    } catch (error) {
      console.error('Error updating job:', error)
      showToast.error('Failed to update job')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'draft': 'badge-light-secondary',
      'scheduled': 'badge-light-info',
      'in_progress': 'badge-light-warning',
      'completed': 'badge-light-success',
      'on_hold': 'badge-light-warning',
      'cancelled': 'badge-light-danger'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const getPriorityBadge = (priority: string) => {
    const priorityClasses = {
      'low': 'badge-light-info',
      'medium': 'badge-light-primary',
      'high': 'badge-light-warning',
      'urgent': 'badge-light-danger'
    }
    return `badge ${priorityClasses[priority as keyof typeof priorityClasses] || 'badge-light-primary'}`
  }

  const handleStartTracking = async () => {
    if (!job?.id) return

    setTrackingLoading(true)
    const loadingToast = showToast.loading('Starting location tracking...')

    try {
      const result = await trackingService.startTracking(job.id)
      
      if (result.success) {
        setIsTracking(true)
        showToast.dismiss(loadingToast)
        showToast.success('Location tracking started! Customer has been notified.')
        
        if (result.trackingToken) {
          // Optionally show the tracking link to the technician
          console.log('Tracking link:', `${window.location.origin}/track/${result.trackingToken}`)
        }
      } else {
        throw new Error(result.error || 'Failed to start tracking')
      }
    } catch (error: any) {
      console.error('Error starting tracking:', error)
      showToast.dismiss(loadingToast)
      
      if (error.message.includes('permission') || error.message.includes('denied')) {
        showToast.error('Location permission is required to track your journey. Please enable location access and try again.')
      } else if (error.message.includes('not supported')) {
        showToast.error('Location tracking is not supported on this device.')
      } else {
        showToast.error(error.message || 'Failed to start location tracking. Please try again.')
      }
    } finally {
      setTrackingLoading(false)
    }
  }

  const handleStopTracking = async () => {
    try {
      await trackingService.stopTracking()
      setIsTracking(false)
      showToast.info('Location tracking stopped.')
    } catch (error) {
      console.error('Error stopping tracking:', error)
      showToast.error('Failed to stop tracking.')
    }
  }

  // Check if job status allows tracking
  const canStartTracking = () => {
    const status = job?.status
    return status === 'scheduled' || status === 'draft'
  }

  // Auto-stop tracking when job status changes
  useEffect(() => {
    if (isTracking && job?.status && (job.status === 'in_progress' || job.status === 'completed')) {
      handleStopTracking()
    }
  }, [job?.status, isTracking])

  const handleAddNote = () => {
    setShowAddNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim() || !job?.id || !userProfile?.id || !userProfile?.tenant_id) return

    setNoteLoading(true)
    try {
      await jobActivityService.logNoteAdded(
        job.id,
        userProfile.tenant_id,
        userProfile.id,
        noteText.trim(),
        false // Internal note by default
      )
      
      showToast.success('Note added successfully')
      setNoteText('')
      setShowAddNoteModal(false)
    } catch (error) {
      console.error('Error adding note:', error)
      showToast.error('Failed to add note')
    } finally {
      setNoteLoading(false)
    }
  }

  const checkExistingPortal = async () => {
    if (!id || !userProfile?.tenant_id) return

    try {
      const { data: token, error } = await supabase
        .from('client_portal_tokens')
        .select('token')
        .eq('job_id', id)
        .eq('is_active', true)
        .maybeSingle() // Use maybeSingle instead of single to avoid errors when no records found

      if (error) {
        console.warn('Error checking for existing portal token:', error)
        return
      }

      if (token) {
        const existingPortalUrl = `${window.location.origin}/portal/${token.token}`
        setPortalUrl(existingPortalUrl)
      }
    } catch (error) {
      console.warn('Failed to check existing portal (non-critical):', error)
    }
  }

  const handleGeneratePortal = async () => {
    if (!job?.id) return

    setPortalLoading(true)
    const loadingToast = showToast.loading('Generating customer portal...')

    try {
      // Try to generate portal (SMS might fail but portal could still be created)
      await ClientPortalService.autoGeneratePortalForJob(job.id)
      
      // Always check if a portal token exists after attempting generation
      const { data: token, error: tokenError } = await supabase
        .from('client_portal_tokens')
        .select('token')
        .eq('job_id', job.id)
        .eq('is_active', true)
        .maybeSingle() // Use maybeSingle instead of single

      if (token && !tokenError) {
        const portalUrl = `${window.location.origin}/portal/${token.token}`
        setPortalUrl(portalUrl)
        showToast.dismiss(loadingToast)
        showToast.success('Customer portal generated! SMS notification may have failed, but portal is accessible.')
        
        // Log the portal URL to console for easy access
        console.log('Portal URL:', portalUrl)
        
        // Also copy to clipboard for convenience
        navigator.clipboard.writeText(portalUrl)
        showToast.info('Portal URL copied to clipboard!')
      } else {
        throw new Error('Failed to generate portal token')
      }
    } catch (error: any) {
      console.error('Error generating portal:', error)
      showToast.dismiss(loadingToast)
      showToast.error(error.message || 'Failed to generate customer portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='d-flex justify-content-center align-items-center' style={{ minHeight: '400px' }}>
        <div className='spinner-border text-primary' role='status'>
          <span className='visually-hidden'>Loading...</span>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className='text-center py-10'>
        <div className='text-muted'>Job not found</div>
      </div>
    )
  }

  return (
    <>
      <PageTitle breadcrumbs={[
        { title: 'Jobs', path: '/jobs', isSeparator: false, isActive: false },
        { title: job.job_number || 'Job Details', path: '', isSeparator: true, isActive: true }
      ]}>
        Job Details
      </PageTitle>

      <div className='row g-5 g-xl-8'>
        {/* Job Header */}
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <div className='card-title d-flex flex-column'>
                <div className='d-flex align-items-center'>
                  <h3 className='fw-bold me-5 my-1'>{job.title}</h3>
                  <span className={getStatusBadge(job.status || 'draft')}>
                    {job.status?.replace('_', ' ') || 'Draft'}
                  </span>
                  <span className={`${getPriorityBadge(job.priority || 'medium')} ms-2`}>
                    {job.priority || 'Medium'} Priority
                  </span>
                </div>
                <span className='text-muted fw-semibold fs-7'>
                  {job.job_number} • Created {new Date(job.created_at).toLocaleDateString()}
                  {job.estimates && job.estimates.length > 0 && (
                    <>
                      {' • '}
                      <span className='text-primary'>
                        {job.estimates.length === 1 ? (
                          <a href={`/estimates`}>
                            Estimate {job.estimates[0].estimate_number}
                          </a>
                        ) : (
                          <a href={`/estimates`}>
                            {job.estimates.length} Estimates
                          </a>
                        )}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <div className='card-toolbar'>
                <button
                  className='btn btn-sm btn-light me-2'
                  onClick={() => navigate('/jobs')}
                >
                  <i className='ki-duotone ki-arrow-left fs-2'></i>
                  Back to Jobs
                </button>
                
                {/* Customer Portal Button */}
                <button
                  className='btn btn-sm btn-success me-2'
                  onClick={handleGeneratePortal}
                  disabled={portalLoading || !(job?.account_id || job?.contact_id)}
                  title={!(job?.account_id || job?.contact_id) ? 'Job must have a customer assigned' : 'Generate customer portal access'}
                >
                  {portalLoading ? (
                    <>
                      <span className='spinner-border spinner-border-sm me-2'></span>
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className='ki-duotone ki-user-tick fs-2 me-1'></i>
                      Generate Portal
                    </>
                  )}
                </button>
                
                <button 
                  className='btn btn-sm btn-primary'
                  onClick={() => setShowEditForm(true)}
                >
                  <i className='ki-duotone ki-pencil fs-2'></i>
                  Edit Job
                </button>
              </div>
            </div>
          </KTCard>
        </div>

        {/* Tab Navigation */}
        <div className='col-xl-12'>
          <div className='card card-bordered'>
            <div className='card-header'>
              <ul className='nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-4 fw-semibold mb-n2'>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'details' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('details')
                    }}
                  >
                    Job Details
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'payment' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('payment')
                    }}
                  >
                    Payment Schedule
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'costing' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('costing')
                    }}
                  >
                    Job Costing
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'estimates' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('estimates')
                    }}
                  >
                    Estimates
                    {job.estimates && job.estimates.length > 0 && (
                      <span className='badge badge-sm badge-circle badge-light-primary ms-2'>
                        {job.estimates.length}
                      </span>
                    )}
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'photos' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('photos')
                    }}
                  >
                    Photos
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'documents' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('documents')
                    }}
                  >
                    Documents
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'activity' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('activity')
                    }}
                  >
                    Activity
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'inspections' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('inspections')
                    }}
                  >
                    <i className='ki-duotone ki-verify fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Inspections
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'milestones' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('milestones')
                    }}
                  >
                    <i className='ki-duotone ki-chart-line-up fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Milestones
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'team-materials' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('team-materials')
                    }}
                  >
                    <i className='ki-duotone ki-people fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                      <span className='path4'></span>
                      <span className='path5'></span>
                    </i>
                    Team & Materials
                  </a>
                </li>
                <li className='nav-item'>
                  <a
                    className={`nav-link text-active-primary pb-4 ${activeTab === 'property' ? 'active' : ''}`}
                    href='#'
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('property')
                    }}
                  >
                    <i className='ki-duotone ki-home fs-6 me-1'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Property Data
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className='col-xl-12'>
          {activeTab === 'details' && (
            <div className='row g-5'>
              {/* Job Information */}
              <div className='col-xl-8'>
                <KTCard>
                  <div className='card-header'>
                    <h3 className='card-title'>Job Information</h3>
                  </div>
                  <KTCardBody>
                    <div className='row mb-7'>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Description</div>
                        <div className='text-gray-600 fs-6'>
                          {job.description || 'No description provided'}
                        </div>
                      </div>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Client</div>
                        <div className='text-gray-600 fs-6'>
                          {job.account?.name || 'No client assigned'}
                        </div>
                      </div>
                    </div>

                    <div className='row mb-7'>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Contact</div>
                        <div className='text-gray-600 fs-6'>
                          {job.contact ? `${job.contact.first_name} ${job.contact.last_name}` : 'No contact assigned'}
                        </div>
                      </div>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Due Date</div>
                        <div className='text-gray-600 fs-6'>
                          {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'No due date set'}
                        </div>
                      </div>
                    </div>

                    <div className='row mb-7'>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Estimated Cost</div>
                        <div className='text-gray-600 fs-6'>
                          {job.estimated_cost ? `$${Number(job.estimated_cost).toLocaleString()}` : 'Not specified'}
                        </div>
                      </div>
                      <div className='col-lg-6'>
                        <div className='fw-semibold text-gray-800 fs-6 mb-2'>Actual Cost</div>
                        <div className='text-gray-600 fs-6'>
                          {job.actual_cost ? `$${Number(job.actual_cost).toLocaleString()}` : 'Not specified'}
                        </div>
                      </div>
                    </div>

                    {job.notes && (
                      <div className='row'>
                        <div className='col-lg-12'>
                          <div className='fw-semibold text-gray-800 fs-6 mb-2'>Notes</div>
                          <div className='text-gray-600 fs-6'>
                            {job.notes}
                          </div>
                        </div>
                      </div>
                    )}
                  </KTCardBody>
                </KTCard>
              </div>

              {/* Job Stats */}
              <div className='col-xl-4'>
                <KTCard>
                  <div className='card-header'>
                    <h3 className='card-title'>Job Statistics</h3>
                  </div>
                  <KTCardBody>
                    <div className='d-flex flex-column'>
                      <div className='d-flex justify-content-between mb-4'>
                        <span className='text-muted fw-semibold'>Estimated Hours</span>
                        <span className='fw-bold'>{job.estimated_hours || 'N/A'}</span>
                      </div>
                      <div className='d-flex justify-content-between mb-4'>
                        <span className='text-muted fw-semibold'>Actual Hours</span>
                        <span className='fw-bold'>{job.actual_hours || 'N/A'}</span>
                      </div>
                      <div className='d-flex justify-content-between mb-4'>
                        <span className='text-muted fw-semibold'>Start Date</span>
                        <span className='fw-bold'>
                          {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'Not set'}
                        </span>
                      </div>
                      {/* Customer Portal URL */}
                      {portalUrl && (
                        <CopyPortalLink portalUrl={portalUrl} jobNumber={job.job_number} />
                      )}
                      
                      <div className='d-flex justify-content-between mb-4'>
                        <span className='text-muted fw-semibold'>Location</span>
                        <span className='fw-bold'>
                          {job.location_city && job.location_state 
                            ? `${job.location_city}, ${job.location_state}`
                            : 'Not specified'
                          }
                        </span>
                      </div>

                      {/* Tracking Section */}
                      <div className='separator border-gray-200 my-4'></div>
                      <div className='d-flex flex-column'>
                        <h4 className='fw-bold text-gray-800 fs-6 mb-3'>Customer Tracking</h4>
                        
                        {isTracking ? (
                          <div className='d-flex flex-column'>
                            <div className='alert alert-success d-flex align-items-center p-3 mb-3'>
                              <i className='ki-duotone ki-geolocation fs-2x text-success me-3'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <div>
                                <div className='fw-bold'>Location Tracking Active</div>
                                <div className='text-muted fs-7'>Customer can see your location</div>
                              </div>
                            </div>
                            <button
                              className='btn btn-light-danger btn-sm'
                              onClick={handleStopTracking}
                            >
                              <i className='ki-duotone ki-cross fs-2 me-2'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              Stop Tracking
                            </button>
                          </div>
                        ) : (
                          <div className='d-flex flex-column'>
                            {canStartTracking() ? (
                              <>
                                <div className='text-muted fs-7 mb-3'>
                                  Let your customer know you're on the way by sharing your live location.
                                </div>
                                <button
                                  className='btn btn-success btn-lg'
                                  onClick={handleStartTracking}
                                  disabled={trackingLoading}
                                >
                                  {trackingLoading ? (
                                    <>
                                      <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                                      Starting...
                                    </>
                                  ) : (
                                    <>
                                      <i className='ki-duotone ki-geolocation fs-2 me-2'>
                                        <span className='path1'></span>
                                        <span className='path2'></span>
                                      </i>
                                      On My Way
                                    </>
                                  )}
                                </button>
                              </>
                            ) : (
                              <div className='alert alert-info d-flex align-items-center p-3'>
                                <i className='ki-duotone ki-information fs-2x text-info me-3'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                </i>
                                <div>
                                  <div className='fw-bold'>Tracking Not Available</div>
                                  <div className='text-muted fs-7'>
                                    {job.status === 'in_progress' ? 'Job is already in progress' :
                                     job.status === 'completed' ? 'Job is completed' :
                                     'Job must be scheduled to start tracking'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </KTCardBody>
                </KTCard>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <PaymentSchedule jobId={job.id} />
          )}

          {activeTab === 'costing' && (
            <JobCostingDashboard jobId={job.id} />
          )}

          {activeTab === 'estimates' && (
            <KTCard>
              <div className='card-header'>
                <h3 className='card-title'>Related Estimates</h3>
                <div className='card-toolbar'>
                  <a href={`/estimates?job_id=${job.id}`} className='btn btn-sm btn-primary'>
                    Create New Estimate
                  </a>
                </div>
              </div>
              <KTCardBody>
                {job.estimates && job.estimates.length > 0 ? (
                  <div className='table-responsive'>
                    <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                      <thead>
                        <tr className='fw-bold text-muted'>
                          <th>Estimate #</th>
                          <th>Status</th>
                          <th>Amount</th>
                          <th>Version</th>
                          <th>Created</th>
                          <th className='text-end'>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.estimates.map((estimate) => (
                          <tr key={estimate.id}>
                            <td>
                              <a href={`/estimates`} className='text-dark fw-bold text-hover-primary'>
                                {estimate.estimate_number}
                              </a>
                            </td>
                            <td>
                              <span className={`badge badge-light-${
                                estimate.status === 'approved' ? 'success' : 
                                estimate.status === 'rejected' ? 'danger' : 
                                estimate.status === 'sent' ? 'info' : 
                                'secondary'
                              }`}>
                                {estimate.status}
                              </span>
                            </td>
                            <td>
                              <span className='text-dark fw-bold'>${estimate.total_amount.toLocaleString()}</span>
                            </td>
                            <td>
                              {estimate.version ? `v${estimate.version}` : 'v1'}
                            </td>
                            <td>
                              {new Date(estimate.created_at).toLocaleDateString()}
                            </td>
                            <td className='text-end'>
                              <a 
                                href={`/estimates`} 
                                className='btn btn-sm btn-light-primary'
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className='text-center py-10'>
                    <div className='text-muted mb-5'>No estimates have been created for this job yet.</div>
                    <a href={`/estimates?job_id=${job.id}`} className='btn btn-primary'>
                      Create First Estimate
                    </a>
                  </div>
                )}
              </KTCardBody>
            </KTCard>
          )}

          {activeTab === 'photos' && (
            <div className="card">
              <div className="card-body">
                <JobPhotoGallery 
                  jobId={job.id} 
                  showTitle={false}
                  photoTypes={['job_progress', 'before', 'after', 'general']}
                  allowCapture={true}
                  compactView={false}
                />
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="card">
              <div className="card-body">
                <JobDocuments 
                  jobId={job.id} 
                  showTitle={false}
                  allowUpload={true}
                />
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div>
              <JobActivityTimeline 
                jobId={job.id} 
                leadId={job.lead_id}
                showCustomerView={false}
                showAddNoteButton={true}
                showCompleteJourney={true}
                onAddNote={handleAddNote}
              />
              
              {/* Test button for development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-center mt-4">
                  <button
                    className="btn btn-light-warning btn-sm"
                    onClick={async () => {
                      showToast.loading('Creating test activities...')
                      await createTestActivities(job.id)
                      showToast.success('Test activities created! Refresh to see them.')
                      // Trigger refresh of activities
                      window.location.reload()
                    }}
                  >
                    <i className="ki-duotone ki-flask fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Generate Test Activities
                  </button>
                  <p className="text-muted fs-7 mt-2">
                    This button creates sample activities for testing purposes
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'inspections' && (
            <InspectionManager 
              jobId={job.id}
              jobType={job.description?.toLowerCase().includes('electrical') ? 'electrical' : 
                      job.description?.toLowerCase().includes('plumbing') ? 'plumbing' :
                      job.description?.toLowerCase().includes('hvac') ? 'hvac' : 'general_construction'}
              onInspectionUpdate={() => {
                // Refresh job data if needed
                fetchJob()
              }}
            />
          )}

          {activeTab === 'milestones' && (
            <MilestoneManager 
              jobId={job.id}
              jobValue={job.estimated_cost}
              startDate={job.start_date}
              onMilestoneUpdate={() => {
                // Refresh job data if needed
                fetchJob()
              }}
            />
          )}

          {activeTab === 'team-materials' && (
            <div className='row g-5'>
              <div className='col-xl-6'>
                <TeamAssignmentManager 
                  jobId={job.id}
                  onTeamUpdate={() => {
                    // Refresh job data if needed
                    fetchJob()
                  }}
                />
              </div>
              <div className='col-xl-6'>
                <MaterialOrderManager 
                  jobId={job.id}
                  onOrderUpdate={() => {
                    // Refresh job data if needed
                    fetchJob()
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'property' && (
            <PropertyDetails 
              address={job.location_address}
              city={job.location_city}
              state={job.location_state}
              zip={job.location_zip}
            />
          )}
        </div>
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className='modal fade show d-block' tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h3 className='modal-title'>Add Job Note</h3>
                <button
                  type='button'
                  className='btn-close'
                  onClick={() => setShowAddNoteModal(false)}
                  disabled={noteLoading}
                ></button>
              </div>
              <div className='modal-body'>
                <div className='mb-3'>
                  <label className='form-label'>Note Content</label>
                  <textarea
                    className='form-control'
                    rows={4}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder='Enter your note...'
                    disabled={noteLoading}
                  />
                </div>
                <div className='text-muted fs-7'>
                  This note will be visible to internal team members only.
                </div>
              </div>
              <div className='modal-footer'>
                <button
                  type='button'
                  className='btn btn-light'
                  onClick={() => setShowAddNoteModal(false)}
                  disabled={noteLoading}
                >
                  Cancel
                </button>
                <button
                  type='button'
                  className='btn btn-primary'
                  onClick={handleSaveNote}
                  disabled={noteLoading || !noteText.trim()}
                >
                  {noteLoading ? (
                    <>
                      <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                      Adding...
                    </>
                  ) : (
                    'Add Note'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Form Modal */}
      {showEditForm && job && (
        <JobForm
          job={{
            id: job.id,
            tenant_id: job.tenant_id,
            account_id: job.account_id,
            contact_id: job.contact_id,
            created_at: job.created_at,
            updated_at: job.updated_at,
            status: job.status || 'draft',
            priority: job.priority || 'medium',
            title: job.title,
            description: job.description,
            start_date: job.start_date,
            due_date: job.due_date,
            estimated_hours: job.estimated_hours,
            actual_hours: job.actual_hours,
            estimated_cost: job.estimated_cost,
            actual_cost: job.actual_cost,
            location_address: job.location_address,
            location_city: job.location_city,
            location_state: job.location_state,
            location_zip: job.location_zip,
            notes: job.notes,
            job_number: job.job_number
          }}
          accounts={accounts}
          contacts={contacts}
          onSave={handleUpdateJob}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </>
  )
}

export default JobDetailsPage
