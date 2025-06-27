import React, { useState, useEffect } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Job, Account, Contact } from '../../../../supabaseClient'

interface JobFormProps {
  job?: Job | null
  accounts: Pick<Account, 'id' | 'name'>[]
  contacts: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'account_id'>[]
  onSave: (data: Partial<Job>) => void
  onCancel: () => void
}

const jobSchema = Yup.object().shape({
  title: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(200, 'Maximum 200 characters')
    .required('Job title is required'),
  account_id: Yup.string().required('Account is required'),
  contact_id: Yup.string(),
  description: Yup.string().max(2000, 'Maximum 2000 characters'),
  status: Yup.string().required('Status is required'),
  priority: Yup.string().required('Priority is required'),
  start_date: Yup.date(),
  due_date: Yup.date(),
  estimated_hours: Yup.number().min(0, 'Must be positive').max(9999, 'Maximum 9999 hours'),
  actual_hours: Yup.number().min(0, 'Must be positive').max(9999, 'Maximum 9999 hours'),
  estimated_cost: Yup.number().min(0, 'Must be positive').max(999999, 'Maximum $999,999'),
  actual_cost: Yup.number().min(0, 'Must be positive').max(999999, 'Maximum $999,999'),
  location_address: Yup.string().max(200, 'Maximum 200 characters'),
  location_city: Yup.string().max(100, 'Maximum 100 characters'),
  location_state: Yup.string().max(50, 'Maximum 50 characters'),
  location_zip: Yup.string().max(20, 'Maximum 20 characters'),
  notes: Yup.string().max(2000, 'Maximum 2000 characters'),
})

export const JobForm: React.FC<JobFormProps> = ({ job, accounts, contacts, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false)
  const [filteredContacts, setFilteredContacts] = useState<typeof contacts>([])

  const formik = useFormik({
    initialValues: {
      title: job?.title || '',
      account_id: job?.account_id || '',
      contact_id: job?.contact_id || '',
      description: job?.description || '',
      status: job?.status || 'draft',
      priority: job?.priority || 'medium',
      start_date: job?.start_date ? job.start_date.split('T')[0] : '',
      due_date: job?.due_date ? job.due_date.split('T')[0] : '',
      estimated_hours: job?.estimated_hours || '',
      actual_hours: job?.actual_hours || '',
      estimated_cost: job?.estimated_cost || '',
      actual_cost: job?.actual_cost || '',
      location_address: job?.location_address || '',
      location_city: job?.location_city || '',
      location_state: job?.location_state || '',
      location_zip: job?.location_zip || '',
      notes: job?.notes || '',
    },
    validationSchema: jobSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        const submitData = {
          ...values,
          contact_id: values.contact_id || undefined,
          start_date: values.start_date || undefined,
          due_date: values.due_date || undefined,
          estimated_hours: values.estimated_hours ? Number(values.estimated_hours) : undefined,
          actual_hours: values.actual_hours ? Number(values.actual_hours) : undefined,
          estimated_cost: values.estimated_cost ? Number(values.estimated_cost) : undefined,
          actual_cost: values.actual_cost ? Number(values.actual_cost) : undefined,
        }
        await onSave(submitData)
      } catch (error) {
        console.error('Error saving job:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  // Filter contacts based on selected account
  useEffect(() => {
    if (formik.values.account_id) {
      const accountContacts = contacts.filter(contact => contact.account_id === formik.values.account_id)
      setFilteredContacts(accountContacts)
      
      // Clear contact selection if it's not valid for the selected account
      if (formik.values.contact_id && !accountContacts.find(c => c.id === formik.values.contact_id)) {
        formik.setFieldValue('contact_id', '')
      }
    } else {
      setFilteredContacts([])
      formik.setFieldValue('contact_id', '')
    }
  }, [formik.values.account_id, contacts])

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {job ? 'Edit Job' : 'Create New Job'}
            </h5>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              aria-label='Close'
            ></button>
          </div>

          <form onSubmit={formik.handleSubmit} noValidate>
            <div className='modal-body'>
              <div className='row'>
                {/* Job Title */}
                <div className='col-md-8 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Job Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.title && formik.errors.title},
                      {'is-valid': formik.touched.title && !formik.errors.title}
                    )}
                    placeholder='Enter job title'
                    {...formik.getFieldProps('title')}
                  />
                  {formik.touched.title && formik.errors.title && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.title}</span>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div className='col-md-4 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Priority</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.priority && formik.errors.priority},
                      {'is-valid': formik.touched.priority && !formik.errors.priority}
                    )}
                    {...formik.getFieldProps('priority')}
                  >
                    <option value='low'>Low</option>
                    <option value='medium'>Medium</option>
                    <option value='high'>High</option>
                    <option value='urgent'>Urgent</option>
                  </select>
                  {formik.touched.priority && formik.errors.priority && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.priority}</span>
                    </div>
                  )}
                </div>

                {/* Account */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Account</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.account_id && formik.errors.account_id},
                      {'is-valid': formik.touched.account_id && !formik.errors.account_id}
                    )}
                    {...formik.getFieldProps('account_id')}
                  >
                    <option value=''>Select an account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {formik.touched.account_id && formik.errors.account_id && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.account_id}</span>
                    </div>
                  )}
                </div>

                {/* Contact */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Contact</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.contact_id && formik.errors.contact_id},
                      {'is-valid': formik.touched.contact_id && !formik.errors.contact_id}
                    )}
                    {...formik.getFieldProps('contact_id')}
                    disabled={!formik.values.account_id}
                  >
                    <option value=''>Select a contact (optional)</option>
                    {filteredContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                      </option>
                    ))}
                  </select>
                  {formik.touched.contact_id && formik.errors.contact_id && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.contact_id}</span>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className='col-md-4 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Status</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.status && formik.errors.status},
                      {'is-valid': formik.touched.status && !formik.errors.status}
                    )}
                    {...formik.getFieldProps('status')}
                  >
                    <option value='draft'>Draft</option>
                    <option value='scheduled'>Scheduled</option>
                    <option value='in_progress'>In Progress</option>
                    <option value='completed'>Completed</option>
                    <option value='on_hold'>On Hold</option>
                    <option value='cancelled'>Cancelled</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Start Date */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Start Date</label>
                  <input
                    type='date'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.start_date && formik.errors.start_date},
                      {'is-valid': formik.touched.start_date && !formik.errors.start_date}
                    )}
                    {...formik.getFieldProps('start_date')}
                  />
                  {formik.touched.start_date && formik.errors.start_date && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.start_date}</span>
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Due Date</label>
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

                {/* Description */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Description</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.description && formik.errors.description},
                      {'is-valid': formik.touched.description && !formik.errors.description}
                    )}
                    rows={4}
                    placeholder='Enter job description'
                    {...formik.getFieldProps('description')}
                  />
                  {formik.touched.description && formik.errors.description && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.description}</span>
                    </div>
                  )}
                </div>

                {/* Estimated Hours */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Estimated Hours</label>
                  <input
                    type='number'
                    step='0.5'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.estimated_hours && formik.errors.estimated_hours},
                      {'is-valid': formik.touched.estimated_hours && !formik.errors.estimated_hours}
                    )}
                    placeholder='0.0'
                    {...formik.getFieldProps('estimated_hours')}
                  />
                  {formik.touched.estimated_hours && formik.errors.estimated_hours && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.estimated_hours}</span>
                    </div>
                  )}
                </div>

                {/* Actual Hours */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Actual Hours</label>
                  <input
                    type='number'
                    step='0.5'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.actual_hours && formik.errors.actual_hours},
                      {'is-valid': formik.touched.actual_hours && !formik.errors.actual_hours}
                    )}
                    placeholder='0.0'
                    {...formik.getFieldProps('actual_hours')}
                  />
                  {formik.touched.actual_hours && formik.errors.actual_hours && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.actual_hours}</span>
                    </div>
                  )}
                </div>

                {/* Estimated Cost */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Estimated Cost</label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.estimated_cost && formik.errors.estimated_cost},
                      {'is-valid': formik.touched.estimated_cost && !formik.errors.estimated_cost}
                    )}
                    placeholder='0.00'
                    {...formik.getFieldProps('estimated_cost')}
                  />
                  {formik.touched.estimated_cost && formik.errors.estimated_cost && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.estimated_cost}</span>
                    </div>
                  )}
                </div>

                {/* Actual Cost */}
                <div className='col-md-3 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Actual Cost</label>
                  <input
                    type='number'
                    step='0.01'
                    min='0'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.actual_cost && formik.errors.actual_cost},
                      {'is-valid': formik.touched.actual_cost && !formik.errors.actual_cost}
                    )}
                    placeholder='0.00'
                    {...formik.getFieldProps('actual_cost')}
                  />
                  {formik.touched.actual_cost && formik.errors.actual_cost && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.actual_cost}</span>
                    </div>
                  )}
                </div>

                {/* Location Address */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Location Address</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.location_address && formik.errors.location_address},
                      {'is-valid': formik.touched.location_address && !formik.errors.location_address}
                    )}
                    placeholder='Enter job location address'
                    {...formik.getFieldProps('location_address')}
                  />
                  {formik.touched.location_address && formik.errors.location_address && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.location_address}</span>
                    </div>
                  )}
                </div>

                {/* Location City */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>City</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.location_city && formik.errors.location_city},
                      {'is-valid': formik.touched.location_city && !formik.errors.location_city}
                    )}
                    placeholder='Enter city'
                    {...formik.getFieldProps('location_city')}
                  />
                  {formik.touched.location_city && formik.errors.location_city && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.location_city}</span>
                    </div>
                  )}
                </div>

                {/* Location State */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>State</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.location_state && formik.errors.location_state},
                      {'is-valid': formik.touched.location_state && !formik.errors.location_state}
                    )}
                    placeholder='Enter state'
                    {...formik.getFieldProps('location_state')}
                  />
                  {formik.touched.location_state && formik.errors.location_state && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.location_state}</span>
                    </div>
                  )}
                </div>

                {/* Location ZIP */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>ZIP Code</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.location_zip && formik.errors.location_zip},
                      {'is-valid': formik.touched.location_zip && !formik.errors.location_zip}
                    )}
                    placeholder='Enter ZIP code'
                    {...formik.getFieldProps('location_zip')}
                  />
                  {formik.touched.location_zip && formik.errors.location_zip && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.location_zip}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Notes</label>
                  <textarea
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': formik.touched.notes && formik.errors.notes},
                      {'is-valid': formik.touched.notes && !formik.errors.notes}
                    )}
                    rows={4}
                    placeholder='Enter additional notes'
                    {...formik.getFieldProps('notes')}
                  />
                  {formik.touched.notes && formik.errors.notes && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.notes}</span>
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
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Saving...
                  </>
                ) : (
                  <>Save Job</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
