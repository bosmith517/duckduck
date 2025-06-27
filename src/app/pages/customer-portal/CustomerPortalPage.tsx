import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import SmartDashboard from '../../components/customer-portal/SmartDashboard'
import JobHistoryTimeline from '../../components/customer-portal/JobHistoryTimeline'
import ChatWidget from '../../components/customer-portal/ChatWidget'
import TechnicianProfile from '../../components/customer-portal/TechnicianProfile'
import LiveJobLog from '../../components/customer-portal/LiveJobLog'
import DigitalTwin from '../../components/customer-portal/DigitalTwin'
import MaintenanceHub from '../../components/customer-portal/MaintenanceHub'
import QuotesAndPlans from '../../components/customer-portal/QuotesAndPlans'
import ServiceSchedulingModal from '../../components/customer-portal/ServiceSchedulingModal'
import ContactTechnicianModal from '../../components/customer-portal/ContactTechnicianModal'

// Mapbox configuration
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.your_mapbox_token_here'

interface CustomerData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  profile_image_url?: string
  home_image_url?: string
  address_line1?: string
  address_line2?: string
  latitude?: number
  longitude?: number
}

interface PropertyData {
  address: string
  streetViewUrl: string
  zestimate?: number
  yearBuilt?: number
  squareFootage?: number
  lotSize?: string
  bedrooms?: number
  bathrooms?: number
  propertyType?: string
  lastSoldDate?: string
  lastSoldPrice?: number
  taxAssessment?: number
}

interface JobData {
  id: string
  title: string
  description: string
  scheduled_date: string
  estimated_duration: number
  status: string
  technician_name?: string
  technician_phone?: string
  service_type: string
  priority: string
}

interface TrackingData {
  tracking_token: string
  latitude: number
  longitude: number
  is_active: boolean
  last_updated: string
  technician_eta?: string
}

interface JobHistory {
  id: string
  date: string
  service: string
  status: string
  technician: string
  cost: number
}

const CustomerPortalPage: React.FC = () => {
  const { customerId, trackingToken } = useParams<{ customerId: string; trackingToken?: string }>()
  
  // State management
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [currentJob, setCurrentJob] = useState<JobData | null>(null)
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([])
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [showSchedulingModal, setShowSchedulingModal] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'equipment' | 'maintenance' | 'quotes'>('dashboard')
  
  // Mock technician data for demonstration
  const mockTechnician = {
    id: 'tech-001',
    name: 'Mike Rodriguez',
    title: 'Senior HVAC Technician',
    photo: '/assets/media/avatars/300-1.jpg',
    yearsExperience: 12,
    certifications: [
      'EPA Section 608 Universal',
      'NATE Certified',
      'HVAC Excellence Master',
      'Texas HVAC License #12345'
    ],
    specialties: [
      'Central Air Systems',
      'Heat Pumps',
      'Ductwork Design',
      'Energy Efficiency',
      'Smart Thermostats'
    ],
    rating: 4.9,
    completedJobs: 847,
    responseTime: '< 15min',
    bio: 'Mike has been keeping Austin homes comfortable for over a decade. He specializes in energy-efficient HVAC solutions and takes pride in explaining technical details in easy-to-understand terms. When not fixing AC units, Mike enjoys coaching little league baseball.',
    languages: ['English', 'Spanish']
  }
  
  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const realtimeChannelRef = useRef<any>(null)

  // Load initial data
  useEffect(() => {
    if (customerId) {
      loadCustomerData()
    }
  }, [customerId])

  // Set up tracking if token provided
  useEffect(() => {
    if (trackingToken) {
      initializeTracking()
    }
  }, [trackingToken])

  const loadCustomerData = async () => {
    try {
      setLoading(true)
      
      // Load customer details
      const { data: customerData, error: customerError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError
      setCustomer(customerData)

      // Generate mock property data based on customer address
      if (customerData) {
        const fullAddress = `${customerData.address_line1 || customerData.address}, ${customerData.city}, ${customerData.state} ${customerData.zip_code}`
        const encodedAddress = encodeURIComponent(fullAddress)
        
        setPropertyData({
          address: fullAddress,
          streetViewUrl: `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&key=YOUR_GOOGLE_MAPS_KEY`,
          zestimate: 485000,
          yearBuilt: 2018,
          squareFootage: 1850,
          lotSize: '0.18 acres',
          bedrooms: 3,
          bathrooms: 2,
          propertyType: 'Single Family Home',
          lastSoldDate: '2021-03-15',
          lastSoldPrice: 425000,
          taxAssessment: 462000
        })
      }

      // Load current active job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('contact_id', customerId)
        .in('status', ['Scheduled', 'In Progress', 'On The Way'])
        .order('start_date', { ascending: true })
        .limit(1)

      if (!jobError && jobData && jobData.length > 0) {
        setCurrentJob({
          ...jobData[0],
          technician_name: 'TBD', // Will be updated when technician is assigned
          technician_phone: null
        })
      }

      // Load job history
      const { data: historyData, error: historyError } = await supabase
        .from('jobs')
        .select('id, start_date, title, status, estimated_cost')
        .eq('contact_id', customerId)
        .in('status', ['Completed', 'Cancelled'])
        .order('start_date', { ascending: false })
        .limit(10)

      if (!historyError && historyData) {
        setJobHistory(historyData.map(job => ({
          id: job.id,
          date: job.start_date,
          service: job.title,
          status: job.status,
          technician: 'N/A', // Will be updated when we have technician assignments
          cost: job.estimated_cost || 0
        })))
      }

    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const initializeTracking = async () => {
    if (!trackingToken) return

    try {
      // Get initial technician location
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-technician-location?token=${trackingToken}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Tracking session not found or expired')
      }

      const locationData = await response.json()
      
      // Calculate a general area (offset the actual location for privacy)
      const generalAreaOffset = 0.01 // ~1km offset
      const offsetLat = locationData.latitude + (Math.random() - 0.5) * generalAreaOffset
      const offsetLng = locationData.longitude + (Math.random() - 0.5) * generalAreaOffset

      setTrackingData({
        tracking_token: trackingToken,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        is_active: true,
        last_updated: new Date().toISOString()
      })

      setShowTracking(true)
      
      // Initialize map with general area first
      setTimeout(() => {
        initializeMap(offsetLat, offsetLng, locationData.latitude, locationData.longitude)
      }, 100)

      // Set up real-time subscription
      setupRealtimeTracking()

    } catch (error: any) {
      console.error('Error initializing tracking:', error)
      setError('Unable to load tracking information')
    }
  }

  const initializeMap = (initialLat: number, initialLng: number, actualLat: number, actualLng: number) => {
    if (!mapContainerRef.current || mapRef.current) return

    // Create map centered on general area
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 12
    })

    // Add navigation controls
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Add customer location marker (destination)
    if (customer?.address) {
      // You would geocode the customer address here
      // For now, we'll use a placeholder
      new mapboxgl.Marker({ color: 'red' })
        .setLngLat([initialLng + 0.005, initialLat + 0.005])
        .setPopup(new mapboxgl.Popup().setHTML('<h6>Your Location</h6><p>Service destination</p>'))
        .addTo(mapRef.current)
    }

    // Add technician marker (starts from general area, moves to actual location)
    markerRef.current = new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([initialLng, initialLat])
      .setPopup(new mapboxgl.Popup().setHTML('<h6>Your Technician</h6><p>On the way!</p>'))
      .addTo(mapRef.current)

    // Gradually move marker to actual location over 30 seconds for smooth reveal
    animateMarkerToActualLocation(initialLng, initialLat, actualLng, actualLat)
  }

  const animateMarkerToActualLocation = (startLng: number, startLat: number, endLng: number, endLat: number) => {
    if (!markerRef.current) return

    const duration = 30000 // 30 seconds
    const start = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      
      // Smooth easing function
      const eased = 1 - Math.pow(1 - progress, 3)
      
      const currentLng = startLng + (endLng - startLng) * eased
      const currentLat = startLat + (endLat - startLat) * eased
      
      markerRef.current?.setLngLat([currentLng, currentLat])
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    
    animate()
  }

  const setupRealtimeTracking = () => {
    if (!trackingToken) return

    // Subscribe to real-time location updates
    realtimeChannelRef.current = supabase
      .channel(`tracking-${trackingToken}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_technician_locations',
          filter: `tracking_token=eq.${trackingToken}`
        },
        (payload) => {
          const newLocation = payload.new
          if (newLocation && markerRef.current) {
            // Update marker position smoothly
            markerRef.current.setLngLat([newLocation.longitude, newLocation.latitude])
            
            // Update tracking data
            setTrackingData(prev => prev ? {
              ...prev,
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              last_updated: newLocation.last_updated
            } : null)

            // Center map on new location
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: [newLocation.longitude, newLocation.latitude],
                zoom: 15,
                duration: 2000
              })
            }
          }
        }
      )
      .subscribe()
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
      if (mapRef.current) {
        mapRef.current.remove()
      }
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="text-muted">Loading your service information...</h4>
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <i className="ki-duotone ki-information fs-3x text-warning mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          <h3 className="text-dark mb-3">Information Unavailable</h3>
          <p className="text-muted fs-5">
            {error || 'Unable to load customer information'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-vh-100 bg-light">
      {/* Header with TradeWorks Pro Branding */}
      <div className="bg-white shadow-sm border-bottom">
        <div className="container py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <img src="/assets/media/logos/tradeworks-logo.png" alt="TradeWorks Pro" className="h-40px me-3" />
              <div>
                <h5 className="mb-0 text-dark">Customer Portal</h5>
                <span className="text-muted fs-7">Powered by TradeWorks Pro</span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <button 
                className="btn btn-sm btn-light-primary"
                onClick={() => window.open('tel:+15551234567', '_self')}
              >
                <i className="ki-duotone ki-phone fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Call Us
              </button>
              <button 
                className="btn btn-sm btn-light-success"
                onClick={() => setShowSchedulingModal(true)}
              >
                <i className="ki-duotone ki-calendar-add fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Book Service
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Smart Dashboard - Always visible */}
        <SmartDashboard 
          customer={customer}
          currentJob={currentJob}
          jobHistory={jobHistory}
          currentTrackingData={trackingData}
          onContactTechnician={() => setShowContactModal(true)}
          onRescheduleJob={() => alert('Please call us at (555) 123-4567 to reschedule your appointment.')}
          onPayInvoice={() => alert('Payment portal coming soon! Please call us to pay your invoice.')}
          onViewJobDetails={(jobId) => alert(`Job details for ${jobId} coming soon!`)}
          onScheduleService={() => setShowSchedulingModal(true)}
        />

        {/* Navigation Pills */}
        <div className="d-flex justify-content-center mb-6">
          <ul className="nav nav-pills nav-line-tabs nav-line-tabs-2x border-transparent fs-6 fw-bold">
            <li className="nav-item">
              <a 
                className={`nav-link ${activeSection === 'dashboard' ? 'active' : 'text-muted'}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveSection('dashboard') }}
              >
                <i className="ki-duotone ki-element-11 fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                </i>
                Home
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeSection === 'equipment' ? 'active' : 'text-muted'}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveSection('equipment') }}
              >
                <i className="ki-duotone ki-technology-2 fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Equipment
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeSection === 'maintenance' ? 'active' : 'text-muted'}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveSection('maintenance') }}
              >
                <i className="ki-duotone ki-setting-3 fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Maintenance
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeSection === 'quotes' ? 'active' : 'text-muted'}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveSection('quotes') }}
              >
                <i className="ki-duotone ki-document fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Service Plans
              </a>
            </li>
          </ul>
        </div>

        <div className="row g-6">
          {/* Main Content - Property Info or Tracking Map */}
          <div className="col-lg-8">
            <div className="card shadow-sm h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  {showTracking ? (
                    <>
                      <i className="ki-duotone ki-geolocation fs-3 text-primary me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Your Technician is On the Way
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-home fs-3 text-primary me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Your Property
                    </>
                  )}
                </h5>
                {trackingData && (
                  <div className="text-muted fs-7">
                    Last updated: {formatTime(trackingData.last_updated)}
                  </div>
                )}
              </div>
              <div className="card-body p-0">
                {showTracking ? (
                  /* Tracking Map */
                  <div 
                    ref={mapContainerRef}
                    style={{ height: '500px', width: '100%' }}
                    className="rounded-bottom"
                  />
                ) : (
                  /* Property Information */
                  <div>
                    {/* Street View Image */}
                    <div className="position-relative">
                      {propertyData ? (
                        <div
                          className="w-100 rounded-top bg-light d-flex align-items-center justify-content-center"
                          style={{ height: '300px', backgroundImage: `url('https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=300&fit=crop')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        >
                          <div className="position-absolute bottom-0 start-0 end-0 bg-gradient-dark p-3">
                            <h4 className="text-white fw-bold mb-1">{propertyData.address}</h4>
                            <div className="text-light fs-6">
                              <i className="ki-duotone ki-home-2 fs-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              {propertyData.propertyType} • Built {propertyData.yearBuilt}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="d-flex align-items-center justify-content-center bg-light"
                          style={{ height: '300px' }}
                        >
                          <div className="text-center text-muted">
                            <i className="ki-duotone ki-home fs-5x mb-3">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <p>Loading property information...</p>
                          </div>
                        </div>
                      )}
                      {!showTracking && trackingToken && (
                        <div className="position-absolute top-50 start-50 translate-middle">
                          <div className="bg-white bg-opacity-90 rounded-3 p-4 shadow text-center">
                            <div className="spinner-border text-primary mb-2" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mb-0 fw-bold">Activating tracking...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Property Details */}
                    {propertyData && (
                      <div className="p-5">
                        <div className="row g-4">
                          {/* Key Stats */}
                          <div className="col-md-4">
                            <div className="text-center p-3 bg-light-primary rounded">
                              <i className="ki-duotone ki-dollar fs-2x text-primary mb-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                                <span className="path3"></span>
                              </i>
                              <div className="fw-bold text-dark fs-4">${propertyData.zestimate?.toLocaleString()}</div>
                              <div className="text-muted fs-7">Estimated Value</div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="text-center p-3 bg-light-success rounded">
                              <i className="ki-duotone ki-home-3 fs-2x text-success mb-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <div className="fw-bold text-dark fs-4">{propertyData.squareFootage?.toLocaleString()}</div>
                              <div className="text-muted fs-7">Square Feet</div>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="text-center p-3 bg-light-info rounded">
                              <i className="ki-duotone ki-abstract-35 fs-2x text-info mb-2">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <div className="fw-bold text-dark fs-4">{propertyData.bedrooms}BD/{propertyData.bathrooms}BA</div>
                              <div className="text-muted fs-7">Bed/Bath</div>
                            </div>
                          </div>
                        </div>

                        <div className="separator my-4"></div>

                        {/* Additional Details */}
                        <div className="row g-4">
                          <div className="col-md-6">
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Lot Size:</span>
                              <span className="fw-semibold">{propertyData.lotSize}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Year Built:</span>
                              <span className="fw-semibold">{propertyData.yearBuilt}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Property Type:</span>
                              <span className="fw-semibold">{propertyData.propertyType}</span>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Last Sold:</span>
                              <span className="fw-semibold">
                                ${propertyData.lastSoldPrice?.toLocaleString()} ({new Date(propertyData.lastSoldDate || '').getFullYear()})
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Tax Assessment:</span>
                              <span className="fw-semibold">${propertyData.taxAssessment?.toLocaleString()}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-3">
                              <span className="text-muted">Data Source:</span>
                              <span className="fw-semibold text-primary">Zillow API</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Job Details & Actions */}
          <div className="col-lg-4">
            {/* Current Job */}
            {currentJob && (
              <div className="card shadow-sm mb-6">
                <div className="card-header">
                  <h6 className="card-title mb-0">
                    <i className="ki-duotone ki-wrench fs-4 text-success me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Current Service
                  </h6>
                </div>
                <div className="card-body">
                  <h5 className="text-dark mb-2">{currentJob.title}</h5>
                  <p className="text-muted fs-6 mb-3">{currentJob.description}</p>
                  
                  <div className="separator my-3"></div>
                  
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted fs-7">Scheduled:</span>
                    <span className="fw-bold fs-7">{formatDate(currentJob.scheduled_date)}</span>
                  </div>
                  
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted fs-7">Duration:</span>
                    <span className="fw-bold fs-7">{currentJob.estimated_duration} hours</span>
                  </div>
                  
                  {currentJob.technician_name && (
                    <>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted fs-7">Technician:</span>
                        <span className="fw-bold fs-7">{currentJob.technician_name}</span>
                      </div>
                      
                      {currentJob.technician_phone && (
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted fs-7">Contact:</span>
                          <a href={`tel:${currentJob.technician_phone}`} className="fw-bold fs-7 text-primary">
                            {currentJob.technician_phone}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="mt-3">
                    <span className={`badge badge-light-${
                      currentJob.status === 'on_the_way' ? 'warning' :
                      currentJob.status === 'in_progress' ? 'primary' : 'success'
                    } w-100 py-2`}>
                      {currentJob.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Service */}
            <div className="card shadow-sm mb-6">
              <div className="card-header">
                <h6 className="card-title mb-0">
                  <i className="ki-duotone ki-rocket fs-4 text-info me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  {currentJob ? 'Schedule Additional Service' : 'Schedule Service'}
                </h6>
              </div>
              <div className="card-body">
                <p className="text-muted fs-6 mb-4">
                  {currentJob 
                    ? 'Need additional work? Schedule another service appointment.' 
                    : 'No upcoming appointments. Schedule your next service or maintenance check.'
                  }
                </p>

                <div className="d-flex flex-column gap-3">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowSchedulingModal(true)}
                  >
                    <i className="ki-duotone ki-calendar-add fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Schedule New Service
                  </button>
                  
                  <button 
                    className="btn btn-light-success btn-sm"
                    onClick={() => {
                      setActiveSection('maintenance')
                      document.getElementById('maintenance-section')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <i className="ki-duotone ki-wrench fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Maintenance Check
                  </button>
                  
                  <button 
                    className="btn btn-light-warning btn-sm"
                    onClick={() => window.open('tel:+15551234567', '_self')}
                  >
                    <i className="ki-duotone ki-support fs-5 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Emergency Service
                  </button>
                </div>

                <div className="separator my-4"></div>

                <div className="d-flex align-items-center">
                  <i className="ki-duotone ki-phone fs-4 text-success me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <div className="fw-bold text-dark fs-6">Need immediate help?</div>
                    <a href="tel:+1234567890" className="text-success fw-bold">
                      Call (123) 456-7890
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Service History */}
            <div className="card shadow-sm">
              <div className="card-header">
                <h6 className="card-title mb-0">
                  <i className="ki-duotone ki-time fs-4 text-info me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Service History
                </h6>
              </div>
              <div className="card-body p-0">
                {jobHistory.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-row-dashed table-row-gray-100 align-middle gs-0 gy-3">
                      <tbody>
                        {jobHistory.map((job) => (
                          <tr key={job.id}>
                            <td className="ps-4">
                              <div className="d-flex align-items-center">
                                <div className="me-3">
                                  <span className={`badge badge-light-${
                                    job.status === 'completed' ? 'success' : 'danger'
                                  } fs-8`}>
                                    {job.status}
                                  </span>
                                </div>
                                <div className="d-flex flex-column">
                                  <span className="text-dark fw-bold fs-7">{job.service}</span>
                                  <span className="text-muted fs-8">{formatDate(job.date)}</span>
                                  <span className="text-muted fs-8">{job.technician}</span>
                                </div>
                              </div>
                            </td>
                            <td className="text-end pe-4">
                              <span className="text-dark fw-bold fs-7">
                                ${job.cost.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted">
                    <i className="ki-duotone ki-information fs-3x mb-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <p className="mb-0">No previous services</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Sections based on active navigation */}
        {activeSection === 'dashboard' && (
          <div>
            {/* Enhanced Features when job is active */}
            {currentJob && (
              <div className="row g-6 mt-6">
                {/* Technician Profile */}
                <div className="col-lg-6">
                  <TechnicianProfile 
                    technician={mockTechnician}
                    showFullProfile={true}
                  />
                </div>
                
                {/* Live Job Log */}
                <div className="col-lg-6">
                  <LiveJobLog 
                    jobId={currentJob.id}
                    isActive={currentJob.status === 'In Progress' || currentJob.status === 'On The Way'}
                  />
                </div>
              </div>
            )}

            {/* Job History Timeline */}
            <div className="mt-8">
              <JobHistoryTimeline 
                jobHistory={jobHistory}
                customer={customer}
              />
            </div>
          </div>
        )}

        {activeSection === 'equipment' && (
          <div className="mt-6">
            <DigitalTwin customerId={customerId || ''} />
          </div>
        )}

        {activeSection === 'maintenance' && (
          <div className="mt-6" id="maintenance-section">
            <MaintenanceHub 
              customerId={customerId || ''}
              customerLocation={{
                city: customer?.city || 'Austin',
                state: customer?.state || 'TX'
              }}
            />
          </div>
        )}

        {activeSection === 'quotes' && (
          <div className="mt-6">
            <QuotesAndPlans customerId={customerId || ''} />
          </div>
        )}
      </div>

      {/* Chat Widget */}
      <ChatWidget />

      {/* Service Scheduling Modal */}
      <ServiceSchedulingModal
        isOpen={showSchedulingModal}
        onClose={() => setShowSchedulingModal(false)}
        customerId={customerId || ''}
        customerName={customer ? `${customer.first_name} ${customer.last_name}` : ''}
        customerPhone={customer?.phone}
        customerEmail={customer?.email}
      />

      {/* Contact Technician Modal */}
      <ContactTechnicianModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        technicianName={currentJob?.technician_name || 'Mike Rodriguez'}
        technicianPhone='+15551234567'
        jobId={currentJob?.id}
      />
    </div>
  )
}

export default CustomerPortalPage