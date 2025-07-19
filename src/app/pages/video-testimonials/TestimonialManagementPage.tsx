import React, { useEffect, useState } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { supabase } from '../../../supabaseClient'
import { useAuth } from '../../modules/auth/core/Auth'
import { format } from 'date-fns'
import { KTSVG } from '../../../_metronic/helpers'

interface TestimonialRequest {
  id: string
  job_id: string
  customer_name: string
  customer_email: string
  status: 'pending' | 'sent' | 'recording' | 'completed' | 'expired'
  video_url?: string
  thumbnail_url?: string
  token: string
  sent_at?: string
  recorded_at?: string
  expires_at: string
  created_at: string
  job?: {
    title: string
    account?: {
      name: string
    }
    contact?: {
      first_name: string
      last_name: string
    }
  }
}

export const TestimonialManagementPage: React.FC = () => {
  const { currentUser } = useAuth()
  const [testimonials, setTestimonials] = useState<TestimonialRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<string>('')
  const [jobs, setJobs] = useState<any[]>([])
  const [isSending, setIsSending] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'completed'>('all')

  useEffect(() => {
    fetchTestimonials()
    fetchRecentJobs()
  }, [filter])

  const fetchTestimonials = async () => {
    try {
      setIsLoading(true)
      
      let query = supabase
        .from('testimonial_requests')
        .select(`
          *,
          job:jobs (
            title,
            account:accounts (name),
            contact:contacts (first_name, last_name)
          )
        `)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      
      setTestimonials(data || [])
    } catch (err) {
      console.error('Error fetching testimonials:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRecentJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          completed_at,
          account:accounts (name),
          contact:contacts (first_name, last_name, email)
        `)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50)

      if (error) throw error
      
      setJobs(data || [])
    } catch (err) {
      console.error('Error fetching jobs:', err)
    }
  }

  const sendTestimonialRequest = async () => {
    if (!selectedJob) return
    
    try {
      setIsSending(true)
      
      const job = jobs.find(j => j.id === selectedJob)
      if (!job) return
      
      const { data, error } = await supabase.functions.invoke('send-testimonial-request', {
        body: { 
          jobId: job.id,
          customerName: job.contact ? `${job.contact.first_name} ${job.contact.last_name}` : job.account?.name,
          customerEmail: job.contact?.email,
          userId: currentUser?.id
        }
      })

      if (error) throw error
      
      // Refresh the list
      fetchTestimonials()
      setSelectedJob('')
      
      // Show success message
      alert('Testimonial request sent successfully!')
      
    } catch (err: any) {
      console.error('Error sending testimonial request:', err)
      alert('Failed to send testimonial request: ' + err.message)
    } finally {
      setIsSending(false)
    }
  }

  const resendRequest = async (testimonial: TestimonialRequest) => {
    try {
      const { error } = await supabase.functions.invoke('resend-testimonial-request', {
        body: { testimonialId: testimonial.id }
      })

      if (error) throw error
      
      alert('Testimonial request resent successfully!')
      fetchTestimonials()
      
    } catch (err: any) {
      console.error('Error resending request:', err)
      alert('Failed to resend request: ' + err.message)
    }
  }

  const copyLink = (testimonial: TestimonialRequest) => {
    const link = `${window.location.origin}/testimonial/${testimonial.token}`
    navigator.clipboard.writeText(link)
    alert('Link copied to clipboard!')
  }

  const deleteTestimonial = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial request?')) return
    
    try {
      const { error } = await supabase
        .from('testimonial_requests')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      fetchTestimonials()
    } catch (err) {
      console.error('Error deleting testimonial:', err)
      alert('Failed to delete testimonial')
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'badge-light',
      sent: 'badge-warning',
      recording: 'badge-info',
      completed: 'badge-success',
      expired: 'badge-danger'
    }
    return badges[status as keyof typeof badges] || 'badge-secondary'
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>Video Testimonials</PageTitle>
      
      <div className="row g-5 g-xl-8">
        {/* Send New Request Card */}
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Send Testimonial Request</h3>
            </div>
            <div className="card-body">
              <div className="row align-items-end">
                <div className="col-md-8">
                  <label className="form-label">Select a Completed Job</label>
                  <select 
                    className="form-select"
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value)}
                    disabled={isSending}
                  >
                    <option value="">Choose a job...</option>
                    {jobs.map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.contact ? 
                          `${job.contact.first_name} ${job.contact.last_name}` : 
                          job.account?.name
                        } ({format(new Date(job.completed_at), 'MMM d, yyyy')})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <button 
                    className="btn btn-primary w-100"
                    onClick={sendTestimonialRequest}
                    disabled={!selectedJob || isSending}
                  >
                    {isSending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <KTSVG path="/media/icons/duotone/Communication/Send.svg" className="svg-icon-2 me-2" />
                        Send Request
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials List */}
        <div className="col-12">
          <div className="card">
            <div className="card-header border-0 pt-5">
              <h3 className="card-title align-items-start flex-column">
                <span className="card-label fw-bold fs-3 mb-1">Testimonial Requests</span>
                <span className="text-muted mt-1 fw-semibold fs-7">
                  {testimonials.length} total requests
                </span>
              </h3>
              <div className="card-toolbar">
                <ul className="nav nav-pills nav-pills-sm nav-light-primary">
                  <li className="nav-item">
                    <a 
                      className={`nav-link btn btn-active-light btn-color-muted py-2 px-4 ${filter === 'all' ? 'active' : ''}`}
                      onClick={() => setFilter('all')}
                    >
                      All
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={`nav-link btn btn-active-light btn-color-muted py-2 px-4 ${filter === 'pending' ? 'active' : ''}`}
                      onClick={() => setFilter('pending')}
                    >
                      Pending
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={`nav-link btn btn-active-light btn-color-muted py-2 px-4 ${filter === 'sent' ? 'active' : ''}`}
                      onClick={() => setFilter('sent')}
                    >
                      Sent
                    </a>
                  </li>
                  <li className="nav-item">
                    <a 
                      className={`nav-link btn btn-active-light btn-color-muted py-2 px-4 ${filter === 'completed' ? 'active' : ''}`}
                      onClick={() => setFilter('completed')}
                    >
                      Completed
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="card-body pt-3">
              {isLoading ? (
                <div className="d-flex justify-content-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : testimonials.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted">No testimonial requests found</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-200px">Customer</th>
                        <th className="min-w-150px">Job</th>
                        <th className="min-w-100px">Status</th>
                        <th className="min-w-100px">Sent</th>
                        <th className="min-w-100px">Recorded</th>
                        <th className="min-w-100px text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testimonials.map(testimonial => (
                        <tr key={testimonial.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="d-flex justify-content-start flex-column">
                                <span className="text-dark fw-bold text-hover-primary fs-6">
                                  {testimonial.customer_name}
                                </span>
                                <span className="text-muted fw-semibold text-muted d-block fs-7">
                                  {testimonial.customer_email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="text-dark fw-bold d-block fs-6">
                              {testimonial.job?.title || 'N/A'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadge(testimonial.status)}`}>
                              {testimonial.status}
                            </span>
                          </td>
                          <td>
                            {testimonial.sent_at ? 
                              format(new Date(testimonial.sent_at), 'MMM d, yyyy') : 
                              '-'
                            }
                          </td>
                          <td>
                            {testimonial.recorded_at ? 
                              format(new Date(testimonial.recorded_at), 'MMM d, yyyy') : 
                              '-'
                            }
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end flex-shrink-0">
                              {testimonial.status === 'completed' && testimonial.video_url ? (
                                <a 
                                  href={testimonial.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                                  title="View Video"
                                >
                                  <KTSVG path="/media/icons/duotone/Media/Play.svg" className="svg-icon-3" />
                                </a>
                              ) : null}
                              
                              <button
                                className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                                onClick={() => copyLink(testimonial)}
                                title="Copy Link"
                              >
                                <KTSVG path="/media/icons/duotone/General/Link.svg" className="svg-icon-3" />
                              </button>
                              
                              {testimonial.status === 'sent' && (
                                <button
                                  className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                                  onClick={() => resendRequest(testimonial)}
                                  title="Resend Request"
                                >
                                  <KTSVG path="/media/icons/duotone/Communication/Send.svg" className="svg-icon-3" />
                                </button>
                              )}
                              
                              <button
                                className="btn btn-icon btn-bg-light btn-active-color-danger btn-sm"
                                onClick={() => deleteTestimonial(testimonial.id)}
                                title="Delete"
                              >
                                <KTSVG path="/media/icons/duotone/General/Trash.svg" className="svg-icon-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default TestimonialManagementPage