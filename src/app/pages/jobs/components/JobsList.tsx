import React from 'react'
import { Job } from '../../../../supabaseClient'

interface JobsListProps {
  jobs: Job[]
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Job['status']) => void
}

export const JobsList: React.FC<JobsListProps> = ({ jobs, onEdit, onDelete, onStatusChange }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-light-success'
      case 'in_progress':
        return 'badge-light-primary'
      case 'scheduled':
        return 'badge-light-info'
      case 'on_hold':
        return 'badge-light-warning'
      case 'cancelled':
        return 'badge-light-danger'
      case 'draft':
        return 'badge-light-secondary'
      default:
        return 'badge-light-secondary'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'badge-danger'
      case 'high':
        return 'badge-warning'
      case 'medium':
        return 'badge-info'
      case 'low':
        return 'badge-secondary'
      default:
        return 'badge-secondary'
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const formatPriority = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1)
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  if (jobs.length === 0) {
    return (
      <div className='d-flex flex-column flex-center'>
        <img
          src='/media/illustrations/sketchy-1/5.png'
          alt='No jobs'
          className='mw-400px'
        />
        <div className='fs-1 fw-bolder text-dark mb-4'>No jobs found.</div>
        <div className='fs-6'>Start by creating your first job.</div>
      </div>
    )
  }

  return (
    <div className='table-responsive'>
      <table className='table align-middle table-row-dashed fs-6 gy-5'>
        <thead>
          <tr className='text-start text-muted fw-bolder fs-7 text-uppercase gs-0'>
            <th className='min-w-200px'>Job Details</th>
            <th className='min-w-125px'>Account</th>
            <th className='min-w-100px'>Status</th>
            <th className='min-w-100px'>Priority</th>
            <th className='min-w-125px'>Dates</th>
            <th className='min-w-125px'>Cost</th>
            <th className='text-end min-w-100px'>Actions</th>
          </tr>
        </thead>
        <tbody className='text-gray-600 fw-bold'>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <div className='d-flex flex-column'>
                  <a
                    href='#'
                    className='text-gray-800 text-hover-primary mb-1'
                    onClick={(e) => {
                      e.preventDefault()
                      onEdit(job)
                    }}
                  >
                    {job.title}
                  </a>
                  <span className='text-muted fs-7'>{job.job_number}</span>
                  {job.description && (
                    <span className='text-muted fs-8 mt-1'>
                      {job.description.length > 100 
                        ? `${job.description.substring(0, 100)}...` 
                        : job.description
                      }
                    </span>
                  )}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  <span className='text-gray-800 mb-1'>
                    {job.account?.name || '-'}
                  </span>
                  {job.contact && (
                    <span className='text-muted fs-7'>
                      {job.contact.first_name} {job.contact.last_name}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <select
                  className={`form-select form-select-sm ${getStatusColor(job.status)} fw-bolder`}
                  value={job.status}
                  onChange={(e) => onStatusChange(job.id, e.target.value as Job['status'])}
                  style={{ maxWidth: '140px' }}
                >
                  <option value='draft'>Draft</option>
                  <option value='scheduled'>Scheduled</option>
                  <option value='in_progress'>In Progress</option>
                  <option value='completed'>Completed</option>
                  <option value='on_hold'>On Hold</option>
                  <option value='cancelled'>Cancelled</option>
                </select>
              </td>
              <td>
                <span className={`badge ${getPriorityColor(job.priority)} fw-bolder`}>
                  {formatPriority(job.priority)}
                </span>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  {job.start_date && (
                    <span className='text-gray-800 mb-1'>
                      Start: {formatDate(job.start_date)}
                    </span>
                  )}
                  {job.due_date && (
                    <span className='text-muted fs-7'>
                      Due: {formatDate(job.due_date)}
                    </span>
                  )}
                  {!job.start_date && !job.due_date && (
                    <span className='text-muted'>-</span>
                  )}
                </div>
              </td>
              <td>
                <div className='d-flex flex-column'>
                  {job.estimated_cost && (
                    <span className='text-gray-800 mb-1'>
                      Est: {formatCurrency(job.estimated_cost)}
                    </span>
                  )}
                  {job.actual_cost && (
                    <span className='text-muted fs-7'>
                      Actual: {formatCurrency(job.actual_cost)}
                    </span>
                  )}
                  {!job.estimated_cost && !job.actual_cost && (
                    <span className='text-muted'>-</span>
                  )}
                </div>
              </td>
              <td className='text-end'>
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
                        onEdit(job)
                      }}
                    >
                      Edit
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
                      Delete
                    </a>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
