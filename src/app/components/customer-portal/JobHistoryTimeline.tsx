import React, { useState } from 'react'

interface JobHistoryTimelineProps {
  jobHistory: any[]
  customer: any
}

interface JobDetail {
  id: string
  date: string
  service: string
  status: string
  technician: string
  cost: number
  // Future additions
  photos?: string[]
  technicianNotes?: string
  invoiceNumber?: string
  equipmentServiced?: string[]
  partsUsed?: any[]
  warrantyInfo?: string
}

export const JobHistoryTimeline: React.FC<JobHistoryTimelineProps> = ({
  jobHistory,
  customer
}) => {
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success'
      case 'cancelled': return 'danger'
      case 'in_progress': return 'primary'
      case 'scheduled': return 'info'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'check-circle'
      case 'cancelled': return 'cross-circle'
      case 'in_progress': return 'gear'
      case 'scheduled': return 'calendar'
      default: return 'information'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      full: date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      short: date.toLocaleDateString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      year: date.getFullYear(),
      month: date.toLocaleDateString('en-US', { month: 'long' })
    }
  }

  const groupJobsByYear = (jobs: JobDetail[]) => {
    const grouped = jobs.reduce((acc: { [key: number]: JobDetail[] }, job) => {
      const year = new Date(job.date).getFullYear()
      if (!acc[year]) acc[year] = []
      acc[year].push(job)
      return acc
    }, {})
    
    return Object.keys(grouped)
      .map(year => parseInt(year))
      .sort((a, b) => b - a)
      .map(year => ({ year, jobs: grouped[year] }))
  }

  const jobsByYear = groupJobsByYear(jobHistory)

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJob(expandedJob === jobId ? null : jobId)
  }

  if (jobHistory.length === 0) {
    return (
      <div className="card card-flush">
        <div className="card-body text-center py-10">
          <i className="ki-duotone ki-calendar-search fs-3x text-muted mb-4">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
            <span className="path4"></span>
          </i>
          <h3 className="text-muted mb-3">No Service History</h3>
          <p className="text-muted fs-5 mb-5">
            This is your first time with TradeWorks Pro! We'll start building your home's service history with your next appointment.
          </p>
          <button className="btn btn-primary">
            <i className="ki-duotone ki-calendar-add fs-5 me-2">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Schedule Your First Service
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card card-flush">
      <div className="card-header pt-7">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold text-dark">Your Home's Service History</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Complete timeline of all services at {[customer.address_line1, customer.city].filter(Boolean).join(', ')}
          </span>
        </h3>
        <div className="card-toolbar">
          <button className="btn btn-sm btn-light-primary">
            <i className="ki-duotone ki-document fs-5 me-1">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            Export History
          </button>
        </div>
      </div>

      <div className="card-body">
        {jobsByYear.map(({ year, jobs }) => (
          <div key={year} className="mb-8">
            {/* Year Header */}
            <div className="d-flex align-items-center mb-5">
              <div className="border border-dashed border-gray-300 w-100"></div>
              <div className="px-5">
                <span className="badge badge-light-primary fs-6 fw-bold px-4 py-2">{year}</span>
              </div>
              <div className="border border-dashed border-gray-300 w-100"></div>
            </div>

            {/* Jobs for this year */}
            <div className="timeline">
              {jobs.map((job, index) => {
                const isExpanded = expandedJob === job.id
                const statusColor = getStatusColor(job.status)
                const statusIcon = getStatusIcon(job.status)
                const date = formatDate(job.date)

                return (
                  <div key={job.id} className="timeline-item">
                    {/* Timeline icon */}
                    <div className="timeline-line w-40px"></div>
                    <div className="timeline-icon symbol symbol-circle symbol-40px">
                      <div className={`symbol-label bg-light-${statusColor}`}>
                        <i className={`ki-duotone ki-${statusIcon} fs-5 text-${statusColor}`}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      </div>
                    </div>

                    {/* Timeline content */}
                    <div className="timeline-content mb-10 mt-n1">
                      <div className="card card-bordered">
                        <div className="card-body p-6">
                          {/* Job Header */}
                          <div className="d-flex align-items-center justify-content-between mb-4">
                            <div>
                              <h4 className="fw-bold text-dark mb-1">{job.service}</h4>
                              <div className="d-flex align-items-center text-muted fs-6">
                                <i className="ki-duotone ki-calendar fs-7 me-1">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                </i>
                                <span className="me-4">{date.full}</span>
                                <i className="ki-duotone ki-profile-circle fs-7 me-1">
                                  <span className="path1"></span>
                                  <span className="path2"></span>
                                  <span className="path3"></span>
                                </i>
                                <span>Technician: {job.technician}</span>
                              </div>
                            </div>
                            <div className="text-end">
                              <span className={`badge badge-light-${statusColor} fs-7 mb-2`}>
                                {job.status}
                              </span>
                              <div className="fw-bold text-dark fs-5">
                                ${job.cost?.toFixed(2) || '0.00'}
                              </div>
                            </div>
                          </div>

                          {/* Expandable Details */}
                          {isExpanded && (
                            <div className="border-top pt-4">
                              <div className="row g-5">
                                {/* Service Details */}
                                <div className="col-md-6">
                                  <h6 className="fw-bold text-dark mb-3">Service Details</h6>
                                  <div className="mb-3">
                                    <span className="text-muted fs-7">Invoice Number:</span>
                                    <div className="fw-semibold">#{job.invoiceNumber || 'N/A'}</div>
                                  </div>
                                  <div className="mb-3">
                                    <span className="text-muted fs-7">Equipment Serviced:</span>
                                    <div className="fw-semibold">
                                      {job.equipmentServiced?.join(', ') || 'Not specified'}
                                    </div>
                                  </div>
                                  <div className="mb-3">
                                    <span className="text-muted fs-7">Warranty:</span>
                                    <div className="fw-semibold">{job.warrantyInfo || 'Standard warranty applies'}</div>
                                  </div>
                                </div>

                                {/* Technician Notes */}
                                <div className="col-md-6">
                                  <h6 className="fw-bold text-dark mb-3">Technician Notes</h6>
                                  <div className="bg-light-info p-4 rounded">
                                    <i className="ki-duotone ki-notepad-edit text-info fs-2x mb-2">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                    <p className="text-dark mb-0 fs-6">
                                      {job.technicianNotes || 'No specific notes recorded for this service.'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Photos Section */}
                              {job.photos && job.photos.length > 0 && (
                                <div className="mt-5">
                                  <h6 className="fw-bold text-dark mb-3">Service Photos</h6>
                                  <div className="row g-3">
                                    {job.photos.map((photo, i) => (
                                      <div key={i} className="col-md-3">
                                        <div className="card card-bordered">
                                          <img src={photo} alt={`Service photo ${i + 1}`} className="card-img-top" style={{ height: '120px', objectFit: 'cover' }} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="d-flex gap-3 mt-5">
                                <button className="btn btn-sm btn-light-primary">
                                  <i className="ki-duotone ki-document fs-5 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  View Invoice
                                </button>
                                <button className="btn btn-sm btn-light-success">
                                  <i className="ki-duotone ki-copy-success fs-5 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  Request Similar Service
                                </button>
                                <button className="btn btn-sm btn-light-info">
                                  <i className="ki-duotone ki-message-text-2 fs-5 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                    <span className="path3"></span>
                                  </i>
                                  Contact Support
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Expand/Collapse Button */}
                          <div className="text-center mt-4">
                            <button 
                              className="btn btn-sm btn-light-dark"
                              onClick={() => toggleJobExpansion(job.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <i className="ki-duotone ki-up fs-5 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  Show Less
                                </>
                              ) : (
                                <>
                                  <i className="ki-duotone ki-down fs-5 me-1">
                                    <span className="path1"></span>
                                    <span className="path2"></span>
                                  </i>
                                  View Details
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default JobHistoryTimeline