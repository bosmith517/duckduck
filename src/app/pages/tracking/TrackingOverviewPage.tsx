import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import TrackingPage from './TrackingPage'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Access token will be loaded from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''

// Fleet Tracking Overview Dashboard
const FleetTrackingPage: React.FC = () => {
  const [activeTechnicians, setActiveTechnicians] = useState(0)
  const [totalJobs, setTotalJobs] = useState(0)
  const [completedToday, setCompletedToday] = useState(0)
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
    // Mock data - replace with actual API calls
    setActiveTechnicians(8)
    setTotalJobs(24)
    setCompletedToday(12)
  }, [])

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
        .addTo(map.current)
    })
  }

  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isSeparator: false}, {title: 'Fleet Tracking', path: '/tracking/overview', isSeparator: true}]}>Fleet Tracking Overview</PageTitle>
      
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
                <button 
                  className='btn btn-sm btn-light me-3'
                  onClick={() => alert('Filter functionality coming soon!')}
                >
                  <i className='ki-duotone ki-filter fs-2'>
                    <span className='path1'></span>
                    <span className='path2'></span>
                  </i>
                  Filter
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
  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isSeparator: false}, {title: 'Route Optimization', path: '/tracking/routes', isSeparator: true}]}>Route Optimization</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Route Optimization</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Optimize technician routes for maximum efficiency</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='d-flex flex-column h-400px'>
                <div className='h-100 bg-light rounded d-flex align-items-center justify-content-center'>
                  <div className='text-center'>
                    <i className='ki-duotone ki-route fs-5x text-primary mb-3'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                    </i>
                    <h4 className='text-gray-800 mb-3'>Route Optimization Tools</h4>
                    <p className='text-muted mb-4'>
                      AI-powered route optimization and scheduling tools to maximize technician efficiency and reduce travel time.
                    </p>
                    <button className='btn btn-primary me-3'>
                      <i className='ki-duotone ki-plus fs-2'></i>
                      Create Route
                    </button>
                    <button className='btn btn-light'>
                      <i className='ki-duotone ki-setting-3 fs-2'></i>
                      Settings
                    </button>
                  </div>
                </div>
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
  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isSeparator: false}, {title: 'Live Monitoring', path: '/tracking/live', isSeparator: true}]}>Live Monitoring</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Live Fleet Monitoring</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Real-time monitoring of all technician activities</span>
              </h3>
            </div>
            <KTCardBody className='py-3'>
              <div className='d-flex flex-column h-400px'>
                <div className='h-100 bg-light rounded d-flex align-items-center justify-content-center'>
                  <div className='text-center'>
                    <i className='ki-duotone ki-monitor-mobbile fs-5x text-success mb-3'>
                      <span className='path1'></span>
                      <span className='path2'></span>
                      <span className='path3'></span>
                      <span className='path4'></span>
                      <span className='path5'></span>
                    </i>
                    <h4 className='text-gray-800 mb-3'>Live Monitoring Dashboard</h4>
                    <p className='text-muted mb-4'>
                      Monitor technician locations, job status, and real-time updates from the field.
                    </p>
                    <button className='btn btn-success'>
                      <i className='ki-duotone ki-play fs-2'></i>
                      Start Monitoring
                    </button>
                  </div>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

// Technician Dispatch Page
const TechnicianDispatchPage: React.FC = () => {
  return (
    <>
      <PageTitle breadcrumbs={[{title: 'Scheduling & Dispatch', path: '/schedule', isSeparator: false}, {title: 'Technician Dispatch', path: '/tracking/dispatch', isSeparator: true}]}>Technician Dispatch</PageTitle>
      
      <div className='row g-5 g-xl-8'>
        <div className='col-xl-12'>
          <KTCard>
            <div className='card-header border-0 pt-5'>
              <h3 className='card-title align-items-start flex-column'>
                <span className='card-label fw-bold fs-3 mb-1'>Dispatch Center</span>
                <span className='text-muted mt-1 fw-semibold fs-7'>Assign jobs and manage technician availability</span>
              </h3>
              <div className='card-toolbar'>
                <button className='btn btn-sm btn-light me-3'>
                  <i className='ki-duotone ki-filter fs-2'></i>
                  Filter
                </button>
                <button className='btn btn-sm btn-primary'>
                  <i className='ki-duotone ki-plus fs-2'></i>
                  New Assignment
                </button>
              </div>
            </div>
            <KTCardBody className='py-3'>
              <div className='row g-5'>
                {/* Available Technicians */}
                <div className='col-lg-6'>
                  <h5 className='mb-4'>Available Technicians</h5>
                  <div className='d-flex flex-column gap-3'>
                    <div className='card border border-primary'>
                      <div className='card-body p-4'>
                        <div className='d-flex align-items-center justify-content-between'>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-3'>
                              <span className='symbol-label bg-light-primary text-primary fw-bold'>JD</span>
                            </div>
                            <div>
                              <div className='fw-bold text-dark'>John Doe</div>
                              <div className='text-muted fs-7'>Senior Technician</div>
                              <div className='badge badge-light-success fs-8'>Available</div>
                            </div>
                          </div>
                          <div className='text-end'>
                            <div className='text-dark fw-bold fs-6'>Skills:</div>
                            <div className='text-muted fs-7'>HVAC, Electrical</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className='card border border-primary'>
                      <div className='card-body p-4'>
                        <div className='d-flex align-items-center justify-content-between'>
                          <div className='d-flex align-items-center'>
                            <div className='symbol symbol-45px me-3'>
                              <span className='symbol-label bg-light-primary text-primary fw-bold'>SJ</span>
                            </div>
                            <div>
                              <div className='fw-bold text-dark'>Sarah Johnson</div>
                              <div className='text-muted fs-7'>Field Technician</div>
                              <div className='badge badge-light-success fs-8'>Available</div>
                            </div>
                          </div>
                          <div className='text-end'>
                            <div className='text-dark fw-bold fs-6'>Skills:</div>
                            <div className='text-muted fs-7'>Plumbing, General</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pending Jobs */}
                <div className='col-lg-6'>
                  <h5 className='mb-4'>Unassigned Jobs</h5>
                  <div className='d-flex flex-column gap-3'>
                    <div className='card border border-warning'>
                      <div className='card-body p-4'>
                        <div className='d-flex align-items-center justify-content-between mb-3'>
                          <div>
                            <div className='fw-bold text-dark'>Emergency HVAC Repair</div>
                            <div className='text-muted fs-7'>Williams Property - JOB-005</div>
                            <div className='badge badge-light-danger fs-8'>URGENT</div>
                          </div>
                          <button className='btn btn-sm btn-primary'>
                            Assign
                          </button>
                        </div>
                        <div className='text-muted fs-7'>
                          <i className='ki-duotone ki-geolocation fs-6 me-1'></i>
                          789 Pine Rd, Springfield, IL
                        </div>
                      </div>
                    </div>
                    
                    <div className='card border border-warning'>
                      <div className='card-body p-4'>
                        <div className='d-flex align-items-center justify-content-between mb-3'>
                          <div>
                            <div className='fw-bold text-dark'>Routine Maintenance</div>
                            <div className='text-muted fs-7'>Davis Home - JOB-006</div>
                            <div className='badge badge-light-warning fs-8'>SCHEDULED</div>
                          </div>
                          <button className='btn btn-sm btn-primary'>
                            Assign
                          </button>
                        </div>
                        <div className='text-muted fs-7'>
                          <i className='ki-duotone ki-geolocation fs-6 me-1'></i>
                          321 Elm St, Springfield, IL
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </KTCardBody>
          </KTCard>
        </div>
      </div>
    </>
  )
}

// Main Tracking Overview Component with Sub-routing
const TrackingOverviewPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<FleetTrackingPage />} />
      <Route path="overview" element={<FleetTrackingPage />} />
      <Route path="routes" element={<RouteOptimizationPage />} />
      <Route path="live" element={<LiveMonitoringPage />} />
      <Route path="dispatch" element={<TechnicianDispatchPage />} />
      <Route path="customer/:trackingToken" element={<TrackingPage />} />
      <Route path="*" element={<Navigate to="/tracking/overview" replace />} />
    </Routes>
  )
}

export default TrackingOverviewPage