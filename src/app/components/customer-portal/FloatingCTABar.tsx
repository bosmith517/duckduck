import React, { useState, useEffect } from 'react'

interface FloatingCTABarProps {
  tenantPhone?: string | null
  onScheduleService: () => void
  onContactTechnician: () => void
  onPayInvoice: () => void
  currentJob?: any
  hasUnpaidInvoices?: boolean
  hasActiveEstimate?: boolean
  onViewEstimates?: () => void
  onViewPhotos?: () => void
}

const FloatingCTABar: React.FC<FloatingCTABarProps> = ({
  tenantPhone,
  onScheduleService,
  onContactTechnician,
  onPayInvoice,
  currentJob,
  hasUnpaidInvoices = false,
  hasActiveEstimate = false,
  onViewEstimates,
  onViewPhotos
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show CTA bar after scrolling down 200px
      setIsVisible(window.scrollY > 200)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible) return null

  return (
    <>
      {/* Desktop Floating Bar */}
      <div className="d-none d-lg-block">
        <div 
          className={`position-fixed bg-white shadow-lg border rounded-3 transition-all duration-300 ${
            isExpanded ? 'w-350px' : 'w-60px'
          }`}
          style={{ 
            bottom: '30px', 
            right: '20px', 
            zIndex: 1050,
            transition: 'all 0.3s ease',
            maxWidth: 'calc(100vw - 40px)'
          }}
        >
          {!isExpanded ? (
            /* Collapsed State - Floating Action Button */
            <button
              className="btn btn-primary rounded-circle w-60px h-60px d-flex align-items-center justify-content-center shadow-lg"
              onClick={() => setIsExpanded(true)}
              style={{ fontSize: '24px' }}
            >
              <i className="ki-duotone ki-plus fs-2">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
            </button>
          ) : (
            /* Expanded State - Action Panel */
            <div className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-gray-900 mb-0">Quick Actions</h6>
                <button
                  className="btn btn-sm btn-icon btn-light-dark"
                  onClick={() => setIsExpanded(false)}
                >
                  <i className="ki-duotone ki-cross fs-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </button>
              </div>

              <div className="d-flex flex-column gap-2">
                {/* Emergency Call */}
                {tenantPhone && (
                  <button
                    className="btn btn-light-danger text-start d-flex align-items-center"
                    onClick={() => window.open(`tel:${tenantPhone}`, '_self')}
                  >
                    <i className="ki-duotone ki-phone fs-4 text-danger me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <div className="fw-semibold">Emergency Call</div>
                      <div className="text-muted fs-7">{tenantPhone}</div>
                    </div>
                  </button>
                )}

                {/* Contact Technician */}
                {currentJob && (
                  <button
                    className="btn btn-light-primary text-start d-flex align-items-center"
                    onClick={onContactTechnician}
                  >
                    <i className="ki-duotone ki-message-text-2 fs-4 text-primary me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <div>
                      <div className="fw-semibold">Message Technician</div>
                      <div className="text-muted fs-7">Current job support</div>
                    </div>
                  </button>
                )}

                {/* Pay Invoice */}
                {hasUnpaidInvoices && (
                  <button
                    className="btn btn-light-success text-start d-flex align-items-center position-relative"
                    onClick={onPayInvoice}
                  >
                    <i className="ki-duotone ki-credit-cart fs-4 text-success me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <div className="fw-semibold">Pay Invoice</div>
                      <div className="text-muted fs-7">Outstanding balance</div>
                    </div>
                    <span className="position-absolute top-0 start-100 translate-middle badge badge-sm badge-circle badge-danger">
                      !
                    </span>
                  </button>
                )}

                {/* Schedule Service */}
                <button
                  className="btn btn-light-warning text-start d-flex align-items-center"
                  onClick={onScheduleService}
                >
                  <i className="ki-duotone ki-calendar-add fs-4 text-warning me-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  <div>
                    <div className="fw-semibold">Schedule Service</div>
                    <div className="text-muted fs-7">Book appointment</div>
                  </div>
                </button>

                {/* Quick Reschedule */}
                {currentJob && currentJob.status === 'Scheduled' && (
                  <button
                    className="btn btn-light-info text-start d-flex align-items-center"
                    onClick={() => alert(`Please call us at ${tenantPhone || 'our main number'} to reschedule your appointment.`)}
                  >
                    <i className="ki-duotone ki-time fs-4 text-info me-3">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div>
                      <div className="fw-semibold">Reschedule</div>
                      <div className="text-muted fs-7">Move appointment</div>
                    </div>
                  </button>
                )}
              </div>

              {/* Current Job Status */}
              {currentJob && (
                <div className="separator my-3"></div>
              )}
              {currentJob && (
                <div className="p-2 bg-light-primary rounded">
                  <div className="d-flex align-items-center">
                    <div className={`badge badge-sm ${
                      currentJob.status === 'In Progress' ? 'badge-success' :
                      currentJob.status === 'Scheduled' ? 'badge-primary' :
                      'badge-warning'
                    } me-2`}>
                      {currentJob.status}
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold fs-7">{currentJob.title}</div>
                      <div className="text-muted fs-8">#{currentJob.id?.slice(-6)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sticky CTA Bar */}
      <div className="d-lg-none">
        {/* Quick Access Bar for Photos & Estimates */}
        {(hasActiveEstimate || currentJob) && isVisible && (
          <div 
            className="position-fixed bg-white border-bottom shadow w-100"
            style={{ 
              top: '60px', /* Below header */
              left: '0',
              right: '0',
              zIndex: 1041
            }}
          >
            <div className="container-fluid px-2 py-2">
              <div className="row g-2">
                {/* View Estimates Button */}
                {hasActiveEstimate && onViewEstimates && (
                  <div className="col-6">
                    <button
                      className="btn btn-light-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                      onClick={onViewEstimates}
                    >
                      <i className="ki-duotone ki-bill fs-5 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                        <span className="path5"></span>
                        <span className="path6"></span>
                      </i>
                      Estimates
                      <span className="badge badge-sm badge-circle badge-primary ms-1">!</span>
                    </button>
                  </div>
                )}
                
                {/* View Photos Button */}
                {onViewPhotos && (
                  <div className={hasActiveEstimate ? "col-6" : "col-12"}>
                    <button
                      className="btn btn-light-info btn-sm w-100 d-flex align-items-center justify-content-center"
                      onClick={onViewPhotos}
                    >
                      <i className="ki-duotone ki-picture fs-5 me-1">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Photos
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div 
          className="position-fixed bg-white border-top shadow-lg w-100"
          style={{ 
            bottom: '60px', /* Above mobile nav */
            left: '0',
            right: '0',
            zIndex: 1040
          }}
        >
          <div className="container-fluid px-2 py-2">
            <div className="row g-2">
              {/* Emergency Call */}
              {tenantPhone && (
                <div className="col-6">
                  <button
                    className="btn btn-danger btn-sm w-100 d-flex align-items-center justify-content-center"
                    onClick={() => window.open(`tel:${tenantPhone}`, '_self')}
                  >
                    <i className="ki-duotone ki-phone fs-5 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Call
                  </button>
                </div>
              )}

              {/* Primary Action - varies by context */}
              <div className="col-6">
                {currentJob ? (
                  <button
                    className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                    onClick={onContactTechnician}
                  >
                    <i className="ki-duotone ki-message-text-2 fs-5 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    Message
                  </button>
                ) : hasUnpaidInvoices ? (
                  <button
                    className="btn btn-success btn-sm w-100 d-flex align-items-center justify-content-center position-relative"
                    onClick={onPayInvoice}
                  >
                    <i className="ki-duotone ki-credit-cart fs-5 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Pay Now
                    <span className="position-absolute top-0 end-0 badge badge-sm badge-circle badge-danger translate-middle">
                      !
                    </span>
                  </button>
                ) : (
                  <button
                    className="btn btn-warning btn-sm w-100 d-flex align-items-center justify-content-center"
                    onClick={onScheduleService}
                  >
                    <i className="ki-duotone ki-calendar-add fs-5 me-1">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Schedule
                  </button>
                )}
              </div>
            </div>

            {/* Current Job Status on Mobile */}
            {currentJob && (
              <div className="mt-2 p-2 bg-light-primary rounded">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center flex-grow-1 text-truncate">
                    <div className={`badge badge-sm ${
                      currentJob.status === 'In Progress' ? 'badge-success' :
                      currentJob.status === 'Scheduled' ? 'badge-primary' :
                      'badge-warning'
                    } me-2 flex-shrink-0`}>
                      {currentJob.status}
                    </div>
                    <div className="fw-semibold fs-8 text-truncate">{currentJob.title}</div>
                  </div>
                  <div className="text-muted fs-9 flex-shrink-0 ms-2">#{currentJob.id?.slice(-6)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FloatingCTABar