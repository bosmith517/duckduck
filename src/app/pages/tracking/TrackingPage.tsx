import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { trackingService, TrackingLocation } from '../../services/trackingService'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Access token will be loaded from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

interface BusinessLocation {
  lat: number
  lng: number
  name: string
  address: string
}
const TrackingPage: React.FC = () => {
  const { trackingToken } = useParams<{ trackingToken: string }>()
  const [location, setLocation] = useState<TrackingLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const technicianMarker = useRef<mapboxgl.Marker | null>(null)
  const officeMarker = useRef<mapboxgl.Marker | null>(null)

  // Business office location (this should come from your company settings)
  const businessLocation: BusinessLocation = {
    lat: 39.7817, // Springfield, IL coordinates - replace with actual business location
    lng: -89.6501,
    name: 'TaurusTech Office',
    address: 'Springfield, IL'
  }

  useEffect(() => {
    if (trackingToken) {
      fetchInitialLocation()
      startLocationUpdates()
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      if (map.current) {
        map.current.remove()
      }
    }
  }, [trackingToken])

  useEffect(() => {
    initializeMap()
  }, [])

  useEffect(() => {
    if (location && map.current) {
      updateTechnicianLocation()
    }
  }, [location])

  const initializeMap = () => {
    if (!mapContainer.current || map.current) return

    // Check if Mapbox token is available
    if (!mapboxgl.accessToken) {
      // Show placeholder if no token available
      if (mapContainer.current) {
        mapContainer.current.innerHTML = `
          <div class="h-100 bg-light rounded d-flex align-items-center justify-content-center">
            <div class="text-center">
              <i class="ki-duotone ki-geolocation fs-5x text-primary mb-3">
                <span class="path1"></span>
                <span class="path2"></span>
              </i>
              <h4 class="text-gray-800 mb-3">Live Tracking Unavailable</h4>
              <p class="text-muted mb-4">
                Map services are temporarily unavailable. Please check back later.
              </p>
            </div>
          </div>
        `
      }
      return
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12', // 3D street style
        center: [businessLocation.lng, businessLocation.lat],
        zoom: 12,
        pitch: 60, // 3D tilt
        bearing: 0,
        collectResourceTiming: false // Disable analytics to reduce console noise
      })

      map.current.on('load', () => {
        // Add 3D buildings layer
        if (map.current) {
          map.current.addLayer({
            id: 'add-3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 15,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15,
                0,
                15.05,
                ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15,
                0,
                15.05,
                ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 0.6
            }
          })

          // Add office marker
          addOfficeMarker()
        }
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    } catch (error) {
      console.error('Error initializing map:', error)
      setError('Failed to initialize map. Please check your internet connection.')
    }
  }

  const addOfficeMarker = () => {
    if (!map.current) return

    // Create office marker
    const officeEl = document.createElement('div')
    officeEl.className = 'office-marker'
    officeEl.innerHTML = '<i class="ki-duotone ki-home-2 fs-2x text-primary"></i>'

    officeMarker.current = new mapboxgl.Marker(officeEl)
      .setLngLat([businessLocation.lng, businessLocation.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-3">
              <h6 class="mb-1">${businessLocation.name}</h6>
              <p class="mb-0 text-muted">${businessLocation.address}</p>
            </div>
          `)
      )
      .addTo(map.current)
  }

  const updateTechnicianLocation = () => {
    if (!map.current || !location) return

    // Remove existing technician marker
    if (technicianMarker.current) {
      technicianMarker.current.remove()
    }

    // Create technician marker
    const techEl = document.createElement('div')
    techEl.className = 'technician-marker'
    techEl.innerHTML = '<i class="ki-duotone ki-geolocation fs-2x text-success"></i>'

    technicianMarker.current = new mapboxgl.Marker(techEl)
      .setLngLat([location.longitude, location.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(`
            <div class="p-3">
              <h6 class="mb-1">Technician Location</h6>
              <p class="mb-1"><strong>Coordinates:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
              <p class="mb-0 text-muted"><strong>Last Update:</strong> ${formatTime(location.timestamp)}</p>
            </div>
          `)
      )
      .addTo(map.current)

    // Fit map to show both office and technician
    const bounds = new mapboxgl.LngLatBounds()
    bounds.extend([businessLocation.lng, businessLocation.lat])
    bounds.extend([location.longitude, location.latitude])
    
    map.current.fitBounds(bounds, {
      padding: 100,
      maxZoom: 15
    })
  }

  const fetchInitialLocation = async () => {
    if (!trackingToken) return

    try {
      setLoading(true)
      const locationData = await trackingService.getTrackingLocation(trackingToken)
      
      if (locationData) {
        setLocation(locationData)
        setError(null)
      } else {
        setError('Tracking session not found')
        setIsExpired(true)
      }
    } catch (error: any) {
      console.error('Error fetching location:', error)
      if (error.message.includes('expired') || error.message.includes('not found')) {
        setIsExpired(true)
        setError('This tracking link has expired or is no longer valid.')
      } else {
        setError('Unable to load tracking information. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  const startLocationUpdates = () => {
    // Update location every 15 seconds
    updateIntervalRef.current = setInterval(async () => {
      if (!trackingToken || isExpired) return

      try {
        const locationData = await trackingService.getTrackingLocation(trackingToken)
        
        if (locationData) {
          setLocation(locationData)
          setError(null)
        } else {
          // Tracking session ended
          setIsExpired(true)
          setError('Tracking session has ended.')
          if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current)
          }
        }
      } catch (error: any) {
        console.error('Error updating location:', error)
        if (error.message.includes('expired') || error.message.includes('not found')) {
          setIsExpired(true)
          setError('This tracking link has expired.')
          if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current)
          }
        }
      }
    }, 15000) // 15 seconds
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-light'>
        <div className='text-center'>
          <div className='spinner-border text-primary mb-3' role='status' style={{ width: '3rem', height: '3rem' }}>
            <span className='visually-hidden'>Loading...</span>
          </div>
          <h4 className='text-muted'>Loading tracking information...</h4>
        </div>
      </div>
    )
  }

  if (isExpired || error) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-light'>
        <div className='text-center'>
          <div className='mb-4'>
            <i className='ki-duotone ki-information fs-3x text-warning mb-3'>
              <span className='path1'></span>
              <span className='path2'></span>
              <span className='path3'></span>
            </i>
          </div>
          <h3 className='text-dark mb-3'>Tracking Unavailable</h3>
          <p className='text-muted fs-5 mb-4'>
            {error || 'This tracking link has expired or is no longer valid.'}
          </p>
          <div className='text-muted fs-6'>
            If you need assistance, please contact your service provider directly.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-vh-100 bg-light'>
      {/* Header */}
      <div className='bg-white shadow-sm border-bottom'>
        <div className='container py-4'>
          <div className='d-flex align-items-center'>
            <div className='symbol symbol-50px me-3'>
              <span className='symbol-label bg-primary'>
                <i className='ki-duotone ki-geolocation fs-2x text-white'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
              </span>
            </div>
            <div>
              <h2 className='mb-0 text-dark'>Technician Tracking</h2>
              <p className='text-muted mb-0'>Live location updates</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className='container-fluid p-0'>
        <div className='position-relative' style={{ height: 'calc(100vh - 120px)' }}>
          <div 
            ref={mapContainer} 
            className='h-100'
            style={{ width: '100%' }}
          />
          
          {!location && !loading && (
            <div className='position-absolute top-50 start-50 translate-middle text-center'>
              <div className='bg-white rounded shadow p-4'>
                <div className='spinner-border text-primary mb-3' role='status'>
                  <span className='visually-hidden'>Loading location...</span>
                </div>
                <h5 className='text-muted'>Waiting for location data...</h5>
              </div>
            </div>
          )}

          {/* Status Card */}
          {location && (
            <div className='position-absolute top-0 start-0 m-3'>
              <div className='card shadow-sm' style={{ minWidth: '250px' }}>
                <div className='card-body p-3'>
                  <div className='d-flex align-items-center mb-2'>
                    <div className='symbol symbol-30px me-2'>
                      <span className='symbol-label bg-success'>
                        <i className='ki-duotone ki-truck fs-5 text-white'>
                          <span className='path1'></span>
                          <span className='path2'></span>
                          <span className='path3'></span>
                          <span className='path4'></span>
                          <span className='path5'></span>
                        </i>
                      </span>
                    </div>
                    <div>
                      <div className='fw-bold text-dark fs-6'>Your Technician</div>
                      <div className='text-muted fs-7'>is on the way</div>
                    </div>
                  </div>
                  <div className='separator my-2'></div>
                  <div className='d-flex justify-content-between align-items-center'>
                    <span className='text-muted fs-7'>Last Update:</span>
                    <span className='fw-bold fs-7'>{formatTime(location.timestamp)}</span>
                  </div>
                  <div className='mt-2'>
                    <div className='d-flex align-items-center'>
                      <div className='bullet bullet-dot bg-success me-2'></div>
                      <span className='text-success fs-7 fw-bold'>Live Tracking Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className='bg-white border-top py-3'>
        <div className='container'>
          <div className='text-center text-muted fs-7'>
            This page updates automatically every 15 seconds
          </div>
        </div>
      </div>

      {/* Map Styles */}
      <style>{`
        .mapboxgl-popup {
          max-width: 300px;
        }
        
        .office-marker {
          cursor: pointer;
          padding: 8px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          border: 3px solid #007bff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .technician-marker {
          cursor: pointer;
          padding: 8px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          border: 3px solid #28a745;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.4);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
        }
        
        .mapboxgl-ctrl-group {
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        .mapboxgl-popup-content {
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  )
}

export { TrackingPage as default }
