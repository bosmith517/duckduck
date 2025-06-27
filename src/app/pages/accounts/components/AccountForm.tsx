import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { Account } from '../../../../supabaseClient'

// Declare Bootstrap Modal for TypeScript
declare global {
  interface Window {
    bootstrap: any;
  }
}

interface AccountFormProps {
  account?: Account | null
  onSave: (data: Partial<Account>) => void
  onCancel: () => void
}

const accountSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Account name is required'),
  account_status: Yup.string().max(50, 'Maximum 50 characters'),
  type: Yup.string().max(50, 'Maximum 50 characters'),
  industry: Yup.string().max(50, 'Maximum 50 characters'),
  phone: Yup.string().max(20, 'Maximum 20 characters'),
  email: Yup.string().email('Invalid email format').max(100, 'Maximum 100 characters'),
  website: Yup.string().url('Invalid URL format').max(200, 'Maximum 200 characters'),
  address_line1: Yup.string().max(100, 'Maximum 100 characters'),
  address_line2: Yup.string().max(100, 'Maximum 100 characters'),
  city: Yup.string().max(50, 'Maximum 50 characters'),
  state: Yup.string().max(50, 'Maximum 50 characters'),
  zip_code: Yup.string().max(20, 'Maximum 20 characters'),
  country: Yup.string().max(50, 'Maximum 50 characters'),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
})

export const AccountForm: React.FC<AccountFormProps> = ({ account, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      name: account?.name || '',
      account_status: account?.account_status || '',
      type: account?.type || '',
      industry: account?.industry || '',
      phone: account?.phone || '',
      email: account?.email || '',
      website: account?.website || '',
      address_line1: account?.address_line1 || '',
      address_line2: account?.address_line2 || '',
      city: account?.city || '',
      state: account?.state || '',
      zip_code: account?.zip_code || '',
      country: account?.country || '',
      notes: account?.notes || '',
    },
    validationSchema: accountSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        await onSave(values)
      } catch (error) {
        console.error('Error saving account:', error)
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
              {account ? 'Edit Account' : 'Add New Account'}
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
                {/* Account Name */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Account Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.name && formik.errors.name},
                      {'is-valid': formik.touched.name && !formik.errors.name}
                    )}
                    placeholder='Enter account name'
                    {...formik.getFieldProps('name')}
                  />
                  {formik.touched.name && formik.errors.name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.name}</span>
                    </div>
                  )}
                </div>

                {/* Account Status */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Account Status</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.account_status && formik.errors.account_status},
                      {'is-valid': formik.touched.account_status && !formik.errors.account_status}
                    )}
                    {...formik.getFieldProps('account_status')}
                  >
                    <option value=''>Select status</option>
                    <option value='active'>Active</option>
                    <option value='inactive'>Inactive</option>
                    <option value='pending'>Pending</option>
                    <option value='suspended'>Suspended</option>
                  </select>
                  {formik.touched.account_status && formik.errors.account_status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.account_status}</span>
                    </div>
                  )}
                </div>

                {/* Account Type */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Account Type</label>
                  <select
                    className={clsx(
                      'form-select form-select-solid',
                      {'is-invalid': formik.touched.type && formik.errors.type},
                      {'is-valid': formik.touched.type && !formik.errors.type}
                    )}
                    {...formik.getFieldProps('type')}
                  >
                    <option value=''>Select type</option>
                    <option value='prospect'>Prospect</option>
                    <option value='customer'>Customer</option>
                    <option value='vendor'>Vendor</option>
                    <option value='partner'>Partner</option>
                  </select>
                  {formik.touched.type && formik.errors.type && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.type}</span>
                    </div>
                  )}
                </div>

                {/* Industry */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Industry</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.industry && formik.errors.industry},
                      {'is-valid': formik.touched.industry && !formik.errors.industry}
                    )}
                    placeholder='Enter industry'
                    {...formik.getFieldProps('industry')}
                  />
                  {formik.touched.industry && formik.errors.industry && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.industry}</span>
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

                {/* Website */}
                <div className='col-md-6 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Website</label>
                  <input
                    type='url'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.website && formik.errors.website},
                      {'is-valid': formik.touched.website && !formik.errors.website}
                    )}
                    placeholder='Enter website URL'
                    {...formik.getFieldProps('website')}
                  />
                  {formik.touched.website && formik.errors.website && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.website}</span>
                    </div>
                  )}
                </div>

                {/* Address Line 1 */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Address Line 1</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.address_line1 && formik.errors.address_line1},
                      {'is-valid': formik.touched.address_line1 && !formik.errors.address_line1}
                    )}
                    placeholder='Enter street address'
                    {...formik.getFieldProps('address_line1')}
                  />
                  {formik.touched.address_line1 && formik.errors.address_line1 && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.address_line1}</span>
                    </div>
                  )}
                </div>

                {/* Address Line 2 */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Address Line 2</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.address_line2 && formik.errors.address_line2},
                      {'is-valid': formik.touched.address_line2 && !formik.errors.address_line2}
                    )}
                    placeholder='Apartment, suite, etc. (optional)'
                    {...formik.getFieldProps('address_line2')}
                  />
                  {formik.touched.address_line2 && formik.errors.address_line2 && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.address_line2}</span>
                    </div>
                  )}
                </div>

                {/* City */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>City</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.city && formik.errors.city},
                      {'is-valid': formik.touched.city && !formik.errors.city}
                    )}
                    placeholder='Enter city'
                    {...formik.getFieldProps('city')}
                  />
                  {formik.touched.city && formik.errors.city && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.city}</span>
                    </div>
                  )}
                </div>

                {/* State */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>State</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.state && formik.errors.state},
                      {'is-valid': formik.touched.state && !formik.errors.state}
                    )}
                    placeholder='Enter state'
                    {...formik.getFieldProps('state')}
                  />
                  {formik.touched.state && formik.errors.state && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.state}</span>
                    </div>
                  )}
                </div>

                {/* ZIP Code */}
                <div className='col-md-4 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>ZIP Code</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.zip_code && formik.errors.zip_code},
                      {'is-valid': formik.touched.zip_code && !formik.errors.zip_code}
                    )}
                    placeholder='Enter ZIP code'
                    {...formik.getFieldProps('zip_code')}
                  />
                  {formik.touched.zip_code && formik.errors.zip_code && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.zip_code}</span>
                    </div>
                  )}
                </div>

                {/* Country */}
                <div className='col-md-12 mb-7'>
                  <label className='fw-semibold fs-6 mb-2'>Country</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.country && formik.errors.country},
                      {'is-valid': formik.touched.country && !formik.errors.country}
                    )}
                    placeholder='Enter country'
                    {...formik.getFieldProps('country')}
                  />
                  {formik.touched.country && formik.errors.country && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.country}</span>
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
                  <>Save Account</>
                )}
              </button>
            </div>
          </form>
          </div>
        </div>
    </div>
  )
}
