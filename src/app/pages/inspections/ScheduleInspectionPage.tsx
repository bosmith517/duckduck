import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { InspectionService, JobInspection } from '../../services/inspectionService'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface Job {
  id: string
  title: string
  account?: { name: string }
  location_address: string
  job_number: string
  status: string
}

const ScheduleInspectionPage: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [pendingInspections, setPendingInspections] = useState<JobInspection[]>([])
  const [selectedInspection, setSelectedInspection] = useState<JobInspection | null>(null)
  const [loading, setLoading] = useState(false)
  const [schedulingData, setSchedulingData] = useState({
    scheduled_date: '',
    inspector_name: '',
    inspector_contact: '',
    notes: ''
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadActiveJobs()
    }
  }, [userProfile?.tenant_id])

  useEffect(() => {
    if (selectedJob) {
      loadPendingInspections(selectedJob)
    }
  }, [selectedJob])

  const loadActiveJobs = async () => {
    if (!userProfile?.tenant_id) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          job_number,
          status,
          location_address,
          account:accounts(name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['in_progress', 'scheduled'])
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform the data to match the expected structure
      const transformedData = (data || []).map((job: any) => ({
        ...job,
        account: Array.isArray(job.account) ? job.account[0] : job.account
      }))
      
      setJobs(transformedData)
    } catch (error) {
      console.error('Error loading jobs:', error)
      showToast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingInspections = async (jobId: string) => {
    try {
      const inspections = await InspectionService.getInspectionsForJob(jobId)
      setPendingInspections(inspections.filter(i => i.status === 'pending'))
    } catch (error) {
      console.error('Error loading inspections:', error)
      showToast.error('Failed to load inspections for this job')
    }
  }

  const handleScheduleInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedInspection) {
      showToast.error('Please select an inspection to schedule')
      return
    }

    try {
      setLoading(true)
      await InspectionService.scheduleInspection(selectedInspection.id, schedulingData)
      showToast.success('Inspection scheduled successfully')
      
      // Reset form
      setSchedulingData({
        scheduled_date: '',
        inspector_name: '',
        inspector_contact: '',
        notes: ''
      })
      setSelectedInspection(null)
      
      // Reload inspections
      loadPendingInspections(selectedJob)
    } catch (error) {
      console.error('Error scheduling inspection:', error)
      showToast.error('Failed to schedule inspection')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInspections = async () => {
    if (!selectedJob) {
      showToast.error('Please select a job first')
      return
    }

    try {
      setLoading(true)
      // Determine job type - could be enhanced to get from job data
      const jobType = 'general_construction' // Default
      await InspectionService.createInspectionsForJob(selectedJob, jobType)
      showToast.success('Inspections created for job')
      loadPendingInspections(selectedJob)
    } catch (error: any) {
      console.error('Error creating inspections:', error)
      if (error.message?.includes('already exist')) {
        showToast.error('Inspections already exist for this job')
      } else {
        showToast.error('Failed to create inspections')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Schedule Inspection</PageTitle>

      <div className='row g-5'>
        {/* Job Selection */}
        <div className='col-lg-6'>
          <KTCard>
            <div className='card-header'>
              <h3 className='card-title'>Select Job</h3>
            </div>
            <KTCardBody>
              <div className='mb-5'>
                <label className='form-label fw-bold'>Active Jobs</label>
                <select
                  className='form-select form-select-solid'
                  value={selectedJob}
                  onChange={(e) => setSelectedJob(e.target.value)}
                  disabled={loading}
                >
                  <option value=''>Select a job...</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.title} ({job.account?.name || job.location_address})
                    </option>
                  ))}
                </select>
              </div>

              {selectedJob && pendingInspections.length === 0 && (
                <div className='alert alert-warning'>
                  <div className='alert-text'>
                    No pending inspections found for this job.
                  </div>
                  <button
                    className='btn btn-sm btn-warning mt-3'
                    onClick={handleCreateInspections}
                    disabled={loading}
                  >
                    Create Inspection Requirements
                  </button>
                </div>
              )}

              {pendingInspections.length > 0 && (
                <div>
                  <h5 className='mb-4'>Pending Inspections</h5>
                  <div className='row g-3'>
                    {pendingInspections.map(inspection => (
                      <div key={inspection.id} className='col-12'>
                        <div
                          className={`card cursor-pointer ${selectedInspection?.id === inspection.id ? 'border-primary' : ''}`}
                          onClick={() => setSelectedInspection(inspection)}
                        >
                          <div className='card-body p-4'>
                            <div className='d-flex align-items-center'>
                              <div className='flex-grow-1'>
                                <h6 className='mb-1'>
                                  {inspection.trade} - {inspection.phase} Phase
                                </h6>
                                <div className='text-muted fs-7'>
                                  Type: {inspection.inspection_type}
                                  {inspection.required && (
                                    <span className='badge badge-light-danger ms-2'>Required</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                {selectedInspection?.id === inspection.id && (
                                  <i className='ki-duotone ki-check-circle fs-2x text-primary'>
                                    <span className='path1'></span>
                                    <span className='path2'></span>
                                  </i>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>

        {/* Schedule Form */}
        <div className='col-lg-6'>
          <KTCard>
            <div className='card-header'>
              <h3 className='card-title'>Schedule Details</h3>
            </div>
            <KTCardBody>
              {selectedInspection ? (
                <form onSubmit={handleScheduleInspection}>
                  <div className='mb-5'>
                    <div className='bg-light-primary rounded p-4 mb-5'>
                      <h5 className='mb-2'>Selected Inspection</h5>
                      <div className='text-gray-700'>
                        <strong>{selectedInspection.trade}</strong> - {selectedInspection.phase} Phase
                        <br />
                        Type: {selectedInspection.inspection_type}
                      </div>
                    </div>

                    <div className='mb-5'>
                      <label className='form-label required'>Inspection Date & Time</label>
                      <input
                        type='datetime-local'
                        className='form-control form-control-solid'
                        value={schedulingData.scheduled_date}
                        onChange={(e) => setSchedulingData({...schedulingData, scheduled_date: e.target.value})}
                        min={new Date().toISOString().slice(0, 16)}
                        required
                      />
                    </div>

                    <div className='mb-5'>
                      <label className='form-label required'>Inspector Name</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Enter inspector name'
                        value={schedulingData.inspector_name}
                        onChange={(e) => setSchedulingData({...schedulingData, inspector_name: e.target.value})}
                        required
                      />
                    </div>

                    <div className='mb-5'>
                      <label className='form-label'>Inspector Contact</label>
                      <input
                        type='text'
                        className='form-control form-control-solid'
                        placeholder='Phone or email'
                        value={schedulingData.inspector_contact}
                        onChange={(e) => setSchedulingData({...schedulingData, inspector_contact: e.target.value})}
                      />
                    </div>

                    <div className='mb-5'>
                      <label className='form-label'>Notes</label>
                      <textarea
                        className='form-control form-control-solid'
                        rows={4}
                        placeholder='Any special instructions or requirements...'
                        value={schedulingData.notes}
                        onChange={(e) => setSchedulingData({...schedulingData, notes: e.target.value})}
                      />
                    </div>

                    {selectedInspection.prerequisites.length > 0 && (
                      <div className='alert alert-info mb-5'>
                        <h5 className='alert-heading fs-6'>Prerequisites</h5>
                        <ul className='mb-0'>
                          {selectedInspection.prerequisites.map((prereq, index) => (
                            <li key={index}>{prereq.replace(/_/g, ' ')}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className='d-flex justify-content-end gap-3'>
                    <button
                      type='button'
                      className='btn btn-light'
                      onClick={() => {
                        setSelectedInspection(null)
                        setSchedulingData({
                          scheduled_date: '',
                          inspector_name: '',
                          inspector_contact: '',
                          notes: ''
                        })
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='btn btn-primary'
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className='spinner-border spinner-border-sm me-2'></span>
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <i className='ki-duotone ki-calendar-add fs-2 me-2'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                          Schedule Inspection
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className='text-center py-10'>
                  <i className='ki-duotone ki-calendar fs-5x text-muted mb-5'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <p className='text-muted'>
                    Select a job and inspection to schedule
                  </p>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

export default ScheduleInspectionPage