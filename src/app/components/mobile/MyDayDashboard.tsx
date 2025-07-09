import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { locationTriggerService } from '../../services/locationTriggerService'
import PhotoCapture from '../shared/PhotoCapture'

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
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [photoJobId, setPhotoJobId] = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking')
  const [showLocationPrompt, setShowLocationPrompt] = useState(false)

  // Check location permission status
  useEffect(() => {
    const checkLocationPermission = async () => {
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' })
          setLocationPermissionStatus(result.state as any)
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setLocationPermissionStatus(result.state as any)
            if (result.state === 'granted') {
              getCurrentLocation()
            }
          })
          
          // If permission is already granted, get location
          if (result.state === 'granted') {
            getCurrentLocation()
          } else if (result.state === 'prompt') {
            // Show our custom prompt after a short delay
            setTimeout(() => setShowLocationPrompt(true), 1000)
          }
        } catch (error) {
          console.warn('Error checking permissions:', error)
          // Try to get location anyway
          setShowLocationPrompt(true)
        }
      } else {
        // Browser doesn't support permissions API, show prompt
        setShowLocationPrompt(true)
      }
    }
    
    checkLocationPermission()
  }, [])

  useEffect(() => {
    if (userProfile?.id) {
      fetchTodayJobs()
    }
  }, [userProfile?.id])
  
  // Set up location tracking for active jobs
  useEffect(() => {
    // Only set up tracking if we have location permission
    if (locationPermissionStatus !== 'granted') return
    
    const hasActiveJobs = todayJobs.some(job => 
      job.status === 'on_route' || job.status === 'in_progress'
    )
    
    if (hasActiveJobs && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => console.warn('Location watch error:', error),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      )
      
      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [todayJobs.length, locationPermissionStatus])

  const fetchTodayJobs = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          account:accounts(name, phone, email),
          contact:contacts(first_name, last_name, phone)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .gte('start_date', `${today}T00:00:00.000Z`)
        .lt('start_date', `${today}T23:59:59.999Z`)
        .order('start_date', { ascending: true })

      if (error) throw error

      // Transform data to match interface
      const transformedJobs = data?.map(job => {
        const customerName = job.account?.name || `${job.contact?.first_name || ''} ${job.contact?.last_name || ''}`.trim() || 'Unknown Customer'
        const customerPhone = job.contact?.phone || job.account?.phone || ''
        const customerAddress = [job.location_address, job.location_city, job.location_state].filter(Boolean).join(', ') || 'Address TBD'
        
        return {
          id: job.id,
          title: job.title || 'Untitled Job',
          description: job.description || '',
          status: mapJobStatusToDisplayStatus(job.status),
          priority: mapJobPriorityToDisplayPriority(job.priority),
          scheduled_start: job.start_date || new Date().toISOString(),
          estimated_duration: job.estimated_hours ? job.estimated_hours * 60 : 120,
          customer: {
            name: customerName,
            phone: customerPhone,
            address: customerAddress,
            special_instructions: job.notes
          },
          service_type: 'Service',
          job_number: job.job_number || `JOB-${job.id.slice(0, 8)}`,
          equipment: [],
          photos_required: true,
          customer_signature_required: true
        }
      }) || []

      setTodayJobs(transformedJobs)
      
      // Set up real-time subscription for job updates
      const subscription = supabase
        .channel('technician_jobs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `tenant_id=eq.${userProfile.tenant_id}`
          },
          (payload) => {
            console.log('Job updated:', payload)
            // Refresh jobs when changes occur
            fetchTodayJobs()
          }
        )
        .subscribe()
      
      // Cleanup subscription when component unmounts
      return () => {
        subscription.unsubscribe()
      }
    } catch (error) {
      console.error('Error fetching today jobs:', error)
      // Use sample data for demo
      setTodayJobs(generateSampleJobs())
    } finally {
      setLoading(false)
    }
  }
  
  // Helper function to map job status to display status
  const mapJobStatusToDisplayStatus = (status: string): TodayJob['status'] => {
    switch (status?.toLowerCase()) {
      case 'scheduled':
      case 'pending':
      case 'confirmed':
        return 'scheduled'
      case 'on_route':
      case 'on_the_way':
      case 'en_route':
        return 'on_route'
      case 'in progress':
      case 'in_progress':
      case 'active':
      case 'work_in_progress':
        return 'in_progress'
      case 'completed':
      case 'finished':
      case 'done':
        return 'completed'
      case 'paused':
      case 'on_hold':
        return 'paused'
      default:
        return 'scheduled'
    }
  }
  
  // Helper function to map job priority to display priority
  const mapJobPriorityToDisplayPriority = (priority: string): TodayJob['priority'] => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'high'
      case 'emergency':
      case 'critical':
        return 'emergency'
      case 'low':
        return 'low'
      case 'medium':
      case 'normal':
      default:
        return 'normal'
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
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setCurrentLocation(location)
          
          // Store in localStorage for persistence
          localStorage.setItem('lastKnownLocation', JSON.stringify({
            ...location,
            timestamp: new Date().toISOString()
          }))
          
          // Update location permission status
          setLocationPermissionStatus('granted')
        },
        (error) => {
          console.warn('Location error:', error)
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionStatus('denied')
            setShowLocationPrompt(false)
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            alert('Location information is unavailable. Please check your device settings.')
          } else if (error.code === error.TIMEOUT) {
            alert('Location request timed out. Please try again.')
          }
          
          // Try to use last known location
          const lastLocation = localStorage.getItem('lastKnownLocation')
          if (lastLocation) {
            const parsed = JSON.parse(lastLocation)
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
            if (new Date(parsed.timestamp) > hourAgo) {
              setCurrentLocation({ lat: parsed.lat, lng: parsed.lng })
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      alert('Geolocation is not supported by your device')
    }
  }

  const updateJobStatus = async (jobId: string, newStatus: TodayJob['status']) => {
    if (!userProfile?.id) {
      alert('User not authenticated')
      return
    }
    
    try {
      // Map display status back to database status
      const dbStatus = mapDisplayStatusToDbStatus(newStatus)
      
      const updateData: any = {
        status: dbStatus,
        updated_at: new Date().toISOString()
      }
      
      // Add timestamp fields based on status
      if (newStatus === 'on_route') {
        updateData.started_travel_at = new Date().toISOString()
      } else if (newStatus === 'in_progress') {
        updateData.started_work_at = new Date().toISOString()
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        .eq('tenant_id', userProfile.tenant_id)

      if (error) throw error

      // Update local state immediately for better UX
      setTodayJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      ))

      // Create status update log
      const statusLogData = {
        job_id: jobId,
        technician_id: userProfile.id,
        old_status: 'previous', // Could get this from current state
        new_status: dbStatus,
        updated_at: new Date().toISOString()
      }
      
      if (currentLocation) {
        (statusLogData as any).location_latitude = +currentLocation.lat;
        (statusLogData as any).location_longitude = +currentLocation.lng;
      }
      
      await supabase
        .from('job_status_updates')
        .insert(statusLogData)

      // Handle location tracking and notifications based on status
      if (newStatus === 'on_route') {
        // Start location tracking when technician is en route
        try {
          locationTriggerService.startLocationTracking(jobId)
          alert('🚨 Location tracking started! Customer will be notified of your progress.')
        } catch (trackingError) {
          console.warn('Location tracking failed:', trackingError)
          alert('Job status updated, but location tracking could not be started.')
        }
      } else if (newStatus === 'completed') {
        // Stop location tracking when job is done
        locationTriggerService.stopLocationTracking()
        alert('✅ Job completed! Great work!')
      } else if (newStatus === 'in_progress') {
        alert('🔧 Job started! Remember to take photos as you work.')
      }

    } catch (error) {
      console.error('Error updating job status:', error)
      alert('Failed to update job status. Please try again.')
    }
  }
  
  // Helper function to map display status back to database status
  const mapDisplayStatusToDbStatus = (displayStatus: TodayJob['status']): string => {
    switch (displayStatus) {
      case 'scheduled':
        return 'Scheduled'
      case 'on_route':
        return 'On Route'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'paused':
        return 'Paused'
      default:
        return 'Scheduled'
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
    <div className="container-fluid p-0" style={{ paddingBottom: '80px' }}>
      {/* Location Permission Prompt */}
      {showLocationPrompt && locationPermissionStatus !== 'granted' && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center" style={{ zIndex: 1050 }}>
          <div className="bg-white rounded-3 p-4 mx-3" style={{ maxWidth: '400px' }}>
            <div className="text-center mb-4">
              <i className="bi bi-geo-alt-fill text-primary" style={{ fontSize: '3rem' }}></i>
            </div>
            <h5 className="text-center mb-3">Enable Location Services</h5>
            <p className="text-muted text-center mb-4">
              TradeWorks Pro needs your location to:
            </p>
            <ul className="text-muted mb-4">
              <li>Provide turn-by-turn navigation to job sites</li>
              <li>Track your arrival for customer notifications</li>
              <li>Log job locations for accurate records</li>
              <li>Calculate travel time between jobs</li>
            </ul>
            <div className="d-grid gap-2">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowLocationPrompt(false)
                  getCurrentLocation()
                }}
              >
                <i className="bi bi-check-circle me-2"></i>
                Enable Location
              </button>
              <button 
                className="btn btn-light"
                onClick={() => setShowLocationPrompt(false)}
              >
                Not Now
              </button>
            </div>
            {locationPermissionStatus === 'denied' && (
              <div className="alert alert-warning mt-3 small">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Location is blocked. Go to your browser settings to enable it.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Header with Menu */}
      <div className="bg-primary text-white p-3 mb-4 position-sticky top-0" style={{ zIndex: 100 }}>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-0 d-flex align-items-center">
              <button 
                className="btn btn-sm btn-link text-white p-0 me-3"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <i className="bi bi-list fs-3"></i>
              </button>
              My Day
            </h4>
            <div className="text-white-50 small ms-5">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          </div>
          <div className="text-end">
            <div className="h5 mb-0">{todayJobs.length}</div>
            <div className="text-white-50 small">Jobs</div>
          </div>
        </div>
      </div>

      {/* Mobile Slide Menu */}
      {showMobileMenu && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50" 
          style={{ zIndex: 1040 }}
          onClick={() => setShowMobileMenu(false)}
        >
          <div 
            className="bg-white h-100" 
            style={{ width: '280px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-primary text-white">
              <h5 className="mb-0">{userProfile?.first_name} {userProfile?.last_name}</h5>
              <small>{userProfile?.email}</small>
            </div>
            <div className="p-3">
              <a href="/dashboard" className="d-block p-3 text-decoration-none text-dark hover-bg-light">
                <i className="bi bi-speedometer2 me-3"></i> Dashboard
              </a>
              <a href="/jobs" className="d-block p-3 text-decoration-none text-dark hover-bg-light">
                <i className="bi bi-briefcase me-3"></i> All Jobs
              </a>
              <a href="/mobile/camera" className="d-block p-3 text-decoration-none text-dark hover-bg-light">
                <i className="bi bi-camera me-3"></i> Camera
              </a>
              <a href="/communications/call-center" className="d-block p-3 text-decoration-none text-dark hover-bg-light">
                <i className="bi bi-telephone me-3"></i> Phone
              </a>
              <hr />
              <a href="/profile/account" className="d-block p-3 text-decoration-none text-dark hover-bg-light">
                <i className="bi bi-person me-3"></i> Profile
              </a>
              <a href="/logout" className="d-block p-3 text-decoration-none text-danger hover-bg-light">
                <i className="bi bi-box-arrow-right me-3"></i> Logout
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Location Status Banner */}
      {locationPermissionStatus === 'denied' && (
        <div className="alert alert-warning mx-3 mb-3 d-flex align-items-center">
          <i className="bi bi-geo-slash me-2"></i>
          <div className="flex-grow-1">Location disabled - Navigation won't work</div>
          <button 
            className="btn btn-sm btn-warning"
            onClick={() => setShowLocationPrompt(true)}
          >
            Fix
          </button>
        </div>
      )}

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
                      onClick={() => {
                        if (locationPermissionStatus === 'granted') {
                          openDirections(job.customer.address)
                        } else {
                          setShowLocationPrompt(true)
                        }
                      }}
                      disabled={locationPermissionStatus === 'denied'}
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
                    <button 
                      className="btn btn-light-success btn-sm w-100"
                      onClick={() => {
                        setPhotoJobId(job.id)
                        setShowPhotoCapture(true)
                      }}
                    >
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
                      onClick={() => {
                        if (locationPermissionStatus === 'granted') {
                          updateJobStatus(job.id, 'on_route')
                        } else {
                          setShowLocationPrompt(true)
                        }
                      }}
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

      {/* Photo Capture Modal */}
      {showPhotoCapture && photoJobId && (
        <PhotoCapture
          isOpen={showPhotoCapture}
          onClose={() => {
            setShowPhotoCapture(false)
            setPhotoJobId(null)
          }}
          onPhotoSaved={(photoUrl, photoId) => {
            console.log('Photo saved:', { photoUrl, photoId, jobId: photoJobId })
            // Could add logic here to update job status or show success message
          }}
          jobId={photoJobId}
          photoType="job_progress"
          title="Add Job Photo"
        />
      )}

      {/* Floating Action Button */}
      <div className="position-fixed" style={{ bottom: '90px', right: '20px', zIndex: 1000 }}>
        <div className="dropdown dropup">
          <button 
            className="btn btn-primary rounded-circle shadow-lg"
            style={{ width: '56px', height: '56px' }}
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="bi bi-plus fs-3"></i>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <a 
                className="dropdown-item" 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.href = '/leads/new'
                }}
              >
                <i className="bi bi-person-plus me-2"></i>
                New Lead
              </a>
            </li>
            <li>
              <a 
                className="dropdown-item" 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.href = '/jobs/new'
                }}
              >
                <i className="bi bi-briefcase-fill me-2"></i>
                New Job
              </a>
            </li>
            <li>
              <a 
                className="dropdown-item" 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.location.href = '/mobile/camera'
                }}
              >
                <i className="bi bi-camera-fill me-2"></i>
                Take Photo
              </a>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <a 
                className="dropdown-item" 
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  if (locationPermissionStatus !== 'granted') {
                    setShowLocationPrompt(true)
                  } else {
                    getCurrentLocation()
                    alert('Location updated successfully!')
                  }
                }}
              >
                <i className="bi bi-geo-alt-fill me-2"></i>
                Update Location
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MyDayDashboard