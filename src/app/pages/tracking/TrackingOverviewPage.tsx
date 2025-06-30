import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import TrackingPage from './TrackingPage'
import DispatchPage from './DispatchPage'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Access token will be loaded from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

// Fleet Tracking Overview Dashboard
const FleetTrackingPage: React.FC = () => {
  const [activeTechnicians, setActiveTechnicians] = useState(0)
  const [totalJobs, setTotalJobs] = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
  const [realTimeUpdates, setRealTimeUpdates] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date())
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  // Business office location (this should come from company settings)
  const businessLocation = {
    lat: 39.7817, // Springfield, IL coordinates - replace with actual business location
    lng: -89.6501,
    name: 'TaurusTech Office',
    address: 'Springfield, IL'
  }

  // Mock technician locations
  const technicians = [
    {
      id: 'tech1',
      name: 'John Doe',
      lat: 39.7900,
      lng: -89.6500,
      status: 'on_route',
      job: 'Kitchen Installation'
    },
    {
      id: 'tech2',
      name: 'Mike Wilson',
      lat: 39.7750,
      lng: -89.6400,
      status: 'in_progress',
      job: 'Bathroom Renovation'
    },
    {
      id: 'tech3',
      name: 'Sarah Johnson',
      lat: 39.7850,
      lng: -89.6600,
      status: 'completed',
      job: 'Final Inspection'
    }
  ]

  useEffect(() => {
    // Initial data load
    loadFleetData()
    
    // Set up auto-refresh every 30 seconds if real-time updates are enabled
    let refreshInterval: NodeJS.Timeout
    if (realTimeUpdates) {
      refreshInterval = setInterval(() => {
        loadFleetData()
        setLastUpdateTime(new Date())
      }, 30000)
    }
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [realTimeUpdates])
  
  const loadFleetData = async () => {
    try {
      // In a real implementation, these would be actual API calls to supabase
      // For now, using mock data with some variation to simulate real-time changes
      const randomVariation = () => Math.floor(Math.random() * 3) - 1 // -1, 0, or 1
      
      setActiveTechnicians(8 + randomVariation())
      setTotalJobs(24 + randomVariation())
      setCompletedToday(12 + Math.max(0, randomVariation()))
      
      // Update technician locations on map
      if (map.current) {
        updateTechnicianMarkers()
      }
    } catch (error) {
      console.error('Error loading fleet data:', error)
    }
  }
  
  const updateTechnicianMarkers = () => {
    // In a real implementation, this would fetch live technician locations
    // and update markers with new positions
    console.log('Updating technician positions...')
  }

  useEffect(() => {
    initializeFleetMap()
    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  const initializeFleetMap = () => {
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
              <h4 class="text-gray-800 mb-3">Map Configuration Required</h4>
              <p class="text-muted mb-4">
                Please configure your Mapbox API token in environment variables to enable live tracking.
              </p>
              <div class="badge badge-light-warning">VITE_MAPBOX_ACCESS_TOKEN required</div>
            </div>
          </div>
        `
      }
      return
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [businessLocation.lng, businessLocation.lat],
        zoom: 11,
        pitch: 45, // 3D tilt for fleet overview
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
          // Add technician markers
          addTechnicianMarkers()
        }
      })

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    } catch (error) {
      console.error('Error initializing fleet map:', error)
    }
  }

  const addOfficeMarker = () => {
    if (!map.current) return

    // Create office marker
    const officeEl = document.createElement('div')
    officeEl.className = 'office-marker'
    officeEl.innerHTML = '<i class="ki-duotone ki-home-2 fs-4 text-primary"><span class="path1"></span><span class="path2"></span></i>'

    new mapboxgl.Marker(officeEl)
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

  const addTechnicianMarkers = () => {
    if (!map.current) return

    technicians.forEach(tech => {
      // Create technician marker
      const techEl = document.createElement('div')
      techEl.className = `technician-marker ${tech.status}`
      
      let iconClass = 'ki-truck'
      let statusColor = 'success'
      if (tech.status === 'on_route') {
        statusColor = 'warning'
      } else if (tech.status === 'in_progress') {
        statusColor = 'primary'
      } else if (tech.status === 'completed') {
        statusColor = 'success'
      }
      
      techEl.innerHTML = `<i class="ki-duotone ${iconClass} fs-5 text-${statusColor}"><span class="path1"></span><span class="path2"></span></i>`

      new mapboxgl.Marker(techEl)
        .setLngLat([tech.lng, tech.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-3">
                <h6 class="mb-1">${tech.name}</h6>
                <p class="mb-1 text-muted">${tech.job}</p>
                <span class="badge badge-light-${statusColor} fs-8">${tech.status.replace('_', ' ').toUpperCase()}</span>
              </div>
            `)
        )
        .addTo(map.current!)
    })
  }

  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isActive: false, isSeparator: false}, {title: 'Fleet Tracking', path: '/tracking/overview', isActive: true, isSeparator: true}]}>Fleet Tracking Overview</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        {/* Stats Cards */}
        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-success'>
                    <i className='ki-duotone ki-truck fs-2x text-success'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                      <span className='path4'></span>
                      <span className='path5'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>{activeTechnicians}</span>
                        <span className='badge badge-light-success fs-base'>
                          <i className='ki-duotone ki-arrow-up fs-5 text-success me-1'></i>
                          Live
                        </span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Active Technicians</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-primary'>
                    <i className='ki-duotone ki-briefcase fs-2x text-primary'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>{totalJobs}</span>
                        <span className='badge badge-light-primary fs-base'>Today</span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Scheduled Jobs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-warning'>
                    <i className='ki-duotone ki-check-circle fs-2x text-warning'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>{completedToday}</span>
                        <span className='badge badge-light-warning fs-base'>
                          {Math.round((completedToday / totalJobs) * 100)}%
                        </span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Completed Today</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Fleet Map */}
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Live Fleet Tracking</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Real-time technician locations and job progress</span>
              </h3>
              <div className='card-toolbar'>
                <div className='d-flex align-items-center gap-2'>
                  <span className='text-muted fs-8 me-3'>Last updated: {lastUpdateTime.toLocaleTimeString()}</span>
                  
                  <button 
                    className={`btn btn-sm ${realTimeUpdates ? 'btn-success' : 'btn-light'} me-2`}
                    onClick={() => setRealTimeUpdates(!realTimeUpdates)}
                    title={realTimeUpdates ? 'Real-time updates ON' : 'Real-time updates OFF'}
                  >
                    <i className={`ki-duotone ${realTimeUpdates ? 'ki-pulse' : 'ki-pause'} fs-2`}>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    {realTimeUpdates ? 'Live' : 'Paused'}
                  </button>
                  
                  <button 
                    className='btn btn-sm btn-light me-3'
                    onClick={loadFleetData}
                    title='Refresh now'
                  >
                    <i className='ki-duotone ki-refresh fs-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Refresh
                  </button>
                  
                  <button 
                    className='btn btn-sm btn-primary'
                    onClick={() => alert('Add Technician functionality coming soon!')}
                  >
                    <i className='ki-duotone ki-plus fs-2'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    Add Technician
                  </button>
                </div>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='d-flex flex-column h-500px'>
                <div 
                  ref={mapContainer} 
                  className='h-100 rounded'
                  style={{ width: '100%' }}
                />
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Technician Status Table */}
      <div className='row g-5 g-xl-8 mt-5'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Technician Status</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Current status and location of all technicians</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th>Technician</th>
                      <th>Status</th>
                      <th>Current Job</th>
                      <th>Location</th>
                      <th>Last Update</th>
                      <th className='text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-45px me-5'>
                            <span className='symbol-label bg-light-primary text-primary fw-bold'>JD</span>
                          </div>
                          <div className='d-flex justify-content-start flex-column'>
                            <span className='text-dark fw-bold text-hover-primary fs-6'>John Doe</span>
                            <span className='text-muted fw-semibold text-muted d-block fs-7'>Senior Technician</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className='badge badge-light-success'>On Route</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>Kitchen Installation</span>
                        <span className='text-muted fw-semibold fs-7'>JOB-001</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>Springfield, IL</span>
                        <span className='text-muted fw-semibold fs-7'>2.3 miles from job site</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>2 min ago</span>
                      </td>
                      <td className='text-end'>
                        <button 
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                          title='View Location'
                          onClick={() => alert('View technician location on map')}
                        >
                          <i className='ki-duotone ki-geolocation fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button 
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                          title='Send Message'
                          onClick={() => alert('Send message to technician')}
                        >
                          <i className='ki-duotone ki-message-text-2 fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                          </i>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <div className='d-flex align-items-center'>
                          <div className='symbol symbol-45px me-5'>
                            <span className='symbol-label bg-light-warning text-warning fw-bold'>MW</span>
                          </div>
                          <div className='d-flex justify-content-start flex-column'>
                            <span className='text-dark fw-bold text-hover-primary fs-6'>Mike Wilson</span>
                            <span className='text-muted fw-semibold text-muted d-block fs-7'>Field Technician</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className='badge badge-light-warning'>In Progress</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>Bathroom Renovation</span>
                        <span className='text-muted fw-semibold fs-7'>JOB-002</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>Oak Street, Springfield</span>
                        <span className='text-muted fw-semibold fs-7'>On site</span>
                      </td>
                      <td>
                        <span className='text-dark fw-bold d-block fs-6'>5 min ago</span>
                      </td>
                      <td className='text-end'>
                        <button 
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                          title='View Location'
                          onClick={() => alert('View technician location on map')}
                        >
                          <i className='ki-duotone ki-geolocation fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button 
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                          title='Send Message'
                          onClick={() => alert('Send message to technician')}
                        >
                          <i className='ki-duotone ki-message-text-2 fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                          </i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>

      {/* Map Styles */}
      <style>{`
        .mapboxgl-popup {
          max-width: 300px;
        }
        
        .office-marker {
          cursor: pointer;
          width: 40px;
          height: 40px;
          padding: 6px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          border: 2px solid #009ef7;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .technician-marker {
          cursor: pointer;
          width: 35px;
          height: 35px;
          padding: 5px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .technician-marker.on_route {
          border: 3px solid #ffc700;
          animation: pulse-warning 2s infinite;
        }
        
        .technician-marker.in_progress {
          border: 3px solid #009ef7;
          animation: pulse-primary 2s infinite;
        }
        
        .technician-marker.completed {
          border: 3px solid #50cd89;
        }
        
        @keyframes pulse-warning {
          0% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 4px 16px rgba(255, 199, 0, 0.4);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
        }
        
        @keyframes pulse-primary {
          0% {
            transform: scale(1);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 4px 16px rgba(0, 158, 247, 0.4);
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
    </>
  )
}

// Route Optimization Page
const RouteOptimizationPage: React.FC = () => {
  const [optimizedRoutes, setOptimizedRoutes] = useState([
    {
      id: 'route-1',
      technician: 'John Doe',
      jobs: ['Kitchen Installation', 'Bathroom Repair', 'HVAC Maintenance'],
      totalDistance: '32.4 miles',
      estimatedTime: '6.5 hours',
      efficiency: 92
    },
    {
      id: 'route-2',
      technician: 'Sarah Johnson',
      jobs: ['Plumbing Repair', 'General Inspection'],
      totalDistance: '18.7 miles',
      estimatedTime: '4.2 hours',
      efficiency: 88
    }
  ])

  const handleOptimizeRoutes = () => {
    alert('Route optimization algorithm would run here. This feature integrates with mapping services to calculate optimal routes.')
  }

  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isActive: false, isSeparator: false}, {title: 'Route Optimization', path: '/tracking/routes', isActive: true, isSeparator: true}]}>Route Optimization</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        {/* Route Statistics */}
        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-primary'>
                    <i className='ki-duotone ki-route fs-2x text-primary'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>51.1</span>
                        <span className='badge badge-light-success fs-base'>miles</span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Total Distance Today</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-success'>
                    <i className='ki-duotone ki-time fs-2x text-success'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>2.3</span>
                        <span className='badge badge-light-success fs-base'>hours saved</span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Time Optimization</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='col-xl-4'>
          <div className='card card-xl-stretch mb-xl-8'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-warning'>
                    <i className='ki-duotone ki-chart-line-up fs-2x text-warning'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                  </span>
                </div>
                <div className='flex-grow-1'>
                  <div className='d-flex justify-content-between align-items-start flex-wrap mb-2'>
                    <div className='d-flex flex-column'>
                      <div className='d-flex align-items-center mb-2'>
                        <span className='text-gray-900 fs-3 fw-bold me-2'>90%</span>
                        <span className='badge badge-light-warning fs-base'>efficiency</span>
                      </div>
                      <span className='text-gray-500 fs-6 fw-semibold'>Route Efficiency</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Optimized Routes</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>AI-generated optimal routes for today's technicians</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-light me-3'>
                  <i className='ki-duotone ki-setting-3 fs-2'></i>
                  Settings
                </button>
                <button className='btn btn-sm btn-primary' onClick={handleOptimizeRoutes}>
                  <i className='ki-duotone ki-abstract-14 fs-2'></i>
                  Optimize Routes
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='table-responsive'>
                <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                  <thead>
                    <tr className='fw-bold text-muted'>
                      <th>Technician</th>
                      <th>Jobs</th>
                      <th>Distance</th>
                      <th>Estimated Time</th>
                      <th>Efficiency</th>
                      <th className='text-end'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizedRoutes.map((route) => (
                      <tr key={route.id}>
                        <td>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-5'>
                              <span className='symbol-label bg-light-primary text-primary fw-bold'>
                                {route.technician.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className='d-flex justify-content-start flex-column'>
                              <span className='text-dark fw-bold text-hover-primary fs-6'>
                                {route.technician}
                              </span>
                              <span className='text-muted fw-semibold text-muted d-block fs-7'>
                                Route #{route.id.split('-')[1]}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex flex-column'>
                            {route.jobs.map((job, index) => (
                              <span key={index} className='text-dark fw-bold fs-6'>
                                {job}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {route.totalDistance}
                          </span>
                        </td>
                        <td>
                          <span className='text-dark fw-bold d-block fs-6'>
                            {route.estimatedTime}
                          </span>
                        </td>
                        <td>
                          <div className='d-flex align-items-center'>
                            <span className='text-dark fw-bold fs-6 me-2'>{route.efficiency}%</span>
                            <div className='progress h-6px w-100px bg-light-success'>
                              <div 
                                className='progress-bar bg-success' 
                                style={{width: `${route.efficiency}%`}}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className='d-flex justify-content-end flex-shrink-0'>
                            <button className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'>
                              <i className='ki-duotone ki-eye fs-3'></i>
                            </button>
                            <button className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'>
                              <i className='ki-duotone ki-pencil fs-3'></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

// Live Monitoring Page
const LiveMonitoringPage: React.FC = () => {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [liveActivities] = useState([
    {
      id: '1',
      technician: 'John Doe',
      activity: 'Arrived at job site',
      location: '123 Main St, Springfield',
      timestamp: new Date(Date.now() - 5 * 60000), // 5 minutes ago
      status: 'on_site'
    },
    {
      id: '2',
      technician: 'Sarah Johnson',
      activity: 'Completed job - Kitchen Installation',
      location: '456 Oak Ave, Springfield',
      timestamp: new Date(Date.now() - 15 * 60000), // 15 minutes ago
      status: 'completed'
    },
    {
      id: '3',
      technician: 'Mike Wilson',
      activity: 'En route to next job',
      location: 'Highway 55 North',
      timestamp: new Date(Date.now() - 3 * 60000), // 3 minutes ago
      status: 'traveling'
    }
  ])

  const getTimeAgo = (timestamp: Date) => {
    const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1 minute ago'
    return `${minutes} minutes ago`
  }

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'on_site':
        return 'ki-geolocation text-success'
      case 'completed':
        return 'ki-check-circle text-primary'
      case 'traveling':
        return 'ki-truck text-warning'
      default:
        return 'ki-information text-info'
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isActive: false, isSeparator: false}, {title: 'Live Monitoring', path: '/tracking/live', isActive: true, isSeparator: true}]}>Live Monitoring</PageTitle>
      
      {/* Live Stats */}
      <div className='row g-5 g-xl-8 mb-5'>
        <div className='col-xl-3'>
          <div className='card card-xl-stretch'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-success'>
                    <i className='ki-duotone ki-profile-user fs-2x text-success'></i>
                  </span>
                </div>
                <div>
                  <div className='fs-3 fw-bold text-dark'>8</div>
                  <div className='fs-7 fw-semibold text-muted'>Active Technicians</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-primary'>
                    <i className='ki-duotone ki-abstract-26 fs-2x text-primary'></i>
                  </span>
                </div>
                <div>
                  <div className='fs-3 fw-bold text-dark'>24</div>
                  <div className='fs-7 fw-semibold text-muted'>Jobs in Progress</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-warning'>
                    <i className='ki-duotone ki-timer fs-2x text-warning'></i>
                  </span>
                </div>
                <div>
                  <div className='fs-3 fw-bold text-dark'>3</div>
                  <div className='fs-7 fw-semibold text-muted'>Urgent Jobs</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className='col-xl-3'>
          <div className='card card-xl-stretch'>
            <div className='card-body'>
              <div className='d-flex align-items-center'>
                <div className='symbol symbol-50px me-5'>
                  <span className='symbol-label bg-light-info'>
                    <i className='ki-duotone ki-pulse fs-2x text-info'></i>
                  </span>
                </div>
                <div>
                  <div className='fs-3 fw-bold text-dark'>98%</div>
                  <div className='fs-7 fw-semibold text-muted'>System Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Live Activity Feed</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Real-time technician activities and job updates</span>
              </h3>
              <div className='card-toolbar'>
                <button 
                  className={`btn btn-sm ${isMonitoring ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => setIsMonitoring(!isMonitoring)}
                >
                  <i className={`ki-duotone ${isMonitoring ? 'ki-cross-square' : 'ki-play'} fs-2`}></i>
                  {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              {isMonitoring && (
                <div className='alert alert-success d-flex align-items-center p-5 mb-5'>
                  <div className='d-flex flex-column'>
                    <h5 className='mb-1'>Live Monitoring Active</h5>
                    <span>Real-time updates are being received from field technicians</span>
                  </div>
                  <div className='ms-auto'>
                    <div className='spinner-border spinner-border-sm text-success' role='status'>
                      <span className='visually-hidden'>Loading...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className='timeline timeline-border-dashed'>
                {liveActivities.map((activity, index) => (
                  <div key={activity.id} className='timeline-item'>
                    <div className='timeline-line w-40px'></div>
                    
                    <div className='timeline-icon symbol symbol-circle symbol-40px'>
                      <div className='symbol-label bg-light'>
                        <i className={`ki-duotone ${getActivityIcon(activity.status)} fs-2`}></i>
                      </div>
                    </div>
                    
                    <div className='timeline-content mb-10 mt-n1'>
                      <div className='pe-3 mb-5'>
                        <div className='fs-5 fw-semibold mb-2'>{activity.activity}</div>
                        
                        <div className='d-flex align-items-center mt-1 fs-6'>
                          <div className='text-muted me-2'>
                            <i className='ki-duotone ki-profile-circle fs-7 me-1'></i>
                            {activity.technician}
                          </div>
                          
                          <div className='text-muted me-2'>
                            <i className='ki-duotone ki-geolocation fs-7 me-1'></i>
                            {activity.location}
                          </div>
                          
                          <div className='text-muted'>
                            <i className='ki-duotone ki-time fs-7 me-1'></i>
                            {getTimeAgo(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {!isMonitoring && (
                <div className='text-center py-5'>
                  <i className='ki-duotone ki-monitor-mobbile fs-5x text-muted mb-3'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                    <span className='path3'></span>
                    <span className='path4'></span>
                    <span className='path5'></span>
                  </i>
                  <h4 className='text-gray-800 mb-3'>Start Live Monitoring</h4>
                  <p className='text-muted mb-4'>
                    Click "Start Monitoring" to begin receiving real-time updates from technicians in the field.
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

// Legacy Technician Dispatch Page - Redirected to new DispatchPage
const TechnicianDispatchPage: React.FC = () => {
  return <Navigate to='/tracking/dispatch' replace />
}

// Main Tracking Overview Component with Sub-routing
const TrackingOverviewPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<FleetTrackingPage />} />
      <Route path="overview" element={<FleetTrackingPage />} />
      <Route path="routes" element={<RouteOptimizationPage />} />
      <Route path="live" element={<LiveMonitoringPage />} />
      <Route path="dispatch" element={<DispatchPage />} />
      <Route path="customer/:trackingToken" element={<TrackingPage />} />
      <Route path="*" element={<Navigate to="/tracking/overview" replace />} />
    </Routes>
  )
}

export default TrackingOverviewPage