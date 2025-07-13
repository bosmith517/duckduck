import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Estimate } from '../../../services/estimatesService'

interface PaymentMilestone {
  milestone_name: string
  amount_due: number
  due_date: string
  status: string
}

interface ConvertToJobModalProps {
  estimate: Estimate
  onConvert: (jobData: any, paymentSchedule: PaymentMilestone[]) => Promise<void>
  onCancel: () => void
}

const jobSchema = Yup.object().shape({
  title: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Job title is required'),
  description: Yup.string()
    .max(1000, 'Maximum 1000 characters')
    .required('Description is required'),
  priority: Yup.string()
    .oneOf(['low', 'medium', 'high', 'urgent'])
    .required('Priority is required'),
  start_date: Yup.date()
    .min(new Date(), 'Start date must be in the future')
    .required('Start date is required'),
  due_date: Yup.date()
    .min(Yup.ref('start_date'), 'Due date must be after start date')
    .required('Due date is required'),
})

const milestoneSchema = Yup.object().shape({
  milestone_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Milestone name is required'),
  amount_due: Yup.number()
    .min(0.01, 'Amount must be greater than 0')
    .max(999999, 'Maximum $999,999')
    .required('Amount is required'),
  due_date: Yup.date()
    .required('Due date is required'),
})

export const ConvertToJobModal: React.FC<ConvertToJobModalProps> = ({ 
  estimate, 
  onConvert, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Job Details, 2: Payment Schedule
  
  // Set default due dates: today for start, 30 days from now for completion
  const today = new Date()
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(today.getDate() + 30)
  
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentMilestone[]>([
    {
      milestone_name: 'Project Start (50%)',
      amount_due: estimate.total_amount * 0.5,
      due_date: today.toISOString().split('T')[0], // Format as YYYY-MM-DD
      status: 'Pending'
    },
    {
      milestone_name: 'Project Completion (50%)',
      amount_due: estimate.total_amount * 0.5,
      due_date: thirtyDaysFromNow.toISOString().split('T')[0], // Format as YYYY-MM-DD
      status: 'Pending'
    }
  ])

  const jobFormik = useFormik({
    initialValues: {
      title: estimate.project_title || '',
      description: estimate.description || '',
      priority: 'medium',
      start_date: today.toISOString().split('T')[0], // Default to today
      due_date: thirtyDaysFromNow.toISOString().split('T')[0], // Default to 30 days from now
      notes: estimate.notes || '',
    },
    validationSchema: jobSchema,
    onSubmit: (values) => {
      setStep(2)
    },
  })

  const milestoneFormik = useFormik({
    initialValues: {
      milestone_name: '',
      amount_due: '',
      due_date: '',
    },
    validationSchema: milestoneSchema,
    onSubmit: (values) => {
      const newMilestone: PaymentMilestone = {
        milestone_name: values.milestone_name,
        amount_due: Number(values.amount_due),
        due_date: values.due_date,
        status: 'Pending'
      }
      setPaymentSchedule([...paymentSchedule, newMilestone])
      milestoneFormik.resetForm()
    },
  })

  const handleRemoveMilestone = (index: number) => {
    setPaymentSchedule(paymentSchedule.filter((_, i) => i !== index))
  }

  const handleUpdateMilestoneDate = (index: number, newDate: string) => {
    const updatedSchedule = [...paymentSchedule]
    updatedSchedule[index].due_date = newDate
    setPaymentSchedule(updatedSchedule)
  }

  const handleConvertToJob = async () => {
    if (paymentSchedule.length === 0) {
      alert('Please add at least one payment milestone')
      return
    }

    // Check if all milestones have valid due dates
    const invalidMilestones = paymentSchedule.filter(m => !m.due_date)
    if (invalidMilestones.length > 0) {
      alert('Please set due dates for all payment milestones')
      return
    }

    const totalScheduleAmount = paymentSchedule.reduce((sum, milestone) => sum + milestone.amount_due, 0)
    if (Math.abs(totalScheduleAmount - estimate.total_amount) > 0.01) {
      alert(`Payment schedule total ($${totalScheduleAmount.toFixed(2)}) must equal estimate total ($${estimate.total_amount.toFixed(2)})`)
      return
    }

    setLoading(true)
    try {
      await onConvert(jobFormik.values, paymentSchedule)
    } catch (error: any) {
      console.error('Error converting to job:', error)
      // Show more specific error message to user
      const errorMessage = error?.message || 'Error converting estimate to job. Please try again.'
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const totalScheduleAmount = paymentSchedule.reduce((sum, milestone) => sum + milestone.amount_due, 0)

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              Convert Estimate to Job - Step {step} of 2
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <div className='modal-body'>
            {step === 1 && (
              <form onSubmit={jobFormik.handleSubmit} noValidate>
                <div className='mb-5'>
                  <h6 className='fw-bold text-gray-800 mb-3'>Job Details</h6>
                  <div className='text-muted mb-5'>
                    Converting estimate <strong>{estimate.estimate_number}</strong> for{' '}
                    <strong>{estimate.client_name}</strong> (${estimate.total_amount.toLocaleString()})
                  </div>
                </div>

                <div className='row'>
                  {/* Job Title */}
                  <div className='col-md-12 mb-7'>
                    <label className='required fw-semibold fs-6 mb-2'>Job Title</label>
                    <input
                      type='text'
                      className={clsx(
                        'form-control form-control-solid mb-3 mb-lg-0',
                        {'is-invalid': jobFormik.touched.title && jobFormik.errors.title},
                        {'is-valid': jobFormik.touched.title && !jobFormik.errors.title}
                      )}
                      placeholder='Enter job title'
                      {...jobFormik.getFieldProps('title')}
                    />
                    {jobFormik.touched.title && jobFormik.errors.title && (
                      <div className='fv-plugins-message-container'>
                        <span role='alert'>{jobFormik.errors.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className='col-md-12 mb-7'>
                    <label className='required fw-semibold fs-6 mb-2'>Description</label>
                    <textarea
                      className={clsx(
                        'form-control form-control-solid',
                        {'is-invalid': jobFormik.touched.description && jobFormik.errors.description},
                        {'is-valid': jobFormik.touched.description && !jobFormik.errors.description}
                      )}
                      rows={4}
                      placeholder='Enter job description'
                      {...jobFormik.getFieldProps('description')}
                    />
                    {jobFormik.touched.description && jobFormik.errors.description && (
                      <div className='fv-plugins-message-container'>
                        <span role='alert'>{jobFormik.errors.description}</span>
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <div className='col-md-4 mb-7'>
                    <label className='required fw-semibold fs-6 mb-2'>Priority</label>
                    <select
                      className={clsx(
                        'form-select form-select-solid',
                        {'is-invalid': jobFormik.touched.priority && jobFormik.errors.priority},
                        {'is-valid': jobFormik.touched.priority && !jobFormik.errors.priority}
                      )}
                      {...jobFormik.getFieldProps('priority')}
                    >
                      <option value='low'>Low</option>
                      <option value='medium'>Medium</option>
                      <option value='high'>High</option>
                      <option value='urgent'>Urgent</option>
                    </select>
                    {jobFormik.touched.priority && jobFormik.errors.priority && (
                      <div className='fv-plugins-message-container'>
                        <span role='alert'>{jobFormik.errors.priority}</span>
                      </div>
                    )}
                  </div>

                  {/* Start Date */}
                  <div className='col-md-4 mb-7'>
                    <label className='required fw-semibold fs-6 mb-2'>Start Date</label>
                    <input
                      type='date'
                      className={clsx(
                        'form-control form-control-solid mb-3 mb-lg-0',
                        {'is-invalid': jobFormik.touched.start_date && jobFormik.errors.start_date},
                        {'is-valid': jobFormik.touched.start_date && !jobFormik.errors.start_date}
                      )}
                      {...jobFormik.getFieldProps('start_date')}
                    />
                    {jobFormik.touched.start_date && jobFormik.errors.start_date && (
                      <div className='fv-plugins-message-container'>
                        <span role='alert'>{jobFormik.errors.start_date}</span>
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  <div className='col-md-4 mb-7'>
                    <label className='required fw-semibold fs-6 mb-2'>Due Date</label>
                    <input
                      type='date'
                      className={clsx(
                        'form-control form-control-solid mb-3 mb-lg-0',
                        {'is-invalid': jobFormik.touched.due_date && jobFormik.errors.due_date},
                        {'is-valid': jobFormik.touched.due_date && !jobFormik.errors.due_date}
                      )}
                      {...jobFormik.getFieldProps('due_date')}
                    />
                    {jobFormik.touched.due_date && jobFormik.errors.due_date && (
                      <div className='fv-plugins-message-container'>
                        <span role='alert'>{jobFormik.errors.due_date}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className='col-md-12 mb-7'>
                    <label className='fw-semibold fs-6 mb-2'>Notes</label>
                    <textarea
                      className='form-control form-control-solid'
                      rows={3}
                      placeholder='Enter additional notes'
                      {...jobFormik.getFieldProps('notes')}
                    />
                  </div>
                </div>

                <div className='d-flex justify-content-end'>
                  <button
                    type='button'
                    className='btn btn-light me-3'
                    onClick={onCancel}
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    className='btn btn-primary'
                    disabled={!jobFormik.isValid}
                  >
                    Next: Payment Schedule
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div>
                <div className='mb-5'>
                  <h6 className='fw-bold text-gray-800 mb-3'>Payment Schedule</h6>
                  <div className='text-muted mb-5'>
                    Define payment milestones for this job. Total must equal ${estimate.total_amount.toLocaleString()}.
                  </div>
                </div>

                {/* Add Milestone Form */}
                <form onSubmit={milestoneFormik.handleSubmit} noValidate className='mb-7'>
                  <div className='card card-bordered'>
                    <div className='card-header'>
                      <h6 className='card-title'>Add Payment Milestone</h6>
                    </div>
                    <div className='card-body'>
                      <div className='row'>
                        <div className='col-md-5 mb-3'>
                          <label className='required fw-semibold fs-6 mb-2'>Milestone Name</label>
                          <input
                            type='text'
                            className={clsx(
                              'form-control form-control-solid',
                              {'is-invalid': milestoneFormik.touched.milestone_name && milestoneFormik.errors.milestone_name}
                            )}
                            placeholder='e.g., Project Start, Completion'
                            {...milestoneFormik.getFieldProps('milestone_name')}
                          />
                          {milestoneFormik.touched.milestone_name && milestoneFormik.errors.milestone_name && (
                            <div className='fv-plugins-message-container'>
                              <span role='alert'>{milestoneFormik.errors.milestone_name}</span>
                            </div>
                          )}
                        </div>
                        <div className='col-md-3 mb-3'>
                          <label className='required fw-semibold fs-6 mb-2'>Amount</label>
                          <input
                            type='number'
                            step='0.01'
                            min='0'
                            className={clsx(
                              'form-control form-control-solid',
                              {'is-invalid': milestoneFormik.touched.amount_due && milestoneFormik.errors.amount_due}
                            )}
                            placeholder='0.00'
                            {...milestoneFormik.getFieldProps('amount_due')}
                          />
                          {milestoneFormik.touched.amount_due && milestoneFormik.errors.amount_due && (
                            <div className='fv-plugins-message-container'>
                              <span role='alert'>{milestoneFormik.errors.amount_due}</span>
                            </div>
                          )}
                        </div>
                        <div className='col-md-3 mb-3'>
                          <label className='required fw-semibold fs-6 mb-2'>Due Date</label>
                          <input
                            type='date'
                            className={clsx(
                              'form-control form-control-solid',
                              {'is-invalid': milestoneFormik.touched.due_date && milestoneFormik.errors.due_date}
                            )}
                            {...milestoneFormik.getFieldProps('due_date')}
                          />
                          {milestoneFormik.touched.due_date && milestoneFormik.errors.due_date && (
                            <div className='fv-plugins-message-container'>
                              <span role='alert'>{milestoneFormik.errors.due_date}</span>
                            </div>
                          )}
                        </div>
                        <div className='col-md-1 mb-3 d-flex align-items-end'>
                          <button
                            type='submit'
                            className='btn btn-primary'
                            disabled={!milestoneFormik.isValid}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Payment Schedule List */}
                <div className='card card-bordered mb-7'>
                  <div className='card-header'>
                    <h6 className='card-title'>Payment Milestones</h6>
                    <div className='card-toolbar'>
                      <span className={`badge ${Math.abs(totalScheduleAmount - estimate.total_amount) < 0.01 ? 'badge-success' : 'badge-warning'}`}>
                        Total: ${totalScheduleAmount.toFixed(2)} / ${estimate.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className='card-body'>
                    {paymentSchedule.length === 0 ? (
                      <div className='text-center text-muted py-5'>
                        No payment milestones added yet. Add at least one milestone to continue.
                      </div>
                    ) : (
                      <div className='table-responsive'>
                        <table className='table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4'>
                          <thead>
                            <tr className='fw-bold text-muted'>
                              <th>Milestone</th>
                              <th>Amount</th>
                              <th>Due Date</th>
                              <th>Status</th>
                              <th className='text-end'>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentSchedule.map((milestone, index) => (
                              <tr key={index}>
                                <td>
                                  <span className='text-dark fw-bold'>{milestone.milestone_name}</span>
                                </td>
                                <td>
                                  <span className='text-dark fw-bold'>${milestone.amount_due.toFixed(2)}</span>
                                </td>
                                <td>
                                  <input
                                    type='date'
                                    className='form-control form-control-sm'
                                    value={milestone.due_date}
                                    onChange={(e) => handleUpdateMilestoneDate(index, e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                  />
                                </td>
                                <td>
                                  <span className='badge badge-light-secondary'>{milestone.status}</span>
                                </td>
                                <td className='text-end'>
                                  <button
                                    type='button'
                                    className='btn btn-icon btn-bg-light btn-active-color-danger btn-sm'
                                    onClick={() => handleRemoveMilestone(index)}
                                    title='Remove'
                                  >
                                    <i className='ki-duotone ki-trash fs-3'>
                                      <span className='path1'></span>
                                      <span className='path2'></span>
                                      <span className='path3'></span>
                                      <span className='path4'></span>
                                      <span className='path5'></span>
                                    </i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className='d-flex justify-content-between'>
                  <button
                    type='button'
                    className='btn btn-light'
                    onClick={() => setStep(1)}
                  >
                    Back: Job Details
                  </button>
                  <div>
                    <button
                      type='button'
                      className='btn btn-light me-3'
                      onClick={onCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type='button'
                      className='btn btn-primary'
                      onClick={handleConvertToJob}
                      disabled={loading || paymentSchedule.length === 0 || Math.abs(totalScheduleAmount - estimate.total_amount) > 0.01 || paymentSchedule.some(m => !m.due_date)}
                    >
                      {loading ? (
                        <>
                          <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                          Converting...
                        </>
                      ) : (
                        <>Create Job & Payment Schedule</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
