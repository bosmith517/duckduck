import React, { useState, useEffect } from 'react'
import { MilestoneService, JobMilestone } from '../../../services/milestoneService'
import { showToast } from '../../../utils/toast'

interface PaymentScheduleProps {
  jobId: string
}

export const PaymentSchedule: React.FC<PaymentScheduleProps> = ({ jobId }) => {
  const [milestones, setMilestones] = useState<JobMilestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPaymentMilestones()
  }, [jobId])

  const loadPaymentMilestones = async () => {
    try {
      setLoading(true)
      const data = await MilestoneService.getMilestonesForJob(jobId)
      // Filter to only show payment milestones
      const paymentMilestones = data.filter(m => m.milestone_type === 'payment')
      setMilestones(paymentMilestones)
    } catch (error) {
      console.error('Error loading payment milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkMilestoneComplete = async (milestoneId: string) => {
    const loadingToast = showToast.loading('Updating milestone...')
    
    try {
      await MilestoneService.updateMilestoneStatus(
        milestoneId, 
        'completed', 
        'Payment milestone completed'
      )
      loadPaymentMilestones()
      showToast.dismiss(loadingToast)
      showToast.success('Payment milestone marked as completed!')
    } catch (error) {
      console.error('Error updating milestone:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to update milestone. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'pending': 'badge-light-warning',
      'in_progress': 'badge-light-info',
      'completed': 'badge-light-success',
      'skipped': 'badge-light-secondary'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const getTotalAmount = () => {
    return milestones.reduce((total, milestone) => total + (milestone.amount || 0), 0)
  }

  const getPaidAmount = () => {
    return milestones
      .filter(milestone => milestone.status === 'completed')
      .reduce((total, milestone) => total + (milestone.amount || 0), 0)
  }

  const getPendingAmount = () => {
    return milestones
      .filter(milestone => milestone.status === 'pending' || milestone.status === 'in_progress')
      .reduce((total, milestone) => total + (milestone.amount || 0), 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className='card card-bordered'>
      <div className='card-header'>
        <h3 className='card-title'>Payment Milestones</h3>
        <div className='card-toolbar'>
          <div className='text-muted fs-7'>
            {milestones.length === 0 ? 
              'No payment milestones. Go to Milestones tab to create them.' :
              `${milestones.length} payment milestone${milestones.length === 1 ? '' : 's'}`
            }
          </div>
        </div>
      </div>

      <div className='card-body'>
        {/* Payment Summary */}
        {milestones.length > 0 && (
          <div className='row mb-7'>
            <div className='col-md-4'>
              <div className='d-flex flex-column'>
                <span className='text-muted fw-semibold fs-7'>Total Payment Amount</span>
                <span className='text-dark fw-bold fs-3'>{formatCurrency(getTotalAmount())}</span>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='d-flex flex-column'>
                <span className='text-muted fw-semibold fs-7'>Completed</span>
                <span className='text-success fw-bold fs-3'>{formatCurrency(getPaidAmount())}</span>
              </div>
            </div>
            <div className='col-md-4'>
              <div className='d-flex flex-column'>
                <span className='text-muted fw-semibold fs-7'>Pending</span>
                <span className='text-warning fw-bold fs-3'>{formatCurrency(getPendingAmount())}</span>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className='text-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading...</span>
            </div>
          </div>
        ) : milestones.length === 0 ? (
          <div className='text-center py-10'>
            <div className='text-muted mb-3'>
              <i className='ki-duotone ki-dollar fs-3x text-muted mb-3'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
            <div className='text-muted mb-3'>
              No payment milestones defined yet.
            </div>
            <div className='text-muted fs-7'>
              Go to the <strong>Milestones</strong> tab to create a milestone schedule with payment milestones.
            </div>
          </div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
              <thead>
                <tr className='fw-bold text-muted'>
                  <th className='min-w-200px'>Payment Milestone</th>
                  <th className='min-w-120px'>Amount</th>
                  <th className='min-w-120px'>Target Date</th>
                  <th className='min-w-120px'>Status</th>
                  <th className='min-w-120px'>Completed</th>
                  <th className='min-w-100px text-end'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone) => (
                  <tr key={milestone.id}>
                    <td>
                      <div className='d-flex flex-column'>
                        <span className='text-dark fw-bold fs-6'>{milestone.milestone_name}</span>
                        {milestone.percentage_of_total && (
                          <span className='text-muted fw-semibold fs-7'>
                            {milestone.percentage_of_total}% of total job value
                          </span>
                        )}
                        {milestone.requirements && (
                          <span className='text-muted fs-8'>
                            {milestone.requirements}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className='text-success fw-bold fs-6'>
                        {formatCurrency(milestone.amount || 0)}
                      </span>
                    </td>
                    <td>
                      <span className='text-dark fw-bold fs-6'>
                        {milestone.target_date ? 
                          new Date(milestone.target_date).toLocaleDateString() : 
                          'TBD'
                        }
                      </span>
                    </td>
                    <td>
                      <span className={getStatusBadge(milestone.status)}>
                        {milestone.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {milestone.completed_at ? (
                        <span className='text-success fw-bold fs-7'>
                          {new Date(milestone.completed_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className='text-muted'>-</span>
                      )}
                    </td>
                    <td>
                      <div className='d-flex justify-content-end flex-shrink-0'>
                        {milestone.status === 'pending' && (
                          <button
                            className='btn btn-icon btn-bg-light btn-active-color-info btn-sm me-1'
                            title='Mark In Progress'
                            onClick={() => handleMarkMilestoneComplete(milestone.id)}
                          >
                            <i className='ki-duotone ki-play fs-3'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                          </button>
                        )}
                        {milestone.status === 'in_progress' && (
                          <button
                            className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                            title='Mark Complete'
                            onClick={() => handleMarkMilestoneComplete(milestone.id)}
                          >
                            <i className='ki-duotone ki-check fs-3'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                            </i>
                          </button>
                        )}
                        <a
                          href='#'
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm'
                          title='View in Milestones Tab'
                          onClick={(e) => {
                            e.preventDefault()
                            // Switch to milestones tab
                            const event = new CustomEvent('switchToMilestonesTab')
                            window.dispatchEvent(event)
                          }}
                        >
                          <i className='ki-duotone ki-eye fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                          </i>
                        </a>
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
  )
}