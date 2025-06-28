import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { trackingService, TrackingLocation } from '../../services/trackingService'

// Simple map component using basic HTML5 geolocation and a placeholder map
const TrackingPage: React.FC = () => {
  const { trackingToken } = useParams<{ trackingToken: string }>()
  const [location, setLocation] = useState<TrackingLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (trackingToken) {
      fetchInitialLocation()
      startLocationUpdates()
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [trackingToken])

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
          {location ? (
            <div className='h-100 d-flex align-items-center justify-content-center bg-secondary'>
              {/* Placeholder for map - In a real implementation, you would integrate with Google Maps, Mapbox, or Leaflet */}
              <div className='text-center text-white'>
                <div className='mb-4'>
                  <i className='ki-duotone ki-geolocation fs-5x text-white mb-3'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                </div>
                <h3 className='text-white mb-3'>Technician Location</h3>
                <div className='bg-white bg-opacity-10 rounded p-4 d-inline-block'>
                  <div className='text-white fs-5 mb-2'>
                    <strong>Latitude:</strong> {location.latitude.toFixed(6)}
                  </div>
                  <div className='text-white fs-5 mb-2'>
                    <strong>Longitude:</strong> {location.longitude.toFixed(6)}
                  </div>
                  <div className='text-white fs-6'>
                    <strong>Last Updated:</strong> {formatTime(location.timestamp)}
                  </div>
                </div>
                <div className='mt-4'>
                  <div className='badge badge-success fs-6 px-3 py-2'>
                    <i className='ki-duotone ki-check fs-3 me-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Technician is on the way
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className='h-100 d-flex align-items-center justify-content-center bg-light'>
              <div className='text-center'>
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
    </div>
  )
}

export default TrackingPage
