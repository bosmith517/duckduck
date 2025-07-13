import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { supabase, Job, Account, Contact } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface Technician {
  id: string
  name: string
  email: string
  phone?: string
  skills: string[]
  availability: 'available' | 'busy' | 'offline'
  currentLocation?: {
    lat: number
    lng: number
    address: string
  }
  currentJob?: Job
}

interface DispatchAssignment {
  id: string
  jobId: string
  technicianId: string
  assignedAt: string
  estimatedArrival?: string
  status: 'assigned' | 'en_route' | 'on_site' | 'completed'
}

const DispatchPage: React.FC = () => {
  const { currentUser, userProfile } = useSupabaseAuth()
  const [unassignedJobs, setUnassignedJobs] = useState<Job[]>([])
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([])
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)

  // Mock technicians for demo - in real implementation, fetch from user_profiles
  const mockTechnicians: Technician[] = [
    {
      id: 'tech-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '(555) 123-4567',
      skills: ['HVAC', 'Electrical', 'Plumbing'],
      availability: 'available',
      currentLocation: {
        lat: 39.7817,
        lng: -89.6501,
        address: 'Springfield, IL'
      }
    },
    {
      id: 'tech-2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '(555) 234-5678',
      skills: ['Plumbing', 'General Repair'],
      availability: 'available',
      currentLocation: {
        lat: 39.7900,
        lng: -89.6400,
        address: 'North Springfield, IL'
      }
    },
    {
      id: 'tech-3',
      name: 'Mike Wilson',
      email: 'mike@example.com',
      phone: '(555) 345-6789',
      skills: ['HVAC', 'Electrical'],
      availability: 'busy',
      currentLocation: {
        lat: 39.7750,
        lng: -89.6600,
        address: 'South Springfield, IL'
      }
    }
  ]

  // Fetch unassigned jobs
  const fetchUnassignedJobs = async () => {
    if (!userProfile?.tenant_id) return

    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          *,
          account:accounts(*),
          contact:contacts(*)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['Scheduled', 'Pending', 'Confirmed'])
        .order('start_date', { ascending: true })

      if (error) {
        console.error('Error fetching jobs:', error)
        return
      }

      setUnassignedJobs(jobs || [])
    } catch (err) {
      console.error('Error in fetchUnassignedJobs:', err)
    }
  }

  // Load data on component mount and set up real-time subscriptions
  useEffect(() => {
    if (currentUser) {
      fetchUnassignedJobs()
      setAvailableTechnicians(mockTechnicians)
      setLoading(false)
      
      // Set up real-time subscription for job updates
      const jobsSubscription = supabase
        .channel('dispatch_jobs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `tenant_id=eq.${userProfile?.tenant_id || ''}`
          },
          (payload) => {
            console.log('Job updated in dispatch:', payload)
            fetchUnassignedJobs()
          }
        )
        .subscribe()
      
      // Set up real-time subscription for job status updates
      const statusSubscription = supabase
        .channel('dispatch_status_updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'job_status_updates'
          },
          (payload) => {
            console.log('Job status updated:', payload)
            // Update technician availability based on status changes
            updateTechnicianAvailability(payload.new)
          }
        )
        .subscribe()
      
      // Cleanup subscriptions
      return () => {
        jobsSubscription.unsubscribe()
        statusSubscription.unsubscribe()
      }
    }
  }, [currentUser])
  
  // Update technician availability based on job status changes
  const updateTechnicianAvailability = (statusUpdate: any) => {
    setAvailableTechnicians(prev => 
      prev.map(tech => {
        if (tech.id === statusUpdate.technician_id) {
          // If job completed, mark technician as available
          if (statusUpdate.new_status === 'Completed') {
            return { ...tech, availability: 'available' as const, currentJob: undefined }
          }
          // If job in progress, mark as busy
          else if (['In Progress', 'On Route', 'Assigned'].includes(statusUpdate.new_status)) {
            return { ...tech, availability: 'busy' as const }
          }
        }
        return tech
      })
    )
  }

  const handleAssignJob = (job: Job) => {
    setSelectedJob(job)
    setShowAssignmentModal(true)
  }

  const handleConfirmAssignment = async (technicianId: string) => {
    if (!selectedJob || !userProfile?.tenant_id) return

    try {
      const technician = availableTechnicians.find(t => t.id === technicianId)
      if (!technician) {
        alert('Technician not found')
        return
      }
      
      // Update job with assignment details
      const { error: jobError } = await supabase
        .from('jobs')
        .update({ 
          status: 'Assigned',
          assigned_technician_id: technicianId,
          assigned_at: new Date().toISOString(),
          notes: `${selectedJob.notes || ''}\n\nAssigned to: ${technician.name} (${technician.email})\nAssigned on: ${new Date().toLocaleString()}\nSkills: ${technician.skills.join(', ')}`
        })
        .eq('id', selectedJob.id)
        .eq('tenant_id', userProfile.tenant_id)

      if (jobError) {
        console.error('Error assigning job:', jobError)
        alert('Failed to assign job: ' + jobError.message)
        return
      }

      // Create status update log
      await supabase
        .from('job_status_updates')
        .insert({
          job_id: selectedJob.id,
          technician_id: technicianId,
          old_status: selectedJob.status,
          new_status: 'Assigned',
          status_notes: `Job assigned via dispatch center to ${technician.name}`,
          updated_at: new Date().toISOString()
        })

      // Create assignment record
      const newAssignment: DispatchAssignment = {
        id: `assign-${Date.now()}`,
        jobId: selectedJob.id,
        technicianId,
        assignedAt: new Date().toISOString(),
        status: 'assigned'
      }

      setAssignments(prev => [...prev, newAssignment])

      // Update technician availability locally for immediate feedback
      setAvailableTechnicians(prev => 
        prev.map(tech => 
          tech.id === technicianId 
            ? { ...tech, availability: 'busy' as const, currentJob: selectedJob }
            : tech
        )
      )

      // Remove from unassigned jobs locally
      setUnassignedJobs(prev => prev.filter(job => job.id !== selectedJob.id))

      setShowAssignmentModal(false)
      setSelectedJob(null)

      // Show success with details
      alert(`✅ Job assigned successfully!\n\nJob: ${selectedJob.title}\nTechnician: ${technician.name}\nPriority: ${selectedJob.priority?.toUpperCase()}\n\nThe technician will be notified automatically.`)
      
      // TODO: Send notification to technician (via email/SMS/push notification)
      console.log('TODO: Send notification to technician:', {
        technicianId,
        technicianEmail: technician.email,
        technicianPhone: technician.phone,
        jobDetails: selectedJob
      })
      
    } catch (err) {
      console.error('Error confirming assignment:', err)
      alert('Failed to assign job. Please try again.')
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'badge-light-danger'
      case 'medium':
        return 'badge-light-warning'
      case 'low':
        return 'badge-light-success'
      default:
        return 'badge-light-info'
    }
  }

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'available':
        return 'badge-light-success'
      case 'busy':
        return 'badge-light-warning'
      case 'offline':
        return 'badge-light-danger'
      default:
        return 'badge-light-info'
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[
        {title: 'Scheduling & Dispatch', path: '/schedule', isActive: false, isSeparator: false},
        {title: 'Dispatch Center', path: '/tracking/dispatch', isActive: true, isSeparator: true}
      ]}>
        Technician Dispatch
      </PageTitle>
      
      {/* Real-time Status Indicators */}
      <div className='alert alert-info d-flex align-items-center mb-5'>
        <div className='d-flex flex-column flex-grow-1'>
          <div className='d-flex align-items-center'>
            <i className='ki-duotone ki-pulse fs-2x text-info me-3'>
              <span className='path1'></span>
              <span className='path2'></span>
            </i>
            <div>
              <h6 className='mb-1'>Live Dispatch Center</h6>
              <span className='text-muted fs-7'>Real-time job and technician updates • Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        <div className='d-flex align-items-center gap-3'>
          <div className='d-flex align-items-center'>
            <div className='bullet bullet-dot bg-success me-2'></div>
            <span className='text-muted fs-8'>{availableTechnicians.filter(t => t.availability === 'available').length} Available</span>
          </div>
          <div className='d-flex align-items-center'>
            <div className='bullet bullet-dot bg-warning me-2'></div>
            <span className='text-muted fs-8'>{availableTechnicians.filter(t => t.availability === 'busy').length} Busy</span>
          </div>
          <div className='d-flex align-items-center'>
            <div className='bullet bullet-dot bg-danger me-2'></div>
            <span className='text-muted fs-8'>{unassignedJobs.filter(j => j.priority === 'high' || j.priority === 'emergency').length} Urgent</span>
          </div>
        </div>
      </div>
      
      <div className='row g-5 g-xl-8'>
        {/* Unassigned Jobs */}
        <div className='col-lg-6'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Unassigned Jobs</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>{unassignedJobs.length} jobs waiting for assignment</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              {loading ? (
                <div className='text-center py-5'>
                  <div className='spinner-border text-primary' role='status'>
                    <span className='visually-hidden'>Loading...</span>
                  </div>
                </div>
              ) : unassignedJobs.length === 0 ? (
                <div className='text-center py-5'>
                  <i className='ki-duotone ki-check-circle fs-5x text-success mb-3'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  <h4 className='text-gray-800 mb-3'>All Jobs Assigned!</h4>
                  <p className='text-muted'>No unassigned jobs at the moment.</p>
                </div>
              ) : (
                <div className='d-flex flex-column gap-3'>
                  {unassignedJobs.map((job) => (
                    <div key={job.id} className='card border border-warning'>
                      <div className='card-body p-4'>
                        <div className='d-flex align-items-center justify-content-between mb-3'>
                          <div>
                            <div className='fw-bold text-dark'>{job.title}</div>
                            <div className='text-muted fs-7'>
                              {job.account?.name || 
                               (job.contact ? (
                                 job.contact.name || 
                                 `${job.contact.first_name || ''} ${job.contact.last_name || ''}`.trim()
                               ) : '') || 
                               'Unknown Client'} - {job.job_number}
                            </div>
                            <span className={`badge ${getPriorityBadge(job.priority)} fs-8`}>
                              {job.priority?.toUpperCase() || 'MEDIUM'}
                            </span>
                          </div>
                          <button 
                            className='btn btn-sm btn-primary'
                            onClick={() => handleAssignJob(job)}
                          >
                            <i className='ki-duotone ki-user-tick fs-2'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                              <span className='path3'></span>
                            </i>
                            Assign
                          </button>
                        </div>
                        
                        <div className='d-flex flex-column gap-2'>
                          {job.start_date && (
                            <div className='text-muted fs-7'>
                              <i className='ki-duotone ki-calendar fs-6 me-1'></i>
                              {new Date(job.start_date).toLocaleDateString()} at {new Date(job.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          )}
                          
                          {job.location_address && (
                            <div className='text-muted fs-7'>
                              <i className='ki-duotone ki-geolocation fs-6 me-1'></i>
                              {[job.location_address, job.location_city, job.location_state].filter(Boolean).join(', ')}
                            </div>
                          )}
                          
                          {job.estimated_hours && (
                            <div className='text-muted fs-7'>
                              <i className='ki-duotone ki-time fs-6 me-1'></i>
                              Estimated: {job.estimated_hours} hours
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>

        {/* Available Technicians */}
        <div className='col-lg-6'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Available Technicians</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>{availableTechnicians.filter(t => t.availability === 'available').length} available now</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='d-flex flex-column gap-3'>
                {availableTechnicians.map((technician) => (
                  <div key={technician.id} className={`card border ${technician.availability === 'available' ? 'border-success' : 'border-warning'}`}>
                    <div className='card-body p-4'>
                      <div className='d-flex align-items-center justify-content-between'>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-45px me-3'>
                            <span className='symbol-label bg-light-primary text-primary fw-bold'>
                              {technician.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <div className='fw-bold text-dark'>{technician.name}</div>
                            <div className='text-muted fs-7'>{technician.email}</div>
                            <span className={`badge ${getAvailabilityBadge(technician.availability)} fs-8`}>
                              {technician.availability.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className='text-end'>
                          <div className='text-dark fw-bold fs-6'>Skills:</div>
                          <div className='text-muted fs-7'>{technician.skills.join(', ')}</div>
                          {technician.currentLocation && (
                            <div className='text-muted fs-7 mt-1'>
                              <i className='ki-duotone ki-geolocation fs-6 me-1'></i>
                              {technician.currentLocation.address}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {technician.currentJob && (
                        <div className='mt-3 p-3 bg-light rounded'>
                          <div className='text-dark fw-bold fs-7'>Current Job:</div>
                          <div className='text-muted fs-8'>{technician.currentJob.title}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignmentModal && selectedJob && (
        <div className='modal fade show d-block' style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className='modal-dialog modal-lg'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Assign Job: {selectedJob.title}</h5>
                <button 
                  type='button' 
                  className='btn-close' 
                  onClick={() => setShowAssignmentModal(false)}
                ></button>
              </div>
              <div className='modal-body'>
                <div className='mb-4'>
                  <h6>Job Details:</h6>
                  <div className='text-muted'>
                    <div>Client: {selectedJob.account?.name || 'Unknown'}</div>
                    <div>Location: {[selectedJob.location_address, selectedJob.location_city].filter(Boolean).join(', ')}</div>
                    <div>Priority: {selectedJob.priority}</div>
                    {selectedJob.start_date && (
                      <div>Scheduled: {new Date(selectedJob.start_date).toLocaleDateString()} at {new Date(selectedJob.start_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    )}
                  </div>
                </div>
                
                <h6>Available Technicians:</h6>
                <div className='d-flex flex-column gap-3'>
                  {availableTechnicians
                    .filter(tech => tech.availability === 'available')
                    .map((technician) => (
                    <div 
                      key={technician.id} 
                      className='card border border-primary cursor-pointer'
                      onClick={() => handleConfirmAssignment(technician.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className='card-body p-3'>
                        <div className='d-flex align-items-center justify-content-between'>
                          <div>
                            <div className='fw-bold text-dark'>{technician.name}</div>
                            <div className='text-muted fs-7'>Skills: {technician.skills.join(', ')}</div>
                            {technician.currentLocation && (
                              <div className='text-muted fs-7'>Location: {technician.currentLocation.address}</div>
                            )}
                          </div>
                          <button className='btn btn-sm btn-primary'>
                            Select
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {availableTechnicians.filter(tech => tech.availability === 'available').length === 0 && (
                  <div className='text-center py-3'>
                    <div className='text-muted'>No technicians currently available</div>
                  </div>
                )}
              </div>
              <div className='modal-footer'>
                <button 
                  type='button' 
                  className='btn btn-light' 
                  onClick={() => setShowAssignmentModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DispatchPage