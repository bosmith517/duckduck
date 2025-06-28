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

interface JobWithRelations {
  id: string
  tenant_id: string
  account_id: string
  contact_id?: string
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
  account?: {
    id: string
    name: string
  }
  contact?: {
    id: string
    first_name: string
    last_name: string
  }
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

  useEffect(() => {
    if (id && userProfile?.tenant_id) {
      fetchJob()
    }
  }, [id, userProfile?.tenant_id])

  const fetchJob = async () => {
    if (!id || !userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          account:accounts(id, name),
          contact:contacts(id, first_name, last_name)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching job:', error)
        navigate('/jobs')
        return
      }

      setJob(data)
    } catch (error) {
      console.error('Error fetching job:', error)
      navigate('/jobs')
    } finally {
      setLoading(false)
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
                <button className='btn btn-sm btn-primary'>
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

          {activeTab === 'activity' && (
            <KTCard>
              <div className='card-header'>
                <h3 className='card-title'>Activity Timeline</h3>
              </div>
              <KTCardBody>
                <div className='text-center py-10'>
                  <div className='text-muted'>
                    Activity timeline will be implemented in a future update.
                  </div>
                </div>
              </KTCardBody>
            </KTCard>
          )}
        </div>
      </div>
    </>
  )
}

export default JobDetailsPage
