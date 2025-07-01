import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../../../../supabaseClient'

interface JobsKanbanProps {
  jobs: Job[]
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Job['status']) => void
}

export const JobsKanban: React.FC<JobsKanbanProps> = ({ jobs, onEdit, onDelete, onStatusChange }) => {
  const navigate = useNavigate()
  
  const statuses: { key: Job['status']; label: string; color: string }[] = [
    { key: 'draft', label: 'Draft', color: 'secondary' },
    { key: 'scheduled', label: 'Scheduled', color: 'info' },
    { key: 'in_progress', label: 'In Progress', color: 'primary' },
    { key: 'on_hold', label: 'On Hold', color: 'warning' },
    { key: 'completed', label: 'Completed', color: 'success' },
    { key: 'cancelled', label: 'Cancelled', color: 'danger' },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'danger'
      case 'high':
        return 'warning'
      case 'medium':
        return 'info'
      case 'low':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return null
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString()
  }

  const getJobsByStatus = (status: Job['status']) => {
    return jobs.filter(job => job.status === status)
  }

  const handleDragStart = (e: React.DragEvent, job: Job) => {
    e.dataTransfer.setData('text/plain', job.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, newStatus: Job['status']) => {
    e.preventDefault()
    const jobId = e.dataTransfer.getData('text/plain')
    onStatusChange(jobId, newStatus)
  }

  return (
    <div className='row g-6 g-xl-9'>
      {statuses.map((status) => {
        const statusJobs = getJobsByStatus(status.key)
        return (
          <div key={status.key} className='col-md-4 col-lg-2'>
            <div className='card card-flush h-lg-100'>
              <div className='card-header pt-7'>
                <h3 className='card-title align-items-start flex-column'>
                  <span className={`card-label fw-bold text-${status.color}`}>
                    {status.label}
                  </span>
                  <span className='text-gray-400 mt-1 fw-semibold fs-6'>
                    {statusJobs.length} job{statusJobs.length !== 1 ? 's' : ''}
                  </span>
                </h3>
              </div>
              <div 
                className='card-body pt-6'
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status.key)}
                style={{ minHeight: '400px' }}
              >
                <div className='d-flex flex-column gap-4'>
                  {statusJobs.map((job) => (
                    <div
                      key={job.id}
                      className='card card-bordered cursor-pointer'
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      style={{ cursor: 'grab' }}
                    >
                      <div className='card-body p-4'>
                        <div className='d-flex justify-content-between align-items-start mb-3'>
                          <h6 className='card-title mb-0 text-hover-primary'>
                            <a
                              href='#'
                              onClick={(e) => {
                                e.preventDefault()
                                onEdit(job)
                              }}
                            >
                              {job.title}
                            </a>
                          </h6>
                          <span className={`badge badge-light-${getPriorityColor(job.priority)} fs-8`}>
                            {job.priority.toUpperCase()}
                          </span>
                        </div>

                        <div className='text-muted fs-7 mb-2'>
                          {job.job_number}
                        </div>

                        {job.description && (
                          <p className='text-gray-600 fs-7 mb-3'>
                            {job.description.length > 80 
                              ? `${job.description.substring(0, 80)}...` 
                              : job.description
                            }
                          </p>
                        )}

                        <div className='d-flex flex-column gap-2 mb-3'>
                          <div className='d-flex align-items-center'>
                            <i className='ki-duotone ki-profile-circle fs-6 text-gray-400 me-2'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                              <span className='path3'></span>
                            </i>
                            <span className='text-gray-600 fs-7'>
                              {job.account?.name || 'No account'}
                            </span>
                          </div>

                          {job.contact && (
                            <div className='d-flex align-items-center'>
                              <i className='ki-duotone ki-user fs-6 text-gray-400 me-2'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <span className='text-gray-600 fs-7'>
                                {job.contact.first_name} {job.contact.last_name}
                              </span>
                            </div>
                          )}

                          {job.due_date && (
                            <div className='d-flex align-items-center'>
                              <i className='ki-duotone ki-calendar fs-6 text-gray-400 me-2'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                              </i>
                              <span className='text-gray-600 fs-7'>
                                Due: {formatDate(job.due_date)}
                              </span>
                            </div>
                          )}

                          {job.estimated_cost && (
                            <div className='d-flex align-items-center'>
                              <i className='ki-duotone ki-dollar fs-6 text-gray-400 me-2'>
                                <span className='path1'></span>
                                <span className='path2'></span>
                                <span className='path3'></span>
                              </i>
                              <span className='text-gray-600 fs-7'>
                                {formatCurrency(job.estimated_cost)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className='d-flex justify-content-between align-items-center'>
                          <a
                            href='#'
                            className='btn btn-light btn-active-light-primary btn-sm'
                            data-kt-menu-trigger='click'
                            data-kt-menu-placement='bottom-end'
                          >
                            Actions
                            <i className='ki-duotone ki-down fs-5 m-0'></i>
                          </a>
                          <div
                            className='menu menu-sub menu-sub-dropdown menu-column menu-rounded menu-gray-600 menu-state-bg-light-primary fw-bold fs-7 w-125px py-4'
                            data-kt-menu='true'
                          >
                            <div className='menu-item px-3'>
                              <a
                                href='#'
                                className='menu-link px-3'
                                onClick={(e) => {
                                  e.preventDefault()
                                  navigate(`/jobs/${job.id}`)
                                }}
                              >
                                <i className='ki-duotone ki-eye fs-5 me-2'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                </i>
                                View
                              </a>
                            </div>
                            <div className='menu-item px-3'>
                              <a
                                href='#'
                                className='menu-link px-3'
                                onClick={(e) => {
                                  e.preventDefault()
                                  onEdit(job)
                                }}
                              >
                                <i className='ki-duotone ki-pencil fs-5 me-2'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                                Edit
                              </a>
                            </div>
                            <div className='menu-item px-3'>
                              <a
                                href='#'
                                className='menu-link px-3'
                                onClick={(e) => {
                                  e.preventDefault()
                                  navigate('/estimates')
                                }}
                              >
                                <i className='ki-duotone ki-document fs-5 me-2'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                </i>
                                Create Estimate
                              </a>
                            </div>
                            <div className='menu-item px-3'>
                              <a
                                href='#'
                                className='menu-link px-3'
                                onClick={(e) => {
                                  e.preventDefault()
                                  onDelete(job.id)
                                }}
                              >
                                <i className='ki-duotone ki-trash fs-5 me-2'>
                                  <span className='path1'></span>
                                  <span className='path2'></span>
                                  <span className='path3'></span>
                                  <span className='path4'></span>
                                  <span className='path5'></span>
                                </i>
                                Delete
                              </a>
                            </div>
                          </div>

                          {job.estimated_hours && (
                            <span className='text-muted fs-8'>
                              {job.estimated_hours}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {statusJobs.length === 0 && (
                    <div className='text-center py-10'>
                      <div className='text-gray-400 fs-6'>
                        No jobs in {status.label.toLowerCase()}
                      </div>
                      <div 
                        className='border-2 border-dashed border-gray-300 rounded p-4 mt-3'
                        style={{ minHeight: '100px' }}
                      >
                        <div className='text-gray-400 fs-7'>
                          Drop jobs here
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
