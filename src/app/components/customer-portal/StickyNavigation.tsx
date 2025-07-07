import React from 'react'

interface NavigationItem {
  id: string
  label: string
  icon: string
  badge?: number
  isActive: boolean
}

interface StickyNavigationProps {
  activeSection: string
  onSectionChange: (section: string) => void
  currentJob?: any
  unreadMessages?: number
  jobHistory?: any[]
  onViewTeam?: () => void
  tenantPhone?: string | null
}

const StickyNavigation: React.FC<StickyNavigationProps> = ({ 
  activeSection, 
  onSectionChange,
  currentJob,
  unreadMessages = 0,
  jobHistory = [],
  onViewTeam,
  tenantPhone
}) => {
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      icon: 'ki-element-11',
      isActive: activeSection === 'dashboard'
    },
    {
      id: 'equipment',
      label: 'Equipment',
      icon: 'ki-technology-2',
      isActive: activeSection === 'equipment'
    },
    {
      id: 'maintenance',
      label: 'Maintenance',
      icon: 'ki-wrench',
      isActive: activeSection === 'maintenance'
    },
    {
      id: 'quotes',
      label: 'Quotes & Plans',
      icon: 'ki-document',
      isActive: activeSection === 'quotes'
    },
    {
      id: 'photos',
      label: 'Photos',
      icon: 'ki-picture',
      isActive: activeSection === 'photos'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: 'ki-folder',
      isActive: activeSection === 'documents'
    },
    {
      id: 'history',
      label: 'Service History',
      icon: 'ki-time',
      badge: jobHistory.length > 0 ? jobHistory.length : undefined,
      isActive: activeSection === 'history'
    },
    {
      id: 'referrals',
      label: 'Referral Program',
      icon: 'ki-gift',
      isActive: activeSection === 'referrals'
    }
  ]

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="d-none d-lg-flex flex-column position-fixed bg-white shadow-sm border-end" 
           style={{ 
             top: '80px', 
             left: '0', 
             width: '240px', 
             height: 'calc(100vh - 80px)', 
             zIndex: 999,
             overflowY: 'auto'
           }}>
        <div className="p-4">
          <h6 className="text-muted fw-bold text-uppercase fs-7 mb-3">Navigation</h6>
          <div className="menu menu-column menu-rounded">
            {navigationItems.map((item) => (
              <div key={item.id} className="menu-item mb-1">
                <button
                  className={`menu-link btn w-100 text-start p-3 border-0 ${
                    item.isActive 
                      ? 'bg-light-primary text-primary' 
                      : 'text-gray-700 hover-bg-light-gray'
                  }`}
                  onClick={() => onSectionChange(item.id)}
                >
                  <span className="menu-icon">
                    <i className={`ki-duotone ${item.icon} fs-2 ${item.isActive ? 'text-primary' : 'text-gray-600'}`}>
                      <span className="path1"></span>
                      <span className="path2"></span>
                      {item.icon === 'ki-technology-2' && <span className="path3"></span>}
                    </i>
                  </span>
                  <span className={`menu-title fw-semibold ms-3 ${item.isActive ? 'text-primary' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="badge badge-sm badge-circle badge-light-primary ms-auto">
                      {item.badge}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Current Job Quick Access */}
          {currentJob && (
            <>
              <div className="separator my-4"></div>
              <h6 className="text-muted fw-bold text-uppercase fs-7 mb-3">Current Job</h6>
              <div className="card border border-primary">
                <div className="card-body p-3">
                  <div className="d-flex align-items-center mb-2">
                    <div className={`badge badge-sm ${
                      currentJob.status === 'In Progress' ? 'badge-success' :
                      currentJob.status === 'Scheduled' ? 'badge-primary' :
                      'badge-warning'
                    } me-2`}>
                      {currentJob.status}
                    </div>
                    <div className="text-muted fs-8">#{currentJob.id?.slice(-6)}</div>
                  </div>
                  <div className="fw-bold text-gray-900 fs-7 mb-1">{currentJob.title}</div>
                  <div className="text-muted fs-8">{currentJob.technician_name || 'Technician TBD'}</div>
                </div>
              </div>
            </>
          )}

          {/* Service History */}
          {jobHistory.length > 0 && (
            <>
              <div className="separator my-4"></div>
              <h6 className="text-muted fw-bold text-uppercase fs-7 mb-3">Recent Jobs</h6>
              <div className="d-flex flex-column gap-1">
                {jobHistory.slice(0, 3).map((job, index) => (
                  <div key={job.id || index} className="p-2 bg-light-secondary rounded cursor-pointer hover-bg-light-primary transition-all duration-200">
                    <div className="d-flex align-items-center">
                      <div className={`badge badge-sm ${
                        job.status === 'Completed' ? 'badge-success' :
                        job.status === 'In Progress' ? 'badge-primary' :
                        job.status === 'Cancelled' ? 'badge-danger' :
                        'badge-warning'
                      } me-2`}>
                        {job.status}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold fs-8 text-gray-900 text-truncate">
                          {job.title || 'Service Call'}
                        </div>
                        <div className="text-muted fs-9">
                          {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'Date TBD'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {jobHistory.length > 3 && (
                  <button 
                    className="btn btn-sm btn-light-info w-100 mt-1"
                    onClick={() => onSectionChange('history')}
                  >
                    <i className="ki-duotone ki-time fs-6 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    View All ({jobHistory.length})
                  </button>
                )}
              </div>
            </>
          )}

          {/* Team Profile Chip */}
          {currentJob?.technician_name && (
            <>
              <div className="separator my-4"></div>
              <h6 className="text-muted fw-bold text-uppercase fs-7 mb-3">Your Team</h6>
              <div className="d-flex align-items-center p-3 bg-light-primary rounded cursor-pointer hover-bg-primary hover-text-white transition-all duration-200" onClick={onViewTeam}>
                <div className="symbol symbol-35px me-3">
                  <div className="symbol-label bg-primary text-white fw-bold fs-7">
                    {currentJob.technician_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                  </div>
                </div>
                <div className="flex-grow-1">
                  <div className="fw-bold fs-7 text-gray-900">{currentJob.technician_name}</div>
                  <div className="text-muted fs-8">Lead Technician</div>
                </div>
                <i className="ki-duotone ki-arrow-right fs-6 text-primary">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
              </div>
            </>
          )}

          {/* Quick Actions */}
          <div className="separator my-4"></div>
          <h6 className="text-muted fw-bold text-uppercase fs-7 mb-3">Quick Actions</h6>
          <div className="d-flex flex-column gap-2">
            {tenantPhone && (
              <button 
                className="btn btn-sm btn-light-success w-100"
                onClick={() => window.open(`tel:${tenantPhone}`, '_self')}
              >
                <i className="ki-duotone ki-phone fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Call Support
              </button>
            )}
            <button className="btn btn-sm btn-light-primary w-100">
              <i className="ki-duotone ki-message-text-2 fs-5 me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              Send Message
              {unreadMessages > 0 && (
                <span className="badge badge-sm badge-circle badge-danger ms-2">
                  {unreadMessages}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="d-lg-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg" 
           style={{ zIndex: 1000 }}>
        <div className="row g-0">
          {navigationItems.slice(0, 5).map((item) => (
            <div key={item.id} className="col">
              <button
                className={`btn w-100 border-0 py-3 ${
                  item.isActive 
                    ? 'text-primary bg-light-primary' 
                    : 'text-gray-600'
                }`}
                onClick={() => onSectionChange(item.id)}
              >
                <i className={`ki-duotone ${item.icon} fs-3 d-block mb-1`}>
                  <span className="path1"></span>
                  <span className="path2"></span>
                  {item.icon === 'ki-technology-2' && <span className="path3"></span>}
                </i>
                <div className="fs-8 fw-semibold">
                  {item.label}
                </div>
                {item.badge && (
                  <span className="position-absolute top-0 end-0 badge badge-sm badge-circle badge-danger translate-middle">
                    {item.badge}
                  </span>
                )}
              </button>
            </div>
          ))}
          {/* More button for mobile */}
          <div className="col">
            <button className="btn w-100 border-0 py-3 text-gray-600">
              <i className="ki-duotone ki-dots-horizontal fs-3 d-block mb-1">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="fs-8 fw-semibold">More</div>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default StickyNavigation