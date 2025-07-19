import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import TestimonialVideoRoom from './components/TestimonialVideoRoom'
import { Helmet } from 'react-helmet-async'

interface TestimonialRequest {
  id: string
  job_id: string
  customer_name: string
  customer_email: string
  token: string
  status: 'pending' | 'recording' | 'completed' | 'expired'
  expires_at: string
  video_url?: string
  job?: {
    title: string
    description: string
    completed_at: string
  }
  tenant?: {
    name: string
    branding: any
    signalwire_project_id?: string
    signalwire_project_token?: string
  }
}

export const TestimonialRequestPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  
  const [testimonialRequest, setTestimonialRequest] = useState<TestimonialRequest | null>(null)
  const [showVideoRoom, setShowVideoRoom] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      fetchTestimonialRequest()
    }
  }, [token])

  const fetchTestimonialRequest = async () => {
    try {
      setIsLoading(true)
      
      // Verify testimonial token
      const { data, error } = await supabase.functions.invoke('verify-testimonial-token', {
        body: { token }
      })

      if (error) throw error
      
      if (!data.valid) {
        setError(data.message || 'Invalid or expired testimonial link')
        return
      }

      setTestimonialRequest(data.testimonialRequest)
      
      // Apply branding if available
      if (data.testimonialRequest.tenant?.branding) {
        applyBranding(data.testimonialRequest.tenant.branding)
      }
      
    } catch (err: any) {
      console.error('Error fetching testimonial request:', err)
      setError('Unable to load testimonial request. Please check your link.')
    } finally {
      setIsLoading(false)
    }
  }

  const applyBranding = (branding: any) => {
    // Apply custom branding colors
    if (branding.primary_color) {
      document.documentElement.style.setProperty('--bs-primary', branding.primary_color)
    }
    if (branding.secondary_color) {
      document.documentElement.style.setProperty('--bs-secondary', branding.secondary_color)
    }
  }

  const startVideoRecording = () => {
    setShowVideoRoom(true)
  }

  const handleRecordingComplete = async (videoUrl: string) => {
    try {
      // Update testimonial with video URL
      await supabase.functions.invoke('update-testimonial-video', {
        body: { 
          testimonialId: testimonialRequest?.id,
          videoUrl,
          status: 'completed'
        }
      })
      
      // Redirect to thank you page
      navigate(`/testimonial/thank-you/${testimonialRequest?.id}`)
      
    } catch (err) {
      console.error('Error updating testimonial:', err)
      setError('Unable to save your testimonial. Please try again.')
    }
  }

  if (isLoading) {
    return (
      <div className="d-flex flex-column flex-root app-root" id="kt_app_root">
        <div className="app-page flex-column flex-column-fluid" id="kt_app_page">
          <div className="app-wrapper flex-column flex-row-fluid" id="kt_app_wrapper">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !testimonialRequest) {
    return (
      <div className="d-flex flex-column flex-root app-root" id="kt_app_root">
        <div className="app-page flex-column flex-column-fluid" id="kt_app_page">
          <div className="app-wrapper flex-column flex-row-fluid" id="kt_app_wrapper">
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
              <div className="card" style={{ maxWidth: '500px' }}>
                <div className="card-body text-center p-5">
                  <i className="ki-duotone ki-shield-cross fs-5x text-danger mb-5">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  <h3 className="mb-3">Testimonial Not Found</h3>
                  <p className="text-muted mb-0">
                    {error || 'This testimonial link is invalid or has expired.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const tenantName = testimonialRequest.tenant?.name || 'Our Company'
  const logoUrl = testimonialRequest.tenant?.branding?.logo_url

  return (
    <div className="d-flex flex-column flex-root app-root" id="kt_app_root">
      <Helmet>
        <title>Share Your Experience - {tenantName}</title>
      </Helmet>
      
      <div className="app-page flex-column flex-column-fluid" id="kt_app_page">
        <div className="app-wrapper flex-column flex-row-fluid" id="kt_app_wrapper">
          {/* Header */}
          <div className="app-header">
            <div className="app-container container-fluid d-flex align-items-center justify-content-between py-3">
              {logoUrl ? (
                <img src={logoUrl} alt={tenantName} style={{ height: '40px' }} />
              ) : (
                <h2 className="mb-0">{tenantName}</h2>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="app-main flex-column flex-row-fluid" id="kt_app_main">
            <div className="d-flex flex-column flex-column-fluid">
              <div className="app-content flex-column-fluid">
                <div className="app-container container-fluid">
                  <div className="row justify-content-center">
                    <div className="col-lg-8">
                      {testimonialRequest.status === 'completed' ? (
                        // Already completed
                        <div className="card">
                          <div className="card-body text-center p-5">
                            <i className="ki-duotone ki-check-circle fs-5x text-success mb-5">
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <h3 className="mb-3">Thank You!</h3>
                            <p className="text-muted mb-0">
                              You have already submitted your testimonial. We appreciate your feedback!
                            </p>
                          </div>
                        </div>
                      ) : !showVideoRoom ? (
                        // Show introduction
                        <div className="card">
                          <div className="card-body p-5">
                            <h2 className="mb-4">Share Your Experience</h2>
                            <p className="fs-5 text-muted mb-4">
                              Hi {testimonialRequest.customer_name}! Thank you for choosing {tenantName} 
                              for your {testimonialRequest.job?.title}.
                            </p>
                            <p className="mb-4">
                              We'd love to hear about your experience! Your testimonial helps other customers 
                              make informed decisions and helps us improve our services.
                            </p>
                            
                            <div className="bg-light rounded p-4 mb-4">
                              <h5 className="mb-3">What to include in your testimonial:</h5>
                              <ul className="mb-0">
                                <li>What problem we helped you solve</li>
                                <li>Your experience working with our team</li>
                                <li>The quality of work performed</li>
                                <li>Would you recommend us to others?</li>
                              </ul>
                            </div>

                            <div className="d-flex justify-content-center">
                              <button 
                                className="btn btn-primary btn-lg"
                                onClick={startVideoRecording}
                              >
                                <i className="ki-duotone ki-video-add fs-1 me-2">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                Record Video Testimonial
                              </button>
                            </div>

                            <p className="text-muted text-center mt-4 mb-0">
                              <small>
                                By recording a testimonial, you agree to allow {tenantName} to use 
                                your video for marketing purposes.
                              </small>
                            </p>
                          </div>
                        </div>
                      ) : (
                        // Show video recorder
                        <TestimonialVideoRoom
                          testimonialId={testimonialRequest.id}
                          customerName={testimonialRequest.customer_name}
                          jobTitle={testimonialRequest.job?.title || 'service'}
                          onRecordingComplete={handleRecordingComplete}
                          onError={(err) => setError(err.message)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TestimonialRequestPage