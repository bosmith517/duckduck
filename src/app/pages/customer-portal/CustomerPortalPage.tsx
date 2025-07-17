import React, { useState, useEffect, useRef, Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import ClientPortalService from '../../services/clientPortalService'
import { propertyService } from '../../services/propertyService'
import { attomDataService } from '../../services/attomDataService'
import SmartDashboard from '../../components/customer-portal/SmartDashboard'
import JobHistoryTimeline from '../../components/customer-portal/JobHistoryTimeline'
import ChatWidget from '../../components/customer-portal/ChatWidget'
import TechnicianProfile from '../../components/customer-portal/TechnicianProfile'
import LiveJobLog from '../../components/customer-portal/LiveJobLog'
import PropertyStatsCard from '../../components/customer-portal/PropertyStatsCard'
import StickyNavigation from '../../components/customer-portal/StickyNavigation'
import FloatingCTABar from '../../components/customer-portal/FloatingCTABar'
import LoadingSpinner from '../../components/customer-portal/LoadingSpinner'

// Lazy-loaded heavy components
const DigitalTwin = React.lazy(() => import('../../components/customer-portal/DigitalTwin'))
const MaintenanceHub = React.lazy(() => import('../../components/customer-portal/MaintenanceHub'))
const QuotesAndPlans = React.lazy(() => import('../../components/customer-portal/QuotesAndPlans'))
const ServiceSchedulingModal = React.lazy(() => import('../../components/customer-portal/ServiceSchedulingModal'))
const ContactTechnicianModal = React.lazy(() => import('../../components/customer-portal/ContactTechnicianModal'))
const JobPhotosTab = React.lazy(() => import('../../components/customer-portal/JobPhotosTab'))
const DocumentsTab = React.lazy(() => import('../../components/customer-portal/DocumentsTab'))
const ReferralDashboard = React.lazy(() => import('../../components/customer-portal/ReferralDashboard'))
const EstimatesTab = React.lazy(() => import('../../components/customer-portal/EstimatesTab'))

// Conditional Mapbox import - only load when needed
let mapboxgl: any = null
const loadMapbox = async () => {
  if (!mapboxgl) {
    const mapboxModule = await import('mapbox-gl')
    await import('mapbox-gl/dist/mapbox-gl.css')
    mapboxgl = mapboxModule.default
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.your_mapbox_token_here'
  }
  return mapboxgl
}

// Street View utility function with Attom fallback
const getStreetViewUrl = async (address: string, attomRawData?: any): Promise<string> => {
  const googleApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  // Check if Google API key is available
  
  if (googleApiKey) {
    return `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(address)}&key=${googleApiKey}`
  }
  
  // Fallback to Attom property photos from existing data
  const attomPhotos = attomRawData?.propertyPhotos
  if (attomPhotos && attomPhotos.length > 0) {
    // Using Attom photo as street view fallback
    return attomPhotos[0].url
  }
  
  // Try to get fresh Attom photos if no existing photos
  try {
    const addressParts = address.split(',')
    if (addressParts.length >= 3) {
      const streetAddress = addressParts[0].trim()
      const city = addressParts[1].trim()
      const state = addressParts[2].trim()
      
      const photos = await attomDataService.getPropertyPhotos(streetAddress, city, state)
      if (photos.length > 0) {
        // Using fresh Attom photo as street view fallback
        return photos[0]
      }
    }
  } catch (error) {
    // Failed to get Attom photos
  }
  
  // No street view available - using placeholder
  return 'https://via.placeholder.com/600x400/f0f0f0/999?text=Street+View+Unavailable'
}

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
  tenant_id: string
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
  lastSoldPrice?: number
  lastSoldDate?: string
  taxAssessment?: number
  stories?: number
  garageSpaces?: number
  pool?: boolean
  centralAir?: boolean
  constructionQuality?: string
  roofMaterial?: string
  // Additional Attom fields
  totalRooms?: number
  exteriorWalls?: string
  heatingType?: string
  coolingType?: string
  fireplace?: boolean
  parcelNumber?: string
  attomId?: string
  taxYear?: number
  annualTaxAmount?: number
  ownerName?: string
  ownerOccupied?: boolean
  zoning?: string
  subdivision?: string
  county?: string
  marketValueDate?: string
  pricePerSqFt?: number
  comparableSales?: any[]
  priceHistory?: any[]
  latitude?: number
  longitude?: number
}

interface JobData {
  id: string
  title: string
  description: string
  scheduled_date: string
  estimated_duration: number
  status: string
  tenant_id: string
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
  eta?: string
  distance?: string
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
  const { customerId, trackingToken, token } = useParams<{ customerId?: string; trackingToken?: string; token?: string }>()
  
  console.log('🚀 CustomerPortalPage loaded with params:', { customerId, trackingToken, token })
  
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'equipment' | 'maintenance' | 'quotes' | 'photos' | 'documents' | 'referrals' | 'estimates' | 'history'>('dashboard')
  const [tenantPhone, setTenantPhone] = useState<string | null>(null)
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [tenantBranding, setTenantBranding] = useState<any>(null)
  
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
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const realtimeChannelRef = useRef<any>(null)
  
  // Apply branding styles when loaded
  useEffect(() => {
    if (tenantBranding?.primary_color) {
      document.documentElement.style.setProperty('--bs-primary', tenantBranding.primary_color)
      document.documentElement.style.setProperty('--bs-primary-rgb', hexToRgb(tenantBranding.primary_color))
    }
    if (tenantBranding?.secondary_color) {
      document.documentElement.style.setProperty('--bs-secondary', tenantBranding.secondary_color)
      document.documentElement.style.setProperty('--bs-secondary-rgb', hexToRgb(tenantBranding.secondary_color))
    }
    
    // Update page title
    if (tenantBranding?.white_label_enabled && tenantBranding?.company_name) {
      document.title = `${tenantBranding.company_name} - Customer Portal`
    }
    
    // Update favicon
    if (tenantBranding?.favicon_url) {
      const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (favicon) {
        favicon.href = tenantBranding.favicon_url
      }
    }
  }, [tenantBranding])
  
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
      const r = parseInt(result[1], 16)
      const g = parseInt(result[2], 16)
      const b = parseInt(result[3], 16)
      return `${r}, ${g}, ${b}`
    }
    return '0, 123, 255' // Default primary color RGB
  }

  // Load initial data based on access method
  useEffect(() => {
    if (token) {
      // Token-based access (from portal link)
      loadPortalDataByToken()
    } else if (customerId) {
      // Direct customer ID access
      loadCustomerData()
    }
  }, [token, customerId])

  // Set up tracking if token provided
  useEffect(() => {
    if (trackingToken) {
      initializeTracking()
    }
  }, [trackingToken])

  const loadPortalDataByToken = async () => {
    if (!token) return

    try {
      setLoading(true)
      
      // Validate portal token and get job access
      const portalData = await ClientPortalService.validatePortalAccess(token)
      
      if (!portalData) {
        setError('Invalid or expired portal link. Please contact us for assistance.')
        return
      }

      // Get the job and customer data from the portal response
      const job = portalData.jobs
      if (!job) {
        setError('Unable to load job information.')
        return
      }

      // Determine if customer is a contact or account
      const customerData = job.contacts || job.accounts
      if (!customerData) {
        setError('Unable to load customer information.')
        return
      }

      // Transform the data to match CustomerData interface
      const transformedCustomer: CustomerData = {
        id: job.contact_id || job.account_id || '',
        first_name: job.contacts?.first_name || job.accounts?.name?.split(' ')[0] || '',
        last_name: job.contacts?.last_name || '',
        email: job.contacts?.email || job.accounts?.email || '',
        phone: job.contacts?.phone || job.accounts?.phone || '',
        address: job.location_address || '',
        city: job.location_city || '',
        state: job.location_state || '',
        zip_code: job.location_zip || '',
        tenant_id: job.tenant_id || ''
      }

      setCustomer(transformedCustomer)
      
      // Load tenant branding
      if (job.tenant_id) {
        const { data: brandingData, error: brandingError } = await supabase
          .from('tenant_branding')
          .select('*')
          .eq('tenant_id', job.tenant_id)
          .single()
          
        if (!brandingError && brandingData) {
          setTenantBranding(brandingData)
        } else {
          // Fallback to tenant business_info
          const { data: tenantFallback } = await supabase
            .from('tenants')
            .select('company_name, business_info')
            .eq('id', job.tenant_id)
            .single()
            
          if (tenantFallback?.business_info?.branding_settings) {
            setTenantBranding({
              company_name: tenantFallback.company_name,
              ...tenantFallback.business_info.branding_settings
            })
          } else if (tenantFallback) {
            setTenantBranding({
              company_name: tenantFallback.company_name,
              white_label_enabled: false
            })
          }
        }
        
        // Load tenant phone info
        const { data: tenantData } = await supabase
          .from('v_tenant_phone_overview')
          .select('*')
          .eq('tenant_id', job.tenant_id)
          .single()
          
        if (tenantData) {
          setTenantInfo(tenantData)
          // Priority: 1. Business Account Phone, 2. Tenant Business Info
          // Never use SignalWire numbers for customer portal display
          const phoneNumber = tenantData.business_contact_phone || tenantData.selected_phone_during_onboarding
          setTenantPhone(phoneNumber)
        }
      }

      // Set current job
      if (job) {
        setCurrentJob({
          id: job.id,
          title: job.title || 'Service',
          description: job.description || '',
          scheduled_date: job.start_date || '',
          estimated_duration: 2, // Default 2 hours
          status: job.status || 'Scheduled',
          tenant_id: job.tenant_id || customerData.tenant_id,
          technician_name: 'TBD',
          technician_phone: undefined,
          service_type: job.title || 'Service',
          priority: job.priority || 'medium'
        })

        // Check if there's an active tracking session for this job
        console.log('🔍 Checking for active tracking session for job:', job.id)
        const { data: trackingSession, error: trackingError } = await supabase
          .from('job_technician_locations')
          .select('tracking_token, is_active, expires_at')
          .eq('job_id', job.id)
          .eq('is_active', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        console.log('🔍 Tracking query result:', { trackingSession, trackingError })
        
        if (trackingSession) {
          console.log('📍 Active tracking session found:', trackingSession.tracking_token)
          // Initialize tracking directly with the found token
          setShowTracking(true)
          
          // Fetch initial technician location
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-technician-location?token=${trackingSession.tracking_token}`,
              {
                headers: {
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                }
              }
            )

            if (response.ok) {
              const locationData = await response.json()
              
              // Calculate ETA if we have customer location
              let etaInfo = null
              const customerAddress = job.location_address
              console.log('🗺️ Calculating ETA for address:', customerAddress)
              
              if (customerAddress) {
                // For demo, use the property coordinates if available
                // In production, you'd geocode the address
                const destLat = propertyData?.latitude || 41.5541 // Default to Mokena, IL coordinates
                const destLng = propertyData?.longitude || -87.7406
                
                console.log('📍 Technician:', locationData.latitude, locationData.longitude)
                console.log('🏠 Destination:', destLat, destLng)
                
                etaInfo = await calculateETA(
                  locationData.latitude,
                  locationData.longitude,
                  destLat,
                  destLng
                )
                
                console.log('⏱️ ETA calculated:', etaInfo)
              } else {
                console.log('❌ No customer address available for ETA calculation')
              }

              setTrackingData({
                tracking_token: trackingSession.tracking_token,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                is_active: true,
                last_updated: new Date().toISOString(),
                eta: etaInfo?.eta,
                distance: etaInfo?.distance
              })

              // Initialize map after a short delay
              setTimeout(() => {
                if (locationData.latitude && locationData.longitude) {
                  // Calculate a general area (offset for privacy)
                  const generalAreaOffset = 0.01
                  const offsetLat = locationData.latitude + (Math.random() - 0.5) * generalAreaOffset
                  const offsetLng = locationData.longitude + (Math.random() - 0.5) * generalAreaOffset
                  
                  initializeMap(offsetLat, offsetLng, locationData.latitude, locationData.longitude)
                  setupRealtimeTracking(trackingSession.tracking_token)
                }
              }, 500)
            }
          } catch (error) {
            console.error('Error fetching initial tracking location:', error)
          }
        }
      }

      // Get property data from Attom API
      if (transformedCustomer.address && job.tenant_id) {
        const fullAddress = `${transformedCustomer.address}, ${transformedCustomer.city}, ${transformedCustomer.state} ${transformedCustomer.zip_code}`
        
        try {
          console.log('🏠 Loading Attom property data for customer portal:', transformedCustomer.address)
          
          // Get property data from Attom
          const attomData = await attomDataService.getPropertyDataWithCache(
            transformedCustomer.address,
            transformedCustomer.city,
            transformedCustomer.state,
            job.tenant_id
          )
          
          console.log('🏠 Attom property data loaded:', attomData)
          
          // Transform Attom data to match portal PropertyData interface
          // Extract additional data from raw Attom response
          const rawData = attomData?.attom_raw_data
          const details = rawData?.details
          const valuation = rawData?.valuation
          
          // Get street view URL (async)
          const streetViewUrl = await getStreetViewUrl(fullAddress, rawData)
          
          setPropertyData({
            address: fullAddress,
            streetViewUrl,
            zestimate: attomData?.market_value_estimate || undefined,
            yearBuilt: attomData?.year_built || undefined,
            squareFootage: attomData?.square_footage || undefined,
            lotSize: attomData?.lot_size || undefined,
            bedrooms: attomData?.bedrooms || undefined,
            bathrooms: attomData?.bathrooms || undefined,
            propertyType: attomData?.property_type || 'Residential Property',
            lastSoldPrice: attomData?.last_sold_price || undefined,
            lastSoldDate: attomData?.last_sold_date || undefined,
            taxAssessment: attomData?.tax_assessment || undefined,
            // Additional Attom data
            stories: attomData?.stories || undefined,
            garageSpaces: attomData?.garage_spaces || undefined,
            pool: attomData?.pool || false,
            centralAir: attomData?.central_air || false,
            constructionQuality: attomData?.construction_quality || undefined,
            roofMaterial: attomData?.roof_material || undefined,
            // New fields from raw Attom data
            totalRooms: attomData?.total_rooms || undefined,
            exteriorWalls: attomData?.exterior_walls || undefined,
            heatingType: attomData?.heating_type || undefined,
            coolingType: attomData?.cooling_type || undefined,
            fireplace: attomData?.fireplace || false,
            parcelNumber: attomData?.parcel_number || undefined,
            attomId: attomData?.attom_id?.toString() || undefined,
            taxYear: attomData?.tax_year || undefined,
            annualTaxAmount: details?.assessment?.tax?.taxAmt || undefined,
            ownerName: details?.assessment?.owner?.owner1?.fullName || undefined,
            ownerOccupied: details?.summary?.absenteeInd === 'OWNER OCCUPIED',
            zoning: details?.lot?.zoningType || undefined,
            subdivision: details?.area?.subdName || undefined,
            county: details?.area?.munName || undefined,
            marketValueDate: attomData?.market_value_date || undefined,
            pricePerSqFt: details?.sale?.calculation?.pricePerSizeUnit || undefined,
            comparableSales: attomData?.comparable_sales || [],
            priceHistory: attomData?.price_history || []
          })
        } catch (error) {
          console.error('❌ Error loading Attom property data:', error)
          // Fallback to basic data
          const streetViewUrl = await getStreetViewUrl(fullAddress)
          setPropertyData({
            address: fullAddress,
            streetViewUrl,
            propertyType: 'Residential Property'
          })
        }
      }

      // Load job history for this customer
      const customerIdToUse = job.contact_id || job.account_id
      if (customerIdToUse) {
        const { data: historyData } = await supabase
          .from('jobs')
          .select('id, start_date, title, status, estimated_cost')
          .or(`contact_id.eq.${customerIdToUse},account_id.eq.${customerIdToUse}`)
          .in('status', ['Completed', 'Cancelled'])
          .order('start_date', { ascending: false })
          .limit(10)

        if (historyData) {
          setJobHistory(historyData.map(job => ({
            id: job.id,
            date: job.start_date,
            service: job.title,
            status: job.status,
            technician: 'N/A',
            cost: job.estimated_cost || 0
          })))
        }
      }

    } catch (error: any) {
      console.error('Error loading portal data:', error)
      setError('Unable to load portal. Please try again or contact support.')
    } finally {
      setLoading(false)
    }
  }

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

      // Load tenant information including phone, company name, logo, etc.
      if (customerData?.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('v_tenant_phone_overview')
          .select('*')
          .eq('tenant_id', customerData.tenant_id)
          .single()

        if (!tenantError && tenantData) {
          setTenantInfo(tenantData)
          // Priority: 1. Business Account Phone, 2. Tenant Business Info
          // Never use SignalWire numbers for customer portal display
          const phoneNumber = tenantData.business_contact_phone || tenantData.selected_phone_during_onboarding
          setTenantPhone(phoneNumber)
        }
        
        // Load tenant branding
        const { data: brandingData, error: brandingError } = await supabase
          .from('tenant_branding')
          .select('*')
          .eq('tenant_id', customerData.tenant_id)
          .single()
          
        if (!brandingError && brandingData) {
          setTenantBranding(brandingData)
        } else {
          // Fallback to tenant business_info
          const { data: tenantFallback } = await supabase
            .from('tenants')
            .select('company_name, business_info')
            .eq('id', customerData.tenant_id)
            .single()
            
          if (tenantFallback?.business_info?.branding_settings) {
            setTenantBranding({
              company_name: tenantFallback.company_name,
              ...tenantFallback.business_info.branding_settings
            })
          } else if (tenantFallback) {
            setTenantBranding({
              company_name: tenantFallback.company_name,
              white_label_enabled: false
            })
          }
        }
      }

      // Get real property data based on customer address
      if (customerData) {
        const fullAddress = `${customerData.address_line1 || customerData.address}, ${customerData.city}, ${customerData.state} ${customerData.zip_code}`
        
        try {
          console.log('🏠 Loading property data for customer portal:', fullAddress)
          // Clear cache first to test the function
          propertyService.clearCache(fullAddress)
          const propertyData = await propertyService.getPropertyDataWithCache(fullAddress, customerData.tenant_id)
          console.log('🏠 Property data loaded:', propertyData)
          console.log('🔑 Google API Key present:', !!import.meta.env.VITE_GOOGLE_PLACES_API_KEY)
          setPropertyData(propertyData)
        } catch (error) {
          console.error('❌ Error loading property data:', error)
          // Fallback to basic data
          const streetViewUrl = await getStreetViewUrl(fullAddress)
          setPropertyData({
            address: fullAddress,
            streetViewUrl,
            propertyType: 'Residential Property'
          })
        }
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
          tenant_id: jobData[0].tenant_id || customerData.tenant_id,
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

  const initializeMap = async (initialLat: number, initialLng: number, actualLat: number, actualLng: number) => {
    if (!mapContainerRef.current || mapRef.current) return

    // Load Mapbox only when needed for tracking
    const mapbox = await loadMapbox()

    // Create map centered on general area
    mapRef.current = new mapbox.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialLng, initialLat],
      zoom: 12
    })

    // Add navigation controls
    mapRef.current.addControl(new mapbox.NavigationControl(), 'top-right')

    // Add customer location marker (destination)
    if (customer?.address) {
      // You would geocode the customer address here
      // For now, we'll use a placeholder
      new mapbox.Marker({ color: 'red' })
        .setLngLat([initialLng + 0.005, initialLat + 0.005])
        .setPopup(new mapbox.Popup().setHTML('<h6>Your Location</h6><p>Service destination</p>'))
        .addTo(mapRef.current)
    }

    // Add technician marker (starts from general area, moves to actual location)
    markerRef.current = new mapbox.Marker({ color: 'blue' })
      .setLngLat([initialLng, initialLat])
      .setPopup(new mapbox.Popup().setHTML('<h6>Your Technician</h6><p>On the way!</p>'))
      .addTo(mapRef.current)

    // Gradually move marker to actual location over 30 seconds for smooth reveal
    animateMarkerToActualLocation(initialLng, initialLat, actualLng, actualLat)
  }

  const calculateETA = async (techLat: number, techLng: number, destLat: number, destLng: number) => {
    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
      if (!mapboxToken) return null

      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${techLng},${techLat};${destLng},${destLat}?access_token=${mapboxToken}&geometries=geojson`
      )

      if (!response.ok) return null

      const data = await response.json()
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        const durationSeconds = route.duration
        const distanceMeters = route.distance

        // Convert to minutes and round up
        const durationMinutes = Math.ceil(durationSeconds / 60)
        
        // Format ETA
        if (durationMinutes < 60) {
          return {
            eta: `${durationMinutes} min`,
            distance: (distanceMeters / 1609.34).toFixed(1) // Convert to miles
          }
        } else {
          const hours = Math.floor(durationMinutes / 60)
          const minutes = durationMinutes % 60
          return {
            eta: `${hours}h ${minutes}m`,
            distance: (distanceMeters / 1609.34).toFixed(1)
          }
        }
      }
    } catch (error) {
      console.error('Error calculating ETA:', error)
    }
    return null
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

  const setupRealtimeTracking = (token?: string) => {
    const activeToken = token || trackingToken
    if (!activeToken) return

    // Subscribe to real-time location updates
    realtimeChannelRef.current = supabase
      .channel(`tracking-${activeToken}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_technician_locations',
          filter: `tracking_token=eq.${activeToken}`
        },
        (payload) => {
          const newLocation = payload.new
          if (newLocation && markerRef.current) {
            // Update marker position smoothly
            markerRef.current.setLngLat([newLocation.longitude, newLocation.latitude])
            
            // Update tracking data
            // Update tracking data and recalculate ETA
            setTrackingData(prev => {
              if (!prev) return null
              
              // Calculate new ETA in background
              if (customer?.address) {
                const destLat = propertyData?.latitude || 41.5541
                const destLng = propertyData?.longitude || -87.7406
                
                calculateETA(
                  newLocation.latitude,
                  newLocation.longitude,
                  destLat,
                  destLng
                ).then(etaInfo => {
                  if (etaInfo) {
                    setTrackingData(current => current ? {
                      ...current,
                      eta: etaInfo.eta,
                      distance: etaInfo.distance
                    } : null)
                  }
                })
              }
              
              return {
                ...prev,
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
                last_updated: newLocation.last_updated
              }
            })

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
    if (!dateString) {
      return 'Date to be determined'
    }
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Date to be determined'
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    if (!dateString) {
      return ''
    }
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return ''
    }
    
    return date.toLocaleTimeString('en-US', {
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
      {/* Header with Dynamic Branding */}
      <div className="bg-white shadow-sm border-bottom">
        <div className="container-fluid py-2 py-lg-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center">
              {tenantBranding?.logo_url ? (
                <img 
                  src={tenantBranding.logo_url} 
                  alt={tenantBranding.company_name || 'Customer Portal'} 
                  className="h-30px h-lg-40px me-2 me-lg-3" 
                  style={{ objectFit: 'contain' }}
                />
              ) : (
                <div 
                  className="d-flex align-items-center justify-content-center me-3" 
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: tenantBranding?.primary_color || '#007bff'
                  }}
                >
                  <i className="bi bi-tools text-white fs-5"></i>
                </div>
              )}
              <div>
                <h5 className="mb-0 text-dark fs-6 fs-lg-5">
                  {tenantBranding?.white_label_enabled && tenantBranding?.company_name 
                    ? tenantBranding.company_name 
                    : 'Customer Portal'}
                </h5>
                <span className="text-muted fs-8 fs-lg-7 d-none d-sm-block">
                  {tenantBranding?.tagline || 
                   (tenantBranding?.white_label_enabled ? 'Service Portal' : 'Powered by TradeWorks Pro')}
                </span>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
              <button 
                className="btn btn-sm btn-light-primary d-none d-sm-inline-flex"
                onClick={() => tenantPhone && window.open(`tel:${tenantPhone}`, '_self')}
              >
                <i className="ki-duotone ki-phone fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Call Us
              </button>
              <button 
                className="btn btn-sm btn-light-success d-flex align-items-center"
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

      {/* Sticky Navigation */}
      <StickyNavigation 
        activeSection={activeSection}
        onSectionChange={(section: string) => {
          setActiveSection(section as 'dashboard' | 'equipment' | 'maintenance' | 'quotes' | 'photos' | 'documents' | 'referrals' | 'estimates')
          // Collapse property details when switching sections
          const propertyAccordion = document.getElementById('propertyCollapse')
          if (propertyAccordion && section !== 'dashboard') {
            propertyAccordion.classList.remove('show')
            const accordionButton = document.querySelector('[data-bs-target="#propertyCollapse"]')
            accordionButton?.classList.add('collapsed')
            accordionButton?.setAttribute('aria-expanded', 'false')
          }
          // Scroll to top when changing sections
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        currentJob={currentJob}
        jobHistory={jobHistory}
        tenantPhone={tenantPhone}
        onViewTeam={() => alert('View Team modal coming soon!')}
      />

      {/* Main Content with Navigation Offset */}
      <div className="py-6 portal-main-wrapper">
        <style>{`
          .portal-main-wrapper {
            margin-left: 240px;
          }
          
          @media (max-width: 991.98px) {
            .portal-main-wrapper { 
              margin-left: 0 !important; 
              padding-bottom: 120px !important;
              padding-top: 1rem !important;
            }
            .main-content { 
              padding-left: 0.75rem !important;
              padding-right: 0.75rem !important;
            }
          }
          
          .main-content {
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 1rem;
            padding-right: 1rem;
          }
          
          .bg-gradient-dark {
            background: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4));
          }
        `}</style>
        
        <div className="main-content">
        
        {/* Navigation is now handled by StickyNavigation component */}
        {/* 
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
            {currentJob && (
              <>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeSection === 'photos' ? 'active' : 'text-muted'}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveSection('photos') }}
                  >
                    <i className="ki-duotone ki-picture fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Photos
                  </a>
                </li>
                <li className="nav-item">
                  <a 
                    className={`nav-link ${activeSection === 'documents' ? 'active' : 'text-muted'}`}
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActiveSection('documents') }}
                  >
                    <i className="ki-duotone ki-folder fs-4 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Documents
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>
        */}

        {/* Show property row only on dashboard */}
        {activeSection === 'dashboard' && (
          <>
            {/* Top Row - Smart Dashboard and Current Job */}
            <div className="row g-6 mb-6">
              {/* Smart Dashboard */}
              <div className="col-lg-8">
                <SmartDashboard 
                  customer={customer}
                  currentJob={currentJob}
                  jobHistory={jobHistory}
                  currentTrackingData={trackingData}
                  onContactTechnician={() => setShowContactModal(true)}
                  onRescheduleJob={() => alert(`Please call us at ${tenantPhone || 'our main number'} to reschedule your appointment.`)}
                  onPayInvoice={() => alert('Payment portal coming soon! Please call us to pay your invoice.')}
                  onViewJobDetails={(jobId) => alert(`Job details for ${jobId} coming soon!`)}
                  onScheduleService={() => setShowSchedulingModal(true)}
                />
              </div>
              
              {/* Current Job Card */}
              <div className="col-lg-4">
                {currentJob && (
                  <div className="card shadow-sm h-100">
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
              </div>
            </div>

            {/* Second Row - Property Details and Schedule Service */}
            <div className="row g-6">
              {/* Main Content - Property Info or Tracking Map */}
              <div className="col-lg-8">
              {/* Property Details Accordion */}
              <div className="accordion" id="propertyAccordion">
              <div className="accordion-item">
                <h2 className="accordion-header" id="propertyHeading">
                  <button 
                    className="accordion-button" 
                    type="button" 
                    data-bs-toggle="collapse" 
                    data-bs-target="#propertyCollapse" 
                    aria-expanded="true" 
                    aria-controls="propertyCollapse"
                  >
                    <i className="ki-duotone ki-home fs-2 text-primary me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <div className="fw-bold text-gray-900">Property Details & Street View</div>
                      <div className="text-muted fs-7">
                        {showTracking ? 'Live tracking map view' : 'Property information and imagery'}
                      </div>
                    </div>
                  </button>
                </h2>
                <div 
                  id="propertyCollapse" 
                  className="accordion-collapse collapse show" 
                  aria-labelledby="propertyHeading" 
                  data-bs-parent="#propertyAccordion"
                >
                  <div className="accordion-body p-0">
                    {/* Sticky Street View Card */}
                    <div className="sticky-lg-top bg-white shadow-sm" style={{ zIndex: 10 }}>
                      <div className="card border-0 rounded-0">
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
                                Your Property at {customer?.address_line1 || customer?.address || 'this Address'}
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
                            <>
                              {/* Live Tracking Banner */}
                              <div className="bg-success text-white p-3 d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="spinner-grow spinner-grow-sm text-white me-3" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                  </div>
                                  <div>
                                    <strong>Technician On The Way!</strong>
                                    <div className="small opacity-75">
                                      {trackingData?.eta ? (
                                        <>ETA: {trackingData.eta} • Live tracking active</>
                                      ) : (
                                        'Live tracking is active - map updates automatically'
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <i className="ki-duotone ki-geolocation fs-2x">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </div>
                              
                              {/* Tracking Map - Mapbox loads dynamically */}
                              <div className="position-relative">
                                <div 
                                  ref={mapContainerRef}
                                  style={{ height: '500px', width: '100%' }}
                                  className="rounded-bottom"
                                />
                                
                                {/* ETA Overlay */}
                                {trackingData?.eta && (
                                  <div className="position-absolute top-0 start-0 m-3">
                                    <div className="card shadow-lg">
                                      <div className="card-body p-3">
                                        <div className="d-flex align-items-center">
                                          <i className="ki-duotone ki-time fs-2x text-primary me-3">
                                            <span className="path1"></span>
                                            <span className="path2"></span>
                                          </i>
                                          <div>
                                            <div className="fw-bold fs-4">{trackingData.eta}</div>
                                            <div className="text-muted small">
                                              {trackingData.distance && `${trackingData.distance} miles away`}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            /* Property Information */
                            <div className="position-relative">
                    {/* Street View Image */}
                    <div className="position-relative">
                      {propertyData ? (
                        <div className="w-100 rounded-top bg-light position-relative" style={{ height: '250px' }}>
                          {/* Try to load Street View image */}
                          {propertyData.streetViewUrl ? (
                            <img
                              src={propertyData.streetViewUrl}
                              alt="Property Street View"
                              className="w-100 h-100"
                              style={{ objectFit: 'cover' }}
                              onError={(e) => {
                                // Hide image on error and show fallback
                                (e.target as HTMLImageElement).style.display = 'none'
                                const fallback = (e.target as HTMLImageElement).nextElementSibling
                                if (fallback) fallback.classList.remove('d-none')
                              }}
                            />
                          ) : null}
                          
                          {/* Fallback when no Street View or on error */}
                          <div className={`w-100 h-100 d-flex align-items-center justify-content-center ${propertyData.streetViewUrl ? 'd-none' : ''}`}>
                            <div className="text-center">
                              <i className="ki-duotone ki-home fs-5x text-primary mb-3">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <p className="text-muted">Property View</p>
                            </div>
                          </div>
                          
                          <div className="position-absolute bottom-0 start-0 end-0 bg-gradient-dark p-2 p-lg-3">
                            <h4 className="text-white fw-bold mb-1 fs-6 fs-lg-4">{propertyData.address}</h4>
                            <div className="text-light fs-7 fs-lg-6">
                              <i className="ki-duotone ki-home-2 fs-7 fs-lg-6 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              <span className="d-none d-sm-inline">{propertyData.propertyType} • </span>
                              <span>{propertyData.yearBuilt ? `Built ${propertyData.yearBuilt}` : 'Residential'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="d-flex align-items-center justify-content-center bg-light"
                          style={{ height: '250px' }}
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
                        <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 5 }}>
                          <div className="bg-white bg-opacity-90 rounded-3 p-3 p-lg-4 shadow text-center">
                            <div className="spinner-border spinner-border-sm text-primary mb-2" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mb-0 fw-bold fs-7 fs-lg-6">Activating tracking...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Property Value Overview - New Stats Card */}
                    {propertyData && (
                      <div className="p-5">
                        <PropertyStatsCard propertyData={propertyData} />
                      </div>
                    )}

                    {/* Property Details Accordion */}
                    {propertyData && (
                      <div className="accordion accordion-flush" id="propertyDetailsAccordion">

                        
                        {/* Property Features Card */}
                        {(propertyData.pool !== undefined || propertyData.centralAir !== undefined || propertyData.garageSpaces || propertyData.roofMaterial) && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="featuresHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#featuresCollapse" aria-expanded="false" aria-controls="featuresCollapse">
                                <i className="ki-duotone ki-home-2 fs-4 text-info me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Property Features</div>
                                  <div className="text-muted fs-7">Amenities and special features</div>
                                </div>
                              </button>
                            </h2>
                            <div id="featuresCollapse" className="accordion-collapse collapse" aria-labelledby="featuresHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.garageSpaces !== undefined && (
                                <div className="col-6 col-md-3">
                                  <div className="d-flex align-items-center">
                                    <i className="ki-duotone ki-car fs-2 text-primary me-2">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                      <span className="path3"></span>
                                      <span className="path4"></span>
                                      <span className="path5"></span>
                                    </i>
                                    <div>
                                      <div className="fw-semibold">{propertyData.garageSpaces}</div>
                                      <div className="text-muted fs-8">Garage Spaces</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {propertyData.pool !== undefined && (
                                <div className="col-6 col-md-3">
                                  <div className="d-flex align-items-center">
                                    <i className={`ki-duotone ki-swimming-pool fs-2 ${propertyData.pool ? 'text-info' : 'text-gray-400'} me-2`}>
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                    <div>
                                      <div className="fw-semibold">{propertyData.pool ? 'Yes' : 'No'}</div>
                                      <div className="text-muted fs-8">Pool</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {propertyData.centralAir !== undefined && (
                                <div className="col-6 col-md-3">
                                  <div className="d-flex align-items-center">
                                    <i className={`ki-duotone ki-wind fs-2 ${propertyData.centralAir ? 'text-success' : 'text-gray-400'} me-2`}>
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                    <div>
                                      <div className="fw-semibold">{propertyData.centralAir ? 'Yes' : 'No'}</div>
                                      <div className="text-muted fs-8">Central Air</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {propertyData.roofMaterial && (
                                <div className="col-6 col-md-3">
                                  <div className="d-flex align-items-center">
                                    <i className="ki-duotone ki-home-2 fs-2 text-warning me-2">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                    <div>
                                      <div className="fw-semibold text-capitalize">{propertyData.roofMaterial.toLowerCase()}</div>
                                      <div className="text-muted fs-8">Roof Type</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tax & Financial Details Card */}
                        {(propertyData.annualTaxAmount || propertyData.taxYear || propertyData.pricePerSqFt) && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="taxHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#taxCollapse" aria-expanded="false" aria-controls="taxCollapse">
                                <i className="ki-duotone ki-percentage fs-4 text-danger me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Tax & Financial Details</div>
                                  <div className="text-muted fs-7">Tax assessment and financial information</div>
                                </div>
                              </button>
                            </h2>
                            <div id="taxCollapse" className="accordion-collapse collapse" aria-labelledby="taxHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.annualTaxAmount && (
                                <div className="col-md-4">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Annual Tax:</span>
                                    <span className="fw-semibold text-danger">${propertyData.annualTaxAmount.toLocaleString()}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.taxYear && (
                                <div className="col-md-4">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Tax Year:</span>
                                    <span className="fw-semibold">{propertyData.taxYear}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.pricePerSqFt && (
                                <div className="col-md-4">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Price/Sq Ft:</span>
                                    <span className="fw-semibold">${propertyData.pricePerSqFt}</span>
                                  </div>
                                </div>
                              )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Property Details Card */}
                        {(propertyData.parcelNumber || propertyData.zoning || propertyData.subdivision || propertyData.county) && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="detailsHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#detailsCollapse" aria-expanded="false" aria-controls="detailsCollapse">
                                <i className="ki-duotone ki-document fs-4 text-primary me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Property Details</div>
                                  <div className="text-muted fs-7">Parcel, zoning, and location details</div>
                                </div>
                              </button>
                            </h2>
                            <div id="detailsCollapse" className="accordion-collapse collapse" aria-labelledby="detailsHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.parcelNumber && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Parcel Number:</span>
                                    <span className="fw-semibold">{propertyData.parcelNumber}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.attomId && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Property ID:</span>
                                    <span className="fw-semibold">{propertyData.attomId}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.zoning && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Zoning:</span>
                                    <span className="fw-semibold">{propertyData.zoning}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.subdivision && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Subdivision:</span>
                                    <span className="fw-semibold text-truncate" style={{maxWidth: '200px'}}>{propertyData.subdivision}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.county && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">County:</span>
                                    <span className="fw-semibold">{propertyData.county}</span>
                                  </div>
                                </div>
                              )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Building & Construction Card */}
                        {(propertyData.exteriorWalls || propertyData.heatingType || propertyData.coolingType || propertyData.totalRooms) && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="buildingHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#buildingCollapse" aria-expanded="false" aria-controls="buildingCollapse">
                                <i className="ki-duotone ki-wrench fs-4 text-warning me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Building & Construction</div>
                                  <div className="text-muted fs-7">Construction details and systems</div>
                                </div>
                              </button>
                            </h2>
                            <div id="buildingCollapse" className="accordion-collapse collapse" aria-labelledby="buildingHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.exteriorWalls && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Exterior Walls:</span>
                                    <span className="fw-semibold">{propertyData.exteriorWalls}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.totalRooms && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Total Rooms:</span>
                                    <span className="fw-semibold">{propertyData.totalRooms}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.heatingType && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Heating Type:</span>
                                    <span className="fw-semibold">{propertyData.heatingType}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.coolingType && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Cooling Type:</span>
                                    <span className="fw-semibold">{propertyData.coolingType}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.fireplace !== undefined && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Fireplace:</span>
                                    <span className="fw-semibold">{propertyData.fireplace ? 'Yes' : 'No'}</span>
                                  </div>
                                </div>
                              )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Ownership Information Card */}
                        {(propertyData.ownerName || propertyData.ownerOccupied !== undefined) && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="ownershipHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#ownershipCollapse" aria-expanded="false" aria-controls="ownershipCollapse">
                                <i className="ki-duotone ki-profile-circle fs-4 text-success me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                  <span className="path3"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Ownership Information</div>
                                  <div className="text-muted fs-7">Property ownership details</div>
                                </div>
                              </button>
                            </h2>
                            <div id="ownershipCollapse" className="accordion-collapse collapse" aria-labelledby="ownershipHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.ownerName && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Owner:</span>
                                    <span className="fw-semibold">{propertyData.ownerName}</span>
                                  </div>
                                </div>
                              )}
                              {propertyData.ownerOccupied !== undefined && (
                                <div className="col-md-6">
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">Owner Occupied:</span>
                                    <span className={`fw-semibold ${propertyData.ownerOccupied ? 'text-success' : 'text-warning'}`}>
                                      {propertyData.ownerOccupied ? 'Yes' : 'No'}
                                    </span>
                                  </div>
                                </div>
                              )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Price History Card */}
                        {propertyData.priceHistory && propertyData.priceHistory.length > 0 && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="priceHistoryHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#priceHistoryCollapse" aria-expanded="false" aria-controls="priceHistoryCollapse">
                                <i className="ki-duotone ki-chart-line fs-4 text-info me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Price History</div>
                                  <div className="text-muted fs-7">Historical sales and pricing data</div>
                                </div>
                              </button>
                            </h2>
                            <div id="priceHistoryCollapse" className="accordion-collapse collapse" aria-labelledby="priceHistoryHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="table-responsive">
                              <table className="table table-sm">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Price</th>
                                    <th>Price/Sq Ft</th>
                                    <th>Type</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {propertyData.priceHistory.slice(0, 5).map((history, index) => (
                                    <tr key={index}>
                                      <td>{history.sale_date ? new Date(history.sale_date).toLocaleDateString() : 'N/A'}</td>
                                      <td className="fw-semibold">${history.sale_price?.toLocaleString() || 'N/A'}</td>
                                      <td>${history.price_per_sqft || 'N/A'}</td>
                                      <td><span className="badge badge-light-primary">{history.transaction_type || 'Sale'}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Comparable Sales Card */}
                        {propertyData.comparableSales && propertyData.comparableSales.length > 0 && (
                          <div className="accordion-item">
                            <h2 className="accordion-header" id="comparablesHeading">
                              <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#comparablesCollapse" aria-expanded="false" aria-controls="comparablesCollapse">
                                <i className="ki-duotone ki-handshake fs-4 text-secondary me-3">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <div>
                                  <div className="fw-bold text-gray-900">Recent Comparable Sales</div>
                                  <div className="text-muted fs-7">Similar properties sold nearby</div>
                                </div>
                              </button>
                            </h2>
                            <div id="comparablesCollapse" className="accordion-collapse collapse" aria-labelledby="comparablesHeading" data-bs-parent="#propertyDetailsAccordion">
                              <div className="accordion-body">
                                <div className="row g-3">
                              {propertyData.comparableSales.slice(0, 3).map((comp, index) => (
                                <div key={index} className="col-12">
                                  <div className="card card-flush bg-light">
                                    <div className="card-body py-3">
                                      <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                          <div className="fw-semibold">{comp.address || 'Address N/A'}</div>
                                          <div className="text-muted fs-7">
                                            {comp.bedrooms}bd/{comp.bathrooms}ba • {comp.sqft?.toLocaleString()} sq ft • Built {comp.year_built}
                                          </div>
                                        </div>
                                        <div className="text-end">
                                          <div className="fw-bold text-success">${comp.sale_price?.toLocaleString()}</div>
                                          <div className="text-muted fs-7">
                                            {comp.sale_date ? new Date(comp.sale_date).toLocaleDateString() : 'N/A'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Data Attribution Footer */}
                        <div className="text-center p-4 bg-light">
                          <div className="text-muted fs-8">Property data powered by ATTOM Data Solutions</div>
                          {propertyData.marketValueDate && (
                            <div className="text-muted fs-8">Market value as of {new Date(propertyData.marketValueDate).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Actions */}
          <div className="col-lg-4">
            {/* Your Next Service */}
            {currentJob && (
              <div className="card shadow-sm mb-6 bg-primary">
                <div className="card-body text-white">
                  <div className="d-flex align-items-center mb-3">
                    <i className="ki-duotone ki-calendar-2 fs-2x me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                      <span className="path4"></span>
                      <span className="path5"></span>
                    </i>
                    <h6 className="text-white mb-0">Your Next Service</h6>
                  </div>
                  
                  <div className="mb-3">
                    <h5 className="text-white fw-bold mb-2">{currentJob.title}</h5>
                    <div className="d-flex align-items-center mb-2">
                      <i className="ki-duotone ki-clock fs-6 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fs-7">{formatDate(currentJob.scheduled_date)}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <i className="ki-duotone ki-profile-circle fs-6 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <span className="fs-7">
                        {currentJob.technician_name || 'Technician TBD'}
                      </span>
                    </div>
                  </div>

                  {currentJob.status === 'On The Way' && trackingData && (
                    <div className="alert alert-light-success border-0 mb-3 p-3">
                      <div className="d-flex align-items-center">
                        <i className="ki-duotone ki-geolocation fs-5 text-success me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div>
                          <div className="text-dark fs-7 fw-bold">🚐 On the way!</div>
                          <div className="text-muted fs-8">Live tracking active</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2">
                    <button 
                      className="btn btn-light btn-sm flex-fill"
                      onClick={() => setShowContactModal(true)}
                    >
                      <i className="ki-duotone ki-message-text-2 fs-5 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      Contact
                    </button>
                    <button 
                      className="btn btn-light-warning btn-sm flex-fill"
                      onClick={() => alert(`Please call us at ${tenantPhone || 'our main number'} to reschedule.`)}
                    >
                      <i className="ki-duotone ki-calendar-edit fs-5 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Reschedule
                    </button>
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
                    onClick={() => tenantPhone && window.open(`tel:${tenantPhone}`, '_self')}
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
                    {tenantPhone ? (
                      <a href={`tel:${tenantPhone}`} className="text-success fw-bold">
                        Call {tenantPhone}
                      </a>
                    ) : (
                      <span className="text-muted">Phone number not available</span>
                    )}
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
          </>
        )}

            {/* Enhanced Features when job is active */}
            {currentJob && activeSection === 'dashboard' && (
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
                    isActive={currentJob.status === 'in_progress' || currentJob.status === 'on_the_way' || currentJob.status === 'In Progress' || currentJob.status === 'On The Way'}
                  />
                </div>
              </div>
            )}

            {/* Job History Timeline */}
            {activeSection === 'dashboard' && (
              <div className="mt-8">
                <JobHistoryTimeline 
                  jobHistory={jobHistory}
                  customer={customer}
                />
              </div>
            )}

        {activeSection === 'equipment' && (
          <div className="mt-6">
            <Suspense fallback={<LoadingSpinner text="Loading equipment details..." />}>
              <DigitalTwin customerId={customerId || ''} />
            </Suspense>
          </div>
        )}

        {activeSection === 'maintenance' && (
          <div className="mt-6" id="maintenance-section">
            <Suspense fallback={<LoadingSpinner text="Loading maintenance hub..." />}>
              <MaintenanceHub 
                customerId={customerId || ''}
                customerLocation={{
                  city: customer?.city || 'Austin',
                  state: customer?.state || 'TX'
                }}
              />
            </Suspense>
          </div>
        )}

        {activeSection === 'quotes' && (
          <div className="mt-6">
            <Suspense fallback={<LoadingSpinner text="Loading quotes and plans..." />}>
              <QuotesAndPlans customerId={customerId || ''} />
            </Suspense>
          </div>
        )}

        {activeSection === 'photos' && currentJob && (
          <div className="mt-6">
            <div className="card">
              <div className="card-body">
                <Suspense fallback={<LoadingSpinner text="Loading photos..." />}>
                  <JobPhotosTab 
                    jobId={currentJob.id}
                    tenantId={currentJob.tenant_id}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'documents' && currentJob && (
          <div className="mt-6">
            <div className="card">
              <div className="card-body">
                <Suspense fallback={<LoadingSpinner text="Loading documents..." />}>
                  <DocumentsTab 
                    jobId={currentJob.id}
                    tenantId={currentJob.tenant_id}
                    contactId={customer?.id}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'referrals' && customer && (
          <div className="row g-6">
            <div className="col-12">
              <Suspense fallback={<LoadingSpinner text="Loading referral program..." />}>
                <ReferralDashboard 
                  customerId={customer.id}
                  customerName={`${customer.first_name} ${customer.last_name}`}
                  tenantId={customer.tenant_id}
                />
              </Suspense>
            </div>
          </div>
        )}

        {activeSection === 'estimates' && currentJob && (
          <div className="mt-6">
            <div className="card">
              <div className="card-body">
                <Suspense fallback={<LoadingSpinner text="Loading estimate..." />}>
                  <EstimatesTab 
                    jobId={currentJob.id}
                    tenantId={currentJob.tenant_id}
                    portalTokenId={token}
                    customerId={customer?.id}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Chat Widget - Always visible */}
      <ChatWidget />
      
      {/* Debug info for troubleshooting */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', bottom: '100px', left: '20px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px', zIndex: 10000 }}>
          <div>Current Job: {currentJob ? currentJob.id : 'None'}</div>
          <div>Job Status: {currentJob?.status || 'N/A'}</div>
          <div>Active Section: {activeSection}</div>
        </div>
      )}

      {/* Floating CTA Bar */}
      <FloatingCTABar
        tenantPhone={tenantPhone}
        onScheduleService={() => setShowSchedulingModal(true)}
        onContactTechnician={() => setShowContactModal(true)}
        onPayInvoice={() => alert('Payment portal coming soon! Please call us to pay your invoice.')}
        currentJob={currentJob}
        hasUnpaidInvoices={false} // TODO: Get real invoice status
        hasActiveEstimate={currentJob !== null} // Show estimates button when there's a current job
        onViewEstimates={() => {
          setActiveSection('estimates')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onViewPhotos={() => {
          setActiveSection('photos')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />

      {/* Service Scheduling Modal */}
      {showSchedulingModal && (
        <Suspense fallback={<LoadingSpinner text="Loading scheduler..." />}>
          <ServiceSchedulingModal
            isOpen={showSchedulingModal}
            onClose={() => setShowSchedulingModal(false)}
            customerId={customerId || ''}
            customerName={customer ? `${customer.first_name} ${customer.last_name}` : ''}
            customerPhone={customer?.phone}
            customerEmail={customer?.email}
          />
        </Suspense>
      )}

      {/* Contact Technician Modal */}
      {showContactModal && (
        <Suspense fallback={<LoadingSpinner text="Loading messenger..." />}>
          <ContactTechnicianModal
            isOpen={showContactModal}
            onClose={() => setShowContactModal(false)}
            technicianName={currentJob?.technician_name || 'Mike Rodriguez'}
            technicianPhone={tenantPhone || undefined}
            jobId={currentJob?.id}
          />
        </Suspense>
      )}
    </div>
  )
}

export default CustomerPortalPage
