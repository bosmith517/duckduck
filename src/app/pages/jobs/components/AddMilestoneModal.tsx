import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'

interface AddMilestoneModalProps {
  jobId: string
  onSave: (milestoneData: any) => Promise<void>
  onCancel: () => void
}

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
    .min(new Date(), 'Due date must be in the future')
    .required('Due date is required'),
  status: Yup.string()
    .oneOf(['Pending', 'Ready to Invoice', 'Invoiced', 'Paid'])
    .required('Status is required'),
})

export const AddMilestoneModal: React.FC<AddMilestoneModalProps> = ({ 
  jobId, 
  onSave, 
  onCancel 
}) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      milestone_name: '',
      amount_due: '',
      due_date: '',
      status: 'Pending',
      notes: '',
    },
    validationSchema: milestoneSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        const milestoneData = {
          job_id: jobId,
          milestone_name: values.milestone_name,
          amount_due: Number(values.amount_due),
          due_date: values.due_date,
          status: values.status,
        }
        await onSave(milestoneData)
      } catch (error) {
        console.error('Error saving milestone:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-lg' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>Add Payment Milestone</h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              <div className='mb-5'>
                <div className='text-muted'>
                  Add a new payment milestone to this job. This will create a billing checkpoint that can later be converted into an invoice.
                </div>
              </div>

              <div className='row'>
                {/* Milestone Name */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Milestone Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.milestone_name && formik.errors.milestone_name},
                      {'is-valid': formik.touched.milestone_name && !formik.errors.milestone_name}
                    )}
                    placeholder='e.g., Project Start, Materials Delivered, Completion'
                    {...formik.getFieldProps('milestone_name')}
                  />
                  {formik.touched.milestone_name && formik.errors.milestone_name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.milestone_name}</span>
                    </div>
                  )}
                </div>

                {/* Amount Due */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Amount Due</label>
                  <div className='input-group'>
                    <span className='input-group-text'>$</span>
                    <input
                      type='number'
                      step='0.01'
                      min='0'
                      className={clsx(
                        'form-control form-control-solid',
                        {'is-invalid': formik.touched.amount_due && formik.errors.amount_due},
                        {'is-valid': formik.touched.amount_due && !formik.errors.amount_due}
                      )}
                      placeholder='0.00'
                      {...formik.getFieldProps('amount_due')}
                    />
                  </div>
                  {formik.touched.amount_due && formik.errors.amount_due && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.amount_due}</span>
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Due Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.due_date && formik.errors.due_date},
                      {'is-valid': formik.touched.due_date && !formik.errors.due_date}
                    )}
                    {...formik.getFieldProps('due_date')}
                  />
                  {formik.touched.due_date && formik.errors.due_date && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.due_date}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Status</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.status && formik.errors.status},
                      {'is-valid': formik.touched.status && !formik.errors.status}
                    )}
                    {...formik.getFieldProps('status')}
                  >
                    <option value='Pending'>Pending</option>
                    <option value='Ready to Invoice'>Ready to Invoice</option>
                    <option value='Invoiced'>Invoiced</option>
                    <option value='Paid'>Paid</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className='modal-footer'>
              <button
                type='button'
                className='btn btn-light'
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='btn btn-primary'
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Adding...
                  </>
                ) : (
                  <>Add Milestone</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
