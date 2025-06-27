import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'

export interface Client {
  id?: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  status: 'active' | 'inactive'
  notes?: string
}

interface ClientFormProps {
  client?: Client | null
  onSave: (data: Partial<Client>) => void
  onCancel: () => void
}

const clientSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(100, 'Maximum 100 characters')
    .required('Client name is required'),
  email: Yup.string()
    .email('Invalid email format')
    .max(100, 'Maximum 100 characters')
    .required('Email is required'),
  phone: Yup.string()
    .max(20, 'Maximum 20 characters')
    .required('Phone number is required'),
  address: Yup.string()
    .max(200, 'Maximum 200 characters')
    .required('Address is required'),
  city: Yup.string()
    .max(50, 'Maximum 50 characters')
    .required('City is required'),
  state: Yup.string()
    .max(50, 'Maximum 50 characters')
    .required('State is required'),
  zipCode: Yup.string()
    .max(20, 'Maximum 20 characters')
    .required('ZIP code is required'),
  status: Yup.string()
    .oneOf(['active', 'inactive'])
    .required('Status is required'),
  notes: Yup.string().max(1000, 'Maximum 1000 characters'),
})

export const ClientForm: React.FC<ClientFormProps> = ({ client, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false)

  const formik = useFormik({
    initialValues: {
      name: client?.name || '',
      email: client?.email || '',
      phone: client?.phone || '',
      address: client?.address || '',
      city: client?.city || '',
      state: client?.state || '',
      zipCode: client?.zipCode || '',
      status: client?.status || 'active',
      notes: client?.notes || '',
    },
    validationSchema: clientSchema,
    onSubmit: async (values) => {
      setLoading(true)
      try {
        await onSave(values)
      } catch (error) {
        console.error('Error saving client:', error)
      } finally {
        setLoading(false)
      }
    },
  })

  return (
    <div className='modal fade show d-block' tabIndex={-1} role='dialog'>
      <div className='modal-dialog modal-dialog-centered modal-xl' role='document'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h5 className='modal-title'>
              {client ? 'Edit Client' : 'Add New Client'}
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
                {/* Client Name */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Client Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.name && formik.errors.name},
                      {'is-valid': formik.touched.name && !formik.errors.name}
                    )}
                    placeholder='Enter client name'
                    {...formik.getFieldProps('name')}
                  />
                  {formik.touched.name && formik.errors.name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.name}</span>
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
                    <option value='active'>Active</option>
                    <option value='inactive'>Inactive</option>
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.status}</span>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className='col-md-6 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Email</label>
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
                  <label className='required fw-semibold fs-6 mb-2'>Phone</label>
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

                {/* Address */}
                <div className='col-md-12 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>Address</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.address && formik.errors.address},
                      {'is-valid': formik.touched.address && !formik.errors.address}
                    )}
                    placeholder='Enter street address'
                    {...formik.getFieldProps('address')}
                  />
                  {formik.touched.address && formik.errors.address && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.address}</span>
                    </div>
                  )}
                </div>

                {/* City */}
                <div className='col-md-4 mb-7'>
                  <label className='required fw-semibold fs-6 mb-2'>City</label>
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
                  <label className='required fw-semibold fs-6 mb-2'>State</label>
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
                  <label className='required fw-semibold fs-6 mb-2'>ZIP Code</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': formik.touched.zipCode && formik.errors.zipCode},
                      {'is-valid': formik.touched.zipCode && !formik.errors.zipCode}
                    )}
                    placeholder='Enter ZIP code'
                    {...formik.getFieldProps('zipCode')}
                  />
                  {formik.touched.zipCode && formik.errors.zipCode && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{formik.errors.zipCode}</span>
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
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                    Saving...
                  </>
                ) : (
                  <>Save Client</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
