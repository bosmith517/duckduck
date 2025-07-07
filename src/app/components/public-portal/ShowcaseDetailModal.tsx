import React from 'react'

interface ShowcaseDetailModalProps {
  showcase: any
  isOpen: boolean
  onClose: () => void
  onInquiry: () => void
}

const ShowcaseDetailModal: React.FC<ShowcaseDetailModalProps> = ({ 
  showcase, 
  isOpen, 
  onClose, 
  onInquiry 
}) => {
  if (!isOpen || !showcase) return null

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{showcase.title}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">
              <div className="row g-6">
                {/* Photo Gallery */}
                <div className="col-lg-8">
                  <div className="mb-4">
                    <h6 className="text-muted text-uppercase fs-7 mb-3">Before & After</h6>
                    <div className="row g-4">
                      <div className="col-6">
                        <img 
                          src={showcase.before_photos[0]?.url || '/assets/media/misc/placeholder.jpg'} 
                          alt="Before" 
                          className="img-fluid rounded"
                        />
                        <p className="text-center text-muted mt-2">Before</p>
                      </div>
                      <div className="col-6">
                        <img 
                          src={showcase.after_photos[0]?.url || '/assets/media/misc/placeholder.jpg'} 
                          alt="After" 
                          className="img-fluid rounded"
                        />
                        <p className="text-center text-muted mt-2">After</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <h6 className="text-muted text-uppercase fs-7 mb-3">Project Details</h6>
                    <p className="text-gray-700">{showcase.description}</p>
                  </div>

                  {/* Testimonial */}
                  {showcase.testimonial && (
                    <div className="mb-4">
                      <h6 className="text-muted text-uppercase fs-7 mb-3">Customer Testimonial</h6>
                      <div className="bg-light rounded p-4">
                        <p className="mb-3 fst-italic">"{showcase.testimonial}"</p>
                        {showcase.customer_name && (
                          <p className="mb-0 text-muted">— {showcase.customer_name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Project Info Sidebar */}
                <div className="col-lg-4">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6 className="card-title mb-4">Project Information</h6>
                      
                      {showcase.category && (
                        <div className="d-flex justify-content-between mb-3">
                          <span className="text-muted">Category:</span>
                          <span className="fw-semibold">{showcase.category}</span>
                        </div>
                      )}
                      
                      {showcase.duration_days && (
                        <div className="d-flex justify-content-between mb-3">
                          <span className="text-muted">Duration:</span>
                          <span className="fw-semibold">{showcase.duration_days} days</span>
                        </div>
                      )}
                      
                      {showcase.budget_range && (
                        <div className="d-flex justify-content-between mb-3">
                          <span className="text-muted">Budget:</span>
                          <span className="fw-semibold">{showcase.budget_range}</span>
                        </div>
                      )}
                      
                      {showcase.completion_date && (
                        <div className="d-flex justify-content-between mb-3">
                          <span className="text-muted">Completed:</span>
                          <span className="fw-semibold">
                            {new Date(showcase.completion_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      <div className="separator my-4"></div>
                      
                      <button 
                        className="btn btn-primary w-100"
                        onClick={onInquiry}
                      >
                        <i className="ki-duotone ki-message-text-2 fs-4 me-2">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        Get a Similar Quote
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show"></div>
    </>
  )
}

export default ShowcaseDetailModal