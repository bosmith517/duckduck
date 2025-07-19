import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export const TestimonialThankYouPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const testimonialId = searchParams.get('id')

  return (
    <div className="d-flex flex-column flex-root app-root" id="kt_app_root">
      <Helmet>
        <title>Thank You for Your Testimonial</title>
      </Helmet>
      
      <div className="app-page flex-column flex-column-fluid" id="kt_app_page">
        <div className="app-wrapper flex-column flex-row-fluid" id="kt_app_wrapper">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
            <div className="card" style={{ maxWidth: '600px' }}>
              <div className="card-body text-center p-5">
                <i className="ki-duotone ki-check-circle fs-5x text-success mb-5">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                
                <h1 className="mb-4">Thank You!</h1>
                
                <p className="fs-4 text-muted mb-4">
                  Your video testimonial has been successfully submitted.
                </p>
                
                <p className="mb-5">
                  We greatly appreciate you taking the time to share your experience. 
                  Your feedback helps other customers make informed decisions and helps 
                  us continue to improve our services.
                </p>
                
                <div className="d-flex flex-column gap-3">
                  <a href="/" className="btn btn-primary">
                    <i className="ki-duotone ki-home fs-2 me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    Return to Home
                  </a>
                  
                  <p className="text-muted mb-0">
                    <small>
                      If you have any questions or concerns about your testimonial, 
                      please don't hesitate to contact us.
                    </small>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestimonialThankYouPage