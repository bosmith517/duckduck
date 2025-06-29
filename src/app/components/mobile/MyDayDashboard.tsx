import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { locationTriggerService } from '../../services/locationTriggerService'

interface TodayJob {
  id: string
  title: string
  description: string
  status: 'scheduled' | 'in_progress' | 'on_route' | 'completed' | 'paused'
  priority: 'emergency' | 'high' | 'normal' | 'low'
  scheduled_start: string
  estimated_duration: number
  customer: {
    name: string
    phone: string
    address: string
    special_instructions?: string
  }
  service_type: string
  job_number: string
  equipment?: string[]
  photos_required: boolean
  customer_signature_required: boolean
}

export const MyDayDashboard: React.FC = () => {
  const { userProfile, tenant } = useSupabaseAuth()
  const [todayJobs, setTodayJobs] = useState<TodayJob[]>([])
  const [loading, setLoading] = useState(true)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedJob, setSelectedJob] = useState<TodayJob | null>(null)
  const [showJobDetails, setShowJobDetails] = useState(false)

  useEffect(() => {
    fetchTodayJobs()
    getCurrentLocation()
  }, [userProfile?.id])

  const fetchTodayJobs = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          accounts:account_id(name),
          contacts:contact_id(first_name, last_name, phone, address)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .eq('assigned_technician_id', userProfile.id)
        .gte('scheduled_start', `${today}T00:00:00.000Z`)
        .lt('scheduled_start', `${today}T23:59:59.999Z`)
        .order('scheduled_start', { ascending: true })

      if (error) throw error

      // Transform data to match interface
      const transformedJobs = data?.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description || '',
        status: job.status,
        priority: job.priority || 'normal',
        scheduled_start: job.scheduled_start,
        estimated_duration: job.estimated_duration || 120,
        customer: {
          name: job.accounts?.name || `${job.contacts?.first_name || ''} ${job.contacts?.last_name || ''}`.trim(),
          phone: job.contacts?.phone || '',
          address: job.contacts?.address || job.service_address || '',
          special_instructions: job.special_instructions
        },
        service_type: job.service_type || 'General Service',
        job_number: job.job_number || job.id.slice(0, 8),
        equipment: job.equipment_needed ? job.equipment_needed.split(',') : [],
        photos_required: job.photos_required || false,
        customer_signature_required: job.signature_required || false
      })) || []

      setTodayJobs(transformedJobs)
    } catch (error) {
      console.error('Error fetching today jobs:', error)
      // Use sample data for demo
      setTodayJobs(generateSampleJobs())
    } finally {
      setLoading(false)
    }
  }

  const generateSampleJobs = (): TodayJob[] => {
    const now = new Date()
    return [
      {
        id: '1',
        title: 'Water Heater Replacement',
        description: 'Replace 40-gallon water heater in basement',
        status: 'scheduled',
        priority: 'normal',
        scheduled_start: new Date(now.setHours(9, 0, 0, 0)).toISOString(),
        estimated_duration: 180,
        customer: {
          name: 'John Smith',
          phone: '(555) 123-4567',
          address: '123 Main St, Springfield, IL 62701',
          special_instructions: 'Use side entrance, dog in backyard'
        },
        service_type: 'Plumbing',
        job_number: 'JOB-001',
        equipment: ['40-gal water heater', 'Copper fittings', 'Torch'],
        photos_required: true,
        customer_signature_required: true
      },
      {
        id: '2',
        title: 'HVAC Maintenance',
        description: 'Annual AC maintenance and filter replacement',
        status: 'scheduled',
        priority: 'normal',
        scheduled_start: new Date(now.setHours(13, 30, 0, 0)).toISOString(),
        estimated_duration: 90,
        customer: {
          name: 'Sarah Johnson',
          phone: '(555) 987-6543',
          address: '456 Oak Avenue, Springfield, IL 62702'
        },
        service_type: 'HVAC',
        job_number: 'JOB-002',
        equipment: ['Air filters', 'Cleaning supplies'],
        photos_required: false,
        customer_signature_required: true
      },
      {
        id: '3',
        title: 'Emergency Electrical Repair',
        description: 'Kitchen outlets not working - breaker issue',
        status: 'scheduled',
        priority: 'emergency',
        scheduled_start: new Date(now.setHours(15, 45, 0, 0)).toISOString(),
        estimated_duration: 120,
        customer: {
          name: 'Mike Wilson',
          phone: '(555) 555-0123',
          address: '789 Pine Street, Springfield, IL 62703',
          special_instructions: 'EMERGENCY - Customer without power in kitchen'
        },
        service_type: 'Electrical',
        job_number: 'JOB-003',
        equipment: ['Breaker', 'Wire nuts', 'Voltmeter'],
        photos_required: true,
        customer_signature_required: true
      }
    ]
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.warn('Location access denied:', error)
        }
      )
    }
  }

  const updateJobStatus = async (jobId: string, newStatus: TodayJob['status']) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (error) throw error

      // Update local state
      setTodayJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ))

      // Create status update log
      await supabase
        .from('job_status_updates')
        .insert({
          job_id: jobId,
          technician_id: userProfile?.id,
          status: newStatus,
          timestamp: new Date().toISOString(),
          location: currentLocation
        })

      // Handle location tracking based on status
      if (newStatus === 'on_route') {
        // Start location tracking when technician is en route
        locationTriggerService.startLocationTracking(jobId)
        alert('🚨 Location tracking started! Customers will be notified when you\'re nearby.')
      } else if (newStatus === 'completed' || newStatus === 'cancelled') {
        // Stop location tracking when job is done
        locationTriggerService.stopLocationTracking()
      }

      // The database trigger will automatically send customer notifications

    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Failed to update job status')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'info'
      case 'on_route': return 'warning'
      case 'in_progress': return 'primary'
      case 'completed': return 'success'
      case 'paused': return 'secondary'
      default: return 'light'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'danger'
      case 'high': return 'warning'
      case 'normal': return 'primary'
      case 'low': return 'secondary'
      default: return 'light'
    }
  }

  const openDirections = (address: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const encodedAddress = encodeURIComponent(address)
    
    if (isIOS) {
      window.open(`maps://maps.google.com/maps?daddr=${encodedAddress}`, '_system')
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank')
    }
  }

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`)
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted">Loading your schedule...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid p-0">
      {/* Header */}
      <div className="bg-primary text-white p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="mb-1">My Day</h3>
            <div className="text-white-50">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
          <div className="text-end">
            <div className="h4 mb-0">{todayJobs.length}</div>
            <div className="text-white-50 small">Jobs Today</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="row g-3 mb-4 px-3">
        <div className="col-3">
          <div className="bg-info text-white rounded p-3 text-center">
            <div className="h5 mb-0">{todayJobs.filter(j => j.status === 'scheduled').length}</div>
            <div className="small">Scheduled</div>
          </div>
        </div>
        <div className="col-3">
          <div className="bg-warning text-white rounded p-3 text-center">
            <div className="h5 mb-0">{todayJobs.filter(j => j.status === 'in_progress').length}</div>
            <div className="small">In Progress</div>
          </div>
        </div>
        <div className="col-3">
          <div className="bg-success text-white rounded p-3 text-center">
            <div className="h5 mb-0">{todayJobs.filter(j => j.status === 'completed').length}</div>
            <div className="small">Completed</div>
          </div>
        </div>
        <div className="col-3">
          <div className="bg-danger text-white rounded p-3 text-center">
            <div className="h5 mb-0">{todayJobs.filter(j => j.priority === 'emergency').length}</div>
            <div className="small">Emergency</div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="px-3">
        {todayJobs.length === 0 ? (
          <div className="text-center py-5">
            <KTIcon iconName="calendar" className="fs-2x text-muted mb-3" />
            <h5 className="text-muted">No jobs scheduled for today</h5>
            <p className="text-muted">Enjoy your day off!</p>
          </div>
        ) : (
          todayJobs.map(job => (
            <div key={job.id} className="card mb-3 shadow-sm">
              <div className="card-body p-3">
                {/* Job Header */}
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center mb-1">
                      <span className={`badge badge-${getPriorityColor(job.priority)} me-2`}>
                        {job.priority.toUpperCase()}
                      </span>
                      <span className="text-muted small">{job.job_number}</span>
                    </div>
                    <h6 className="mb-1">{job.title}</h6>
                    <div className="text-muted small mb-2">{job.service_type}</div>
                    <div className="text-primary fw-bold">
                      {new Date(job.scheduled_start).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })} ({job.estimated_duration}min)
                    </div>
                  </div>
                  <span className={`badge badge-${getStatusColor(job.status)}`}>
                    {job.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="bg-light rounded p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-bold">{job.customer.name}</div>
                    <button 
                      className="btn btn-sm btn-light-primary"
                      onClick={() => callCustomer(job.customer.phone)}
                    >
                      <KTIcon iconName="phone" className="fs-6" />
                    </button>
                  </div>
                  <div className="small text-muted mb-2">{job.customer.phone}</div>
                  <div className="small mb-2">
                    <KTIcon iconName="geolocation" className="fs-6 me-1" />
                    {job.customer.address}
                  </div>
                  {job.customer.special_instructions && (
                    <div className="alert alert-warning py-2 px-3 mb-0 small">
                      <strong>Special Instructions:</strong> {job.customer.special_instructions}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="row g-2 mb-3">
                  <div className="col-4">
                    <button 
                      className="btn btn-light-primary btn-sm w-100"
                      onClick={() => openDirections(job.customer.address)}
                    >
                      <KTIcon iconName="geolocation" className="fs-6 me-1" />
                      Directions
                    </button>
                  </div>
                  <div className="col-4">
                    <button 
                      className="btn btn-light-info btn-sm w-100"
                      onClick={() => {
                        setSelectedJob(job)
                        setShowJobDetails(true)
                      }}
                    >
                      <KTIcon iconName="eye" className="fs-6 me-1" />
                      Details
                    </button>
                  </div>
                  <div className="col-4">
                    <button className="btn btn-light-success btn-sm w-100">
                      <KTIcon iconName="camera" className="fs-6 me-1" />
                      Photo
                    </button>
                  </div>
                </div>

                {/* Status Update Buttons */}
                <div className="d-flex gap-2">
                  {job.status === 'scheduled' && (
                    <button 
                      className="btn btn-warning btn-sm flex-fill"
                      onClick={() => updateJobStatus(job.id, 'on_route')}
                    >
                      On My Way
                    </button>
                  )}
                  {job.status === 'on_route' && (
                    <button 
                      className="btn btn-primary btn-sm flex-fill"
                      onClick={() => updateJobStatus(job.id, 'in_progress')}
                    >
                      Start Job
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateJobStatus(job.id, 'paused')}
                      >
                        Pause
                      </button>
                      <button 
                        className="btn btn-success btn-sm flex-fill"
                        onClick={() => updateJobStatus(job.id, 'completed')}
                      >
                        Complete
                      </button>
                    </>
                  )}
                  {job.status === 'paused' && (
                    <button 
                      className="btn btn-primary btn-sm flex-fill"
                      onClick={() => updateJobStatus(job.id, 'in_progress')}
                    >
                      Resume
                    </button>
                  )}
                  {job.status === 'completed' && (
                    <div className="alert alert-success py-2 px-3 mb-0 flex-fill text-center">
                      <KTIcon iconName="check-circle" className="fs-6 me-1" />
                      Job Completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Job Details Modal */}
      {showJobDetails && selectedJob && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedJob.title}</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowJobDetails(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <strong>Description:</strong>
                  <div className="text-muted">{selectedJob.description}</div>
                </div>
                
                {selectedJob.equipment && selectedJob.equipment.length > 0 && (
                  <div className="mb-3">
                    <strong>Equipment Needed:</strong>
                    <ul className="mb-0">
                      {selectedJob.equipment.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="row">
                  <div className="col-6">
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        checked={selectedJob.photos_required}
                        disabled
                      />
                      <label className="form-check-label">Photos Required</label>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        checked={selectedJob.customer_signature_required}
                        disabled
                      />
                      <label className="form-check-label">Signature Required</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowJobDetails(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyDayDashboard