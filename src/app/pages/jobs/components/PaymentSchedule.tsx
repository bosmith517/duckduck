import React, { useState, useEffect } from 'react'
import { paymentScheduleService, PaymentScheduleWithInvoice } from '../../../services/paymentScheduleService'
import { invoicesService } from '../../../services/invoicesService'
import { AddMilestoneModal } from './AddMilestoneModal'
import { showToast } from '../../../utils/toast'

interface PaymentScheduleProps {
  jobId: string
}

export const PaymentSchedule: React.FC<PaymentScheduleProps> = ({ jobId }) => {
  const [schedules, setSchedules] = useState<PaymentScheduleWithInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    loadPaymentSchedules()
  }, [jobId])

  const loadPaymentSchedules = async () => {
    try {
      setLoading(true)
      const data = await paymentScheduleService.getPaymentSchedulesByJobId(jobId)
      setSchedules(data)
    } catch (error) {
      console.error('Error loading payment schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMilestone = async (milestoneData: any) => {
    const loadingToast = showToast.loading('Adding milestone...')
    
    try {
      await paymentScheduleService.createPaymentSchedule(milestoneData)
      setShowAddModal(false)
      loadPaymentSchedules()
      showToast.dismiss(loadingToast)
      showToast.success('Payment milestone added successfully!')
    } catch (error) {
      console.error('Error adding milestone:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to add milestone. Please try again.')
    }
  }

  const handleGenerateInvoice = async (scheduleId: string) => {
    const loadingToast = showToast.loading('Generating invoice...')
    
    try {
      const invoice = await invoicesService.generateInvoiceFromMilestone(scheduleId)
      
      // Reload payment schedules to reflect the updated status
      await loadPaymentSchedules()
      
      showToast.dismiss(loadingToast)
      showToast.success(`Invoice ${invoice.invoice_number} generated successfully!`)
    } catch (error) {
      console.error('Error generating invoice:', error)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to generate invoice. Please try again.')
    }
  }

  const handleDeleteMilestone = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return
    
    // Optimistic UI update - remove milestone immediately
    const originalSchedules = [...schedules]
    setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId))
    
    const loadingToast = showToast.loading('Deleting milestone...')
    
    try {
      await paymentScheduleService.deletePaymentSchedule(scheduleId)
      showToast.dismiss(loadingToast)
      showToast.warning('Payment milestone deleted')
    } catch (error) {
      console.error('Error deleting milestone:', error)
      // Revert optimistic update on error
      setSchedules(originalSchedules)
      showToast.dismiss(loadingToast)
      showToast.error('Failed to delete milestone. Please try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusClasses = {
      'Pending': 'badge-light-secondary',
      'Ready to Invoice': 'badge-light-info',
      'Invoiced': 'badge-light-success',
      'Paid': 'badge-light-primary'
    }
    return `badge ${statusClasses[status as keyof typeof statusClasses] || 'badge-light-secondary'}`
  }

  const getTotalAmount = () => {
    return schedules.reduce((total, schedule) => total + schedule.amount_due, 0)
  }

  const getPaidAmount = () => {
    return schedules
      .filter(schedule => schedule.status === 'Paid')
      .reduce((total, schedule) => total + schedule.amount_due, 0)
  }

  const getInvoicedAmount = () => {
    return schedules
      .filter(schedule => schedule.status === 'Invoiced' || schedule.status === 'Paid')
      .reduce((total, schedule) => total + schedule.amount_due, 0)
  }

  return (
    <div className='card card-bordered'>
      <div className='card-header'>
        <h3 className='card-title'>Payment Schedule</h3>
        <div className='card-toolbar'>
          <button
            className='btn btn-sm btn-primary'
            onClick={() => setShowAddModal(true)}
          >
            <i className='ki-duotone ki-plus fs-2'></i>
            Add Milestone
          </button>
        </div>
      </div>

      <div className='card-body'>
        {/* Payment Summary */}
        <div className='row mb-7'>
          <div className='col-md-3'>
            <div className='d-flex flex-column'>
              <span className='text-muted fw-semibold fs-7'>Total Amount</span>
              <span className='text-dark fw-bold fs-3'>${getTotalAmount().toLocaleString()}</span>
            </div>
          </div>
          <div className='col-md-3'>
            <div className='d-flex flex-column'>
              <span className='text-muted fw-semibold fs-7'>Invoiced</span>
              <span className='text-info fw-bold fs-3'>${getInvoicedAmount().toLocaleString()}</span>
            </div>
          </div>
          <div className='col-md-3'>
            <div className='d-flex flex-column'>
              <span className='text-muted fw-semibold fs-7'>Paid</span>
              <span className='text-success fw-bold fs-3'>${getPaidAmount().toLocaleString()}</span>
            </div>
          </div>
          <div className='col-md-3'>
            <div className='d-flex flex-column'>
              <span className='text-muted fw-semibold fs-7'>Remaining</span>
              <span className='text-warning fw-bold fs-3'>${(getTotalAmount() - getPaidAmount()).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className='text-center py-10'>
            <div className='spinner-border text-primary' role='status'>
              <span className='visually-hidden'>Loading...</span>
            </div>
          </div>
        ) : schedules.length === 0 ? (
          <div className='text-center py-10'>
            <div className='text-muted mb-3'>
              <i className='ki-duotone ki-calendar fs-3x text-muted mb-3'>
                <span className='path1'></span>
                <span className='path2'></span>
              </i>
            </div>
            <div className='text-muted'>
              No payment milestones defined yet. Add your first milestone to start tracking payments for this job.
            </div>
          </div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
              <thead>
                <tr className='fw-bold text-muted'>
                  <th className='min-w-200px'>Milestone</th>
                  <th className='min-w-120px'>Amount</th>
                  <th className='min-w-120px'>Due Date</th>
                  <th className='min-w-120px'>Status</th>
                  <th className='min-w-120px'>Invoice</th>
                  <th className='min-w-100px text-end'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>
                      <div className='d-flex flex-column'>
                        <span className='text-dark fw-bold fs-6'>{schedule.milestone_name}</span>
                        <span className='text-muted fw-semibold fs-7'>
                          Created {new Date(schedule.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className='text-dark fw-bold fs-6'>
                        ${schedule.amount_due.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className='text-dark fw-bold fs-6'>
                        {new Date(schedule.due_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <span className={getStatusBadge(schedule.status)}>
                        {schedule.status}
                      </span>
                    </td>
                    <td>
                      {schedule.invoices ? (
                        <a href='#' className='text-primary fw-bold text-hover-primary fs-6'>
                          INV-{schedule.invoices.id.slice(-6)}
                        </a>
                      ) : (
                        <span className='text-muted'>-</span>
                      )}
                    </td>
                    <td>
                      <div className='d-flex justify-content-end flex-shrink-0'>
                        {(schedule.status === 'Pending' || schedule.status === 'Ready to Invoice') && !schedule.invoice_id && (
                          <button
                            className='btn btn-icon btn-bg-light btn-active-color-success btn-sm me-1'
                            title='Generate Invoice'
                            onClick={() => handleGenerateInvoice(schedule.id)}
                          >
                            <i className='ki-duotone ki-dollar fs-3'>
                              <span className='path1'></span>
                              <span className='path2'></span>
                              <span className='path3'></span>
                            </i>
                          </button>
                        )}
                        <button
                          className='btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1'
                          title='Edit Milestone'
                          onClick={() => {
                            // TODO: Implement edit functionality
                            alert('Edit milestone functionality will be added in a future update.')
                          }}
                        >
                          <i className='ki-duotone ki-pencil fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                          </i>
                        </button>
                        <button
                          className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                          title='Delete Milestone'
                          onClick={() => handleDeleteMilestone(schedule.id)}
                        >
                          <i className='ki-duotone ki-trash fs-3'>
                            <span className='path1'></span>
                            <span className='path2'></span>
                            <span className='path3'></span>
                            <span className='path4'></span>
                            <span className='path5'></span>
                          </i>
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

      {/* Add Milestone Modal */}
      {showAddModal && (
        <AddMilestoneModal
          jobId={jobId}
          onSave={handleAddMilestone}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}