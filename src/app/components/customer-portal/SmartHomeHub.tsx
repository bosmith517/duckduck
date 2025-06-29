import React, { useState, useEffect } from 'react'
import { smartDeviceService, SmartDevice } from '../../services/smartDeviceService'

interface SmartHomeHubProps {
  customerId: string
}

export const SmartHomeHub: React.FC<SmartHomeHubProps> = ({ customerId }) => {
  const [devices, setDevices] = useState<SmartDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'devices' | 'energy' | 'automation'>('devices')
  const [selectedDevice, setSelectedDevice] = useState<SmartDevice | null>(null)

  useEffect(() => {
    loadSmartDevices()
  }, [customerId])

  const loadSmartDevices = async () => {
    setLoading(true)
    try {
      // Try to load real devices first, fallback to mock data
      const realDevices = await smartDeviceService.getCustomerDevices(customerId)
      
      if (realDevices.length > 0) {
        setDevices(realDevices)
      } else {
        // Use mock data when no real devices are found
        const mockDevices = smartDeviceService.getMockSmartDevices(customerId)
        setDevices(mockDevices)
      }
    } catch (error) {
      console.error('Error loading smart devices:', error)
      // Fallback to mock data on error
      const mockDevices = smartDeviceService.getMockSmartDevices(customerId)
      setDevices(mockDevices)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'thermostat': return 'home-2'
      case 'doorbell': return 'security-user'
      case 'smart_sensor': return 'abstract-14'
      case 'smart_lock': return 'lock'
      case 'smart_light': return 'sun'
      case 'security_camera': return 'eye'
      default: return 'technology-2'
    }
  }

  const getStatusColor = (isOnline: boolean, efficiency?: number) => {
    if (!isOnline) return 'danger'
    if (efficiency && efficiency >= 90) return 'success'
    if (efficiency && efficiency >= 75) return 'primary'
    return 'warning'
  }

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const handleDeviceControl = async (device: SmartDevice, command: string, params: any) => {
    try {
      const success = await smartDeviceService.controlDevice(device.id, command, params)
      if (success) {
        // Refresh device data
        loadSmartDevices()
      }
    } catch (error) {
      console.error('Error controlling device:', error)
    }
  }

  if (loading) {
    return (
      <div className="card card-flush">
        <div className="card-body text-center py-10">
          <div className="spinner-border text-primary mb-3"></div>
          <p className="text-muted">Discovering your smart devices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">
            <i className="ki-duotone ki-technology-4 fs-3 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Smart Home Integration
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Monitor and control your connected devices for optimal performance
          </span>
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'devices' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('devices') }}
              >
                <i className="ki-duotone ki-technology-2 fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Devices
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'energy' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('energy') }}
              >
                <i className="ki-duotone ki-electricity fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                  <span className="path4"></span>
                  <span className="path5"></span>
                </i>
                Energy
              </a>
            </li>
            <li className="nav-item">
              <a 
                className={`nav-link ${activeTab === 'automation' ? 'active' : ''}`}
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('automation') }}
              >
                <i className="ki-duotone ki-setting-3 fs-5 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Automation
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-body">
        {activeTab === 'devices' && (
          <div>
            {devices.length === 0 ? (
              <div className="text-center py-10">
                <i className="ki-duotone ki-technology-4 fs-4x text-muted mb-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <h4 className="text-dark mb-3">No Smart Devices Found</h4>
                <p className="text-muted fs-5 mb-5">
                  Connect your smart home devices to monitor performance and get maintenance alerts.
                </p>
                <button className="btn btn-primary">
                  <i className="ki-duotone ki-plus fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Add Smart Device
                </button>
              </div>
            ) : (
              <>
                {/* Device Grid */}
                <div className="row g-4">
                  {devices.map((device) => {
                    const deviceIcon = getDeviceIcon(device.deviceType)
                    const statusColor = getStatusColor(device.isOnline, device.efficiency)

                    return (
                      <div key={device.id} className="col-lg-6">
                        <div className="card border-light h-100">
                          <div className="card-body p-5">
                            <div className="d-flex align-items-center mb-4">
                              <div className={`symbol symbol-50px bg-light-${statusColor} me-4`}>
                                <span className="symbol-label">
                                  <i className={`ki-duotone ki-${deviceIcon} fs-2x text-${statusColor}`}>
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                    {['technology-4', 'abstract-14'].includes(deviceIcon) && <span className="path3"></span>}
                                  </i>
                                </span>
                              </div>
                              <div className="flex-grow-1">
                                <h5 className="text-dark fw-bold mb-1">{device.name}</h5>
                                <div className="text-muted fs-6">{device.brand} {device.model}</div>
                                <div className="d-flex align-items-center mt-1">
                                  <span className={`badge badge-light-${statusColor} me-2`}>
                                    {device.isOnline ? 'Online' : 'Offline'}
                                  </span>
                                  {device.efficiency && (
                                    <span className="text-muted fs-7">{device.efficiency}% efficient</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Device Status */}
                            <div className="mb-4">
                              {device.deviceType === 'thermostat' && (
                                <div className="row g-3">
                                  <div className="col-6">
                                    <div className="bg-light-info p-3 rounded text-center">
                                      <div className="fw-bold text-dark fs-4">{device.currentStatus.temperature}°</div>
                                      <div className="text-muted fs-8">Current</div>
                                    </div>
                                  </div>
                                  <div className="col-6">
                                    <div className="bg-light-primary p-3 rounded text-center">
                                      <div className="fw-bold text-dark fs-4">{device.currentStatus.targetTemperature}°</div>
                                      <div className="text-muted fs-8">Target</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {device.deviceType === 'doorbell' && (
                                <div className="row g-3">
                                  <div className="col-6">
                                    <div className="bg-light-success p-3 rounded text-center">
                                      <div className="fw-bold text-dark fs-4">{device.currentStatus.batteryLevel}%</div>
                                      <div className="text-muted fs-8">Battery</div>
                                    </div>
                                  </div>
                                  <div className="col-6">
                                    <div className="bg-light-warning p-3 rounded text-center">
                                      <div className="fw-bold text-dark fs-4">
                                        {device.currentStatus.motionDetected ? 'Yes' : 'No'}
                                      </div>
                                      <div className="text-muted fs-8">Motion</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {device.deviceType === 'smart_sensor' && (
                                <div className="row g-3">
                                  <div className="col-4">
                                    <div className="bg-light-info p-2 rounded text-center">
                                      <div className="fw-bold text-dark fs-6">{device.currentStatus.temperature}°</div>
                                      <div className="text-muted fs-8">Temp</div>
                                    </div>
                                  </div>
                                  <div className="col-4">
                                    <div className="bg-light-primary p-2 rounded text-center">
                                      <div className="fw-bold text-dark fs-6">{device.currentStatus.humidity}%</div>
                                      <div className="text-muted fs-8">Humidity</div>
                                    </div>
                                  </div>
                                  <div className="col-4">
                                    <div className="bg-light-success p-2 rounded text-center">
                                      <div className="fw-bold text-dark fs-6">{device.currentStatus.batteryLevel}%</div>
                                      <div className="text-muted fs-8">Battery</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Quick Actions */}
                            <div className="d-flex gap-2 mb-3">
                              {device.deviceType === 'thermostat' && (
                                <>
                                  <button 
                                    className="btn btn-sm btn-light-primary flex-grow-1"
                                    onClick={() => handleDeviceControl(device, 'adjust_temperature', { delta: -1 })}
                                  >
                                    <i className="ki-duotone ki-minus fs-5">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-light-primary flex-grow-1"
                                    onClick={() => handleDeviceControl(device, 'adjust_temperature', { delta: 1 })}
                                  >
                                    <i className="ki-duotone ki-plus fs-5">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                  </button>
                                </>
                              )}
                              {device.deviceType === 'smart_lock' && (
                                <button 
                                  className={`btn btn-sm btn-light-${device.currentStatus.locked ? 'success' : 'warning'} w-100`}
                                  onClick={() => handleDeviceControl(device, 'toggle_lock', {})}
                                >
                                  <i className={`ki-duotone ki-${device.currentStatus.locked ? 'lock' : 'unlock'} fs-5 me-1`}>
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  {device.currentStatus.locked ? 'Unlock' : 'Lock'}
                                </button>
                              )}
                            </div>

                            <div className="d-flex justify-content-between align-items-center">
                              <span className="text-muted fs-8">Last seen: {formatLastSeen(device.lastSeen)}</span>
                              <button 
                                className="btn btn-sm btn-light-info"
                                onClick={() => setSelectedDevice(device)}
                              >
                                <i className="ki-duotone ki-setting-2 fs-5">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add Device Card */}
                <div className="row g-4 mt-2">
                  <div className="col-lg-6">
                    <div className="card border-dashed border-primary h-100">
                      <div className="card-body text-center p-5">
                        <i className="ki-duotone ki-plus-circle fs-3x text-primary mb-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <h5 className="text-dark mb-3">Add Smart Device</h5>
                        <p className="text-muted mb-4">
                          Connect more devices to your smart home network for comprehensive monitoring.
                        </p>
                        <button className="btn btn-primary">
                          <i className="ki-duotone ki-technology-2 fs-5 me-2">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          Discover Devices
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'energy' && (
          <div className="text-center py-10">
            <i className="ki-duotone ki-electricity fs-4x text-muted mb-4">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
              <span className="path4"></span>
              <span className="path5"></span>
            </i>
            <h4 className="text-dark mb-3">Energy Monitoring</h4>
            <p className="text-muted fs-5 mb-5">
              Real-time energy usage tracking and optimization recommendations coming soon.
            </p>
            <button className="btn btn-primary">
              <i className="ki-duotone ki-notification-on fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              Enable Energy Monitoring
            </button>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="text-center py-10">
            <i className="ki-duotone ki-setting-3 fs-4x text-muted mb-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <h4 className="text-dark mb-3">Smart Automation</h4>
            <p className="text-muted fs-5 mb-5">
              Create intelligent automation rules based on your home's systems and your preferences.
            </p>
            <button className="btn btn-primary">
              <i className="ki-duotone ki-rocket fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              Set Up Automation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SmartHomeHub