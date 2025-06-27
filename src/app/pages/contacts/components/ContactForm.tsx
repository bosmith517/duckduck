import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Contact, Account } from '../../../../supabaseClient'

interface ContactFormProps {
  contact?: Contact | null
  accounts: Pick<Account, 'id' | 'name'>[]
  onSave: (data: Partial<Contact>) => void
  onCancel: () => void
}

const contactSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('First name is required'),
  last_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('Last name is required'),
  account_id: Yup.string().required('Account is required'),
  title: Yup.string().max(100, 'Maximum 100 characters'),
  email: Yup.string().email('Invalid email format').max(100, 'Maximum 100 characters'),
  phone: Yup.string().max(20, 'Maximum 20 characters'),
  mobile: Yup.string().max(20, 'Maximum 20 characters'),
  is_primary: Yup.boolean(),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
})

export const ContactForm: React.FC<ContactFormProps> = ({ contact, accounts, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      first_name: contact?.first_name || '',
      last_name: contact?.last_name || '',
      account_id: contact?.account_id || '',
      title: contact?.title || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      mobile: contact?.mobile || '',
      is_primary: contact?.is_primary || false,
      notes: contact?.notes || '',
    },
    validationSchema: contactSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        await onSave(values)
      } catch (error) {
        console.error('Error saving contact:', error)
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
            <h5 className='modal-title'>
              {contact ? 'Edit Contact' : 'Add New Contact'}
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
                {/* First Name */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>First Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.first_name && formik.errors.first_name},
                      {'is-valid': formik.touched.first_name && !formik.errors.first_name}
                    )}
                    placeholder='Enter first name'
                    {...formik.getFieldProps('first_name')}
                  />
                  {formik.touched.first_name && formik.errors.first_name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.first_name}</span>
                    </div>
                  )}
                </div>

                {/* Last Name */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Last Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.last_name && formik.errors.last_name},
                      {'is-valid': formik.touched.last_name && !formik.errors.last_name}
                    )}
                    placeholder='Enter last name'
                    {...formik.getFieldProps('last_name')}
                  />
                  {formik.touched.last_name && formik.errors.last_name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.last_name}</span>
                    </div>
                  )}
                </div>

                {/* Account */}
                <div className='col-md-12 mb-7'>
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

                {/* Title */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Title</label>
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

                {/* Email */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Email</label>
                  <input
                    type='email'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.email && formik.errors.email},
                      {'is-valid': formik.touched.email && !formik.errors.email}
                    )}
                    placeholder='Enter email address'
                    {...formik.getFieldProps('email')}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.email}</span>
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Phone</label>
                  <input
                    type='tel'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.phone && formik.errors.phone},
                      {'is-valid': formik.touched.phone && !formik.errors.phone}
                    )}
                    placeholder='Enter phone number'
                    {...formik.getFieldProps('phone')}
                  />
                  {formik.touched.phone && formik.errors.phone && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.phone}</span>
                    </div>
                  )}
                </div>

                {/* Mobile */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Mobile</label>
                  <input
                    type='tel'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.mobile && formik.errors.mobile},
                      {'is-valid': formik.touched.mobile && !formik.errors.mobile}
                    )}
                    placeholder='Enter mobile number'
                    {...formik.getFieldProps('mobile')}
                  />
                  {formik.touched.mobile && formik.errors.mobile && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.mobile}</span>
                    </div>
                  )}
                </div>

                {/* Primary Contact */}
                <div className='col-md-6 mb-7'>
                  <div className='form-check form-check-custom form-check-solid'>
                    <input
                      className='form-check-input'
                      type='checkbox'
                      id='is_primary'
                      {...formik.getFieldProps('is_primary')}
                      checked={formik.values.is_primary}
                    />
                    <label className='form-check-label fw-semibold fs-6' htmlFor='is_primary'>
                      Primary Contact
                    </label>
                  </div>
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
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Saving...
                  </>
                ) : (
                  <>Save Contact</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
