import React, { useState, useEffect } from 'react'

interface JobUpdate {
  id: string
  timestamp: string
  type: 'status' | 'arrival' | 'note' | 'photo' | 'completion'
  title: string
  description: string
  user: string
  location?: {
    latitude: number
    longitude: number
    address?: string
  }
  photo?: string
  isAutomated?: boolean
}

interface LiveJobLogProps {
  jobId: string
  isActive: boolean
}

export const LiveJobLog: React.FC<LiveJobLogProps> = ({
  jobId,
  isActive
}) => {
  const [updates, setUpdates] = useState<JobUpdate[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  // Mock real-time updates for demonstration
  useEffect(() => {
    if (!isActive) return

    // Simulate initial updates
    const initialUpdates: JobUpdate[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        type: 'status',
        title: 'Job Started',
        description: 'Your technician has begun work on your HVAC maintenance',
        user: 'System',
        isAutomated: true
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 90000).toISOString(),
        type: 'note',
        title: 'Initial Inspection Complete',
        description: 'Completed visual inspection of heating and cooling units. No immediate issues found.',
        user: 'Mike Rodriguez'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'photo',
        title: 'Filter Replacement',
        description: 'Replaced air filter - old filter was quite dirty. New filter installed.',
        user: 'Mike Rodriguez',
        photo: '/assets/media/misc/hvac-filter.jpg'
      }
    ]

    setUpdates(initialUpdates)

    // Simulate new updates coming in
    const interval = setInterval(() => {
      const newUpdate: JobUpdate = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'note',
        title: 'Progress Update',
        description: 'Currently cleaning evaporator coils. System is responding well to maintenance.',
        user: 'Mike Rodriguez'
      }
      
      setUpdates(prev => [newUpdate, ...prev])
    }, 45000) // New update every 45 seconds

    return () => clearInterval(interval)
  }, [isActive, jobId])

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'status':
        return { icon: 'information', color: 'primary' }
      case 'arrival':
        return { icon: 'geolocation', color: 'success' }
      case 'note':
        return { icon: 'notepad-edit', color: 'info' }
      case 'photo':
        return { icon: 'picture', color: 'warning' }
      case 'completion':
        return { icon: 'verify', color: 'success' }
      default:
        return { icon: 'information', color: 'secondary' }
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now.getTime() - time.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  if (!isActive) {
    return (
      <div className="card card-flush">
        <div className="card-body text-center py-8">
          <i className="ki-duotone ki-information-4 fs-3x text-muted mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          <h5 className="text-muted mb-2">Live Updates Not Active</h5>
          <p className="text-muted fs-6 mb-0">
            Real-time job updates will appear here when your service begins.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-flush">
      <div className="card-header">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">
            <i className="ki-duotone ki-pulse fs-4 text-success me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Live Job Updates
          </span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Real-time progress from your technician
          </span>
        </h3>
        <div className="card-toolbar">
          <button 
            className="btn btn-sm btn-light-primary"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <i className={`ki-duotone ki-${isExpanded ? 'up' : 'down'} fs-5`}>
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="card-body">
          {/* Live Status Indicator */}
          <div className="alert alert-light-success border-0 mb-5">
            <div className="d-flex align-items-center">
              <div className="spinner-grow spinner-grow-sm text-success me-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div>
                <h6 className="text-dark mb-1">🔴 LIVE - Service in Progress</h6>
                <p className="text-muted mb-0 fs-7">
                  Your technician is actively working on your system
                </p>
              </div>
            </div>
          </div>

          {/* Updates Timeline */}
          <div className="timeline timeline-border-dashed">
            {updates.map((update, index) => {
              const { icon, color } = getUpdateIcon(update.type)
              const isLatest = index === 0

              return (
                <div key={update.id} className="timeline-item">
                  <div className="timeline-line w-40px"></div>
                  
                  <div className="timeline-icon symbol symbol-circle symbol-40px">
                    <div className={`symbol-label bg-light-${color}`}>
                      <i className={`ki-duotone ki-${icon} fs-5 text-${color}`}>
                        <span className="path1"></span>
                        <span className="path2"></span>
                        {icon === 'message-text-2' && <span className="path3"></span>}
                      </i>
                    </div>
                  </div>

                  <div className="timeline-content mb-6 mt-n1">
                    <div className={`card ${isLatest ? 'border-success' : 'border-light'}`}>
                      <div className="card-body p-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="text-dark fw-bold mb-0">{update.title}</h6>
                          <div className="d-flex align-items-center">
                            {isLatest && (
                              <span className="badge badge-light-success fs-8 me-2">NEW</span>
                            )}
                            <span className="text-muted fs-7">{formatTime(update.timestamp)}</span>
                          </div>
                        </div>
                        
                        <p className="text-muted fs-6 mb-2">{update.description}</p>
                        
                        {update.photo && (
                          <div className="mb-3">
                            <img 
                              src={update.photo} 
                              alt="Service update" 
                              className="rounded"
                              style={{ maxWidth: '200px', height: 'auto' }}
                            />
                          </div>
                        )}

                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <i className="ki-duotone ki-profile-circle fs-6 text-muted me-1">
                              <span className="path1"></span>
                              <span className="path2"></span>
                              <span className="path3"></span>
                            </i>
                            <span className="text-muted fs-7">
                              {update.user} • {formatRelativeTime(update.timestamp)}
                            </span>
                          </div>
                          
                          {update.isAutomated && (
                            <span className="badge badge-light-secondary fs-8">
                              <i className="ki-duotone ki-gear fs-8 me-1">
                                <span className="path1"></span>
                                <span className="path2"></span>
                              </i>
                              Auto
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {updates.length === 0 && (
            <div className="text-center py-5">
              <i className="ki-duotone ki-notification-bing fs-3x text-muted mb-3">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <p className="text-muted mb-0">Waiting for updates from your technician...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LiveJobLog