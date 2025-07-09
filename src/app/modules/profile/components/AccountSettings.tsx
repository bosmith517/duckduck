import React, { useState } from 'react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import clsx from 'clsx'
import { useSupabaseAuth } from '../../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../../supabaseClient'
import { showToast } from '../../../utils/toast'

const accountSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('First name is required'),
  last_name: Yup.string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .required('Last name is required'),
  email: Yup.string()
    .email('Invalid email format')
    .required('Email is required'),
  phone: Yup.string()
    .matches(/^[\+]?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  title: Yup.string()
    .max(100, 'Maximum 100 characters')
})

const passwordSchema = Yup.object().shape({
  current_password: Yup.string()
    .min(6, 'Minimum 6 characters')
    .required('Current password is required'),
  new_password: Yup.string()
    .min(6, 'Minimum 6 characters')
    .required('New password is required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('new_password')], 'Passwords must match')
    .required('Please confirm your password')
})

export const AccountSettings: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)

  const accountFormik = useFormik({
    initialValues: {
      first_name: userProfile?.first_name || '',
      last_name: userProfile?.last_name || '',
      email: userProfile?.email || '',
      phone: (userProfile as any)?.phone || '',
      title: (userProfile as any)?.title || ''
    },
    validationSchema: accountSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!userProfile?.id) return

      setLoading(true)
      const loadingToast = showToast.loading('Updating account information...')

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            first_name: values.first_name,
            last_name: values.last_name,
            phone: values.phone,
            title: values.title,
            updated_at: new Date().toISOString()
          })
          .eq('id', userProfile.id)

        if (error) throw error

        // Update email requires separate auth call
        if (values.email !== userProfile.email) {
          const { error: emailError } = await supabase.auth.updateUser({
            email: values.email
          })

          if (emailError) throw emailError
          showToast.info('Please check your new email for verification')
        }

        showToast.dismiss(loadingToast)
        showToast.success('Account information updated successfully!')

      } catch (error: any) {
        // Error handled via toast notification
        showToast.dismiss(loadingToast)
        showToast.error(error.message || 'Failed to update account information')
      } finally {
        setLoading(false)
      }
    }
  })

  const passwordFormik = useFormik({
    initialValues: {
      current_password: '',
      new_password: '',
      confirm_password: ''
    },
    validationSchema: passwordSchema,
    onSubmit: async (values) => {
      setPasswordLoading(true)
      const loadingToast = showToast.loading('Updating password...')

      try {
        const { error } = await supabase.auth.updateUser({
          password: values.new_password
        })

        if (error) throw error

        showToast.dismiss(loadingToast)
        showToast.success('Password updated successfully!')
        passwordFormik.resetForm()

      } catch (error: any) {
        // Error handled via toast notification
        showToast.dismiss(loadingToast)
        showToast.error(error.message || 'Failed to update password')
      } finally {
        setPasswordLoading(false)
      }
    }
  })

  return (
    <div className='row'>
      <div className='col-xl-6'>
        {/* Account Information */}
        <div className='card mb-5 mb-xl-10'>
          <div className='card-header border-0 cursor-pointer'>
            <div className='card-title m-0'>
              <h3 className='fw-bolder m-0'>Account Information</h3>
            </div>
          </div>

          <div className='card-body border-top p-9'>
            <form onSubmit={accountFormik.handleSubmit} noValidate className='form'>
              <div className='row mb-6'>
                <div className='col-lg-6'>
                  <label className='required fw-bold fs-6 mb-2'>First Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid mb-3 mb-lg-0',
                      {'is-invalid': accountFormik.touched.first_name && accountFormik.errors.first_name},
                      {'is-valid': accountFormik.touched.first_name && !accountFormik.errors.first_name}
                    )}
                    placeholder='First name'
                    {...accountFormik.getFieldProps('first_name')}
                  />
                  {accountFormik.touched.first_name && accountFormik.errors.first_name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{accountFormik.errors.first_name}</span>
                    </div>
                  )}
                </div>

                <div className='col-lg-6'>
                  <label className='required fw-bold fs-6 mb-2'>Last Name</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': accountFormik.touched.last_name && accountFormik.errors.last_name},
                      {'is-valid': accountFormik.touched.last_name && !accountFormik.errors.last_name}
                    )}
                    placeholder='Last name'
                    {...accountFormik.getFieldProps('last_name')}
                  />
                  {accountFormik.touched.last_name && accountFormik.errors.last_name && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{accountFormik.errors.last_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='row mb-6'>
                <div className='col-lg-6'>
                  <label className='required fw-bold fs-6 mb-2'>Email</label>
                  <input
                    type='email'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': accountFormik.touched.email && accountFormik.errors.email},
                      {'is-valid': accountFormik.touched.email && !accountFormik.errors.email}
                    )}
                    placeholder='Email address'
                    {...accountFormik.getFieldProps('email')}
                  />
                  {accountFormik.touched.email && accountFormik.errors.email && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{accountFormik.errors.email}</span>
                    </div>
                  )}
                </div>

                <div className='col-lg-6'>
                  <label className='fw-bold fs-6 mb-2'>Phone</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': accountFormik.touched.phone && accountFormik.errors.phone},
                      {'is-valid': accountFormik.touched.phone && !accountFormik.errors.phone}
                    )}
                    placeholder='Phone number'
                    {...accountFormik.getFieldProps('phone')}
                  />
                  {accountFormik.touched.phone && accountFormik.errors.phone && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{String(accountFormik.errors.phone)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='row mb-6'>
                <div className='col-lg-12'>
                  <label className='fw-bold fs-6 mb-2'>Job Title</label>
                  <input
                    type='text'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': accountFormik.touched.title && accountFormik.errors.title},
                      {'is-valid': accountFormik.touched.title && !accountFormik.errors.title}
                    )}
                    placeholder='Your job title'
                    {...accountFormik.getFieldProps('title')}
                  />
                  {accountFormik.touched.title && accountFormik.errors.title && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{String(accountFormik.errors.title)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='card-footer d-flex justify-content-end py-6 px-9'>
                <button
                  type='reset'
                  className='btn btn-light btn-active-light-primary me-2'
                  onClick={() => accountFormik.resetForm()}
                >
                  Reset
                </button>
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={loading}
                >
                  {loading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className='col-xl-6'>
        {/* Change Password */}
        <div className='card mb-5 mb-xl-10'>
          <div className='card-header border-0 cursor-pointer'>
            <div className='card-title m-0'>
              <h3 className='fw-bolder m-0'>Change Password</h3>
            </div>
          </div>

          <div className='card-body border-top p-9'>
            <form onSubmit={passwordFormik.handleSubmit} noValidate className='form'>
              <div className='row mb-6'>
                <div className='col-lg-12'>
                  <label className='required fw-bold fs-6 mb-2'>Current Password</label>
                  <input
                    type='password'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': passwordFormik.touched.current_password && passwordFormik.errors.current_password},
                      {'is-valid': passwordFormik.touched.current_password && !passwordFormik.errors.current_password}
                    )}
                    placeholder='Current password'
                    {...passwordFormik.getFieldProps('current_password')}
                  />
                  {passwordFormik.touched.current_password && passwordFormik.errors.current_password && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{passwordFormik.errors.current_password}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='row mb-6'>
                <div className='col-lg-12'>
                  <label className='required fw-bold fs-6 mb-2'>New Password</label>
                  <input
                    type='password'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': passwordFormik.touched.new_password && passwordFormik.errors.new_password},
                      {'is-valid': passwordFormik.touched.new_password && !passwordFormik.errors.new_password}
                    )}
                    placeholder='New password'
                    {...passwordFormik.getFieldProps('new_password')}
                  />
                  {passwordFormik.touched.new_password && passwordFormik.errors.new_password && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{passwordFormik.errors.new_password}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='row mb-6'>
                <div className='col-lg-12'>
                  <label className='required fw-bold fs-6 mb-2'>Confirm New Password</label>
                  <input
                    type='password'
                    className={clsx(
                      'form-control form-control-solid',
                      {'is-invalid': passwordFormik.touched.confirm_password && passwordFormik.errors.confirm_password},
                      {'is-valid': passwordFormik.touched.confirm_password && !passwordFormik.errors.confirm_password}
                    )}
                    placeholder='Confirm new password'
                    {...passwordFormik.getFieldProps('confirm_password')}
                  />
                  {passwordFormik.touched.confirm_password && passwordFormik.errors.confirm_password && (
                    <div className='fv-plugins-message-container'>
                      <span role='alert'>{passwordFormik.errors.confirm_password}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='card-footer d-flex justify-content-end py-6 px-9'>
                <button
                  type='reset'
                  className='btn btn-light btn-active-light-primary me-2'
                  onClick={() => passwordFormik.resetForm()}
                >
                  Reset
                </button>
                <button
                  type='submit'
                  className='btn btn-primary'
                  disabled={passwordLoading}
                >
                  {passwordLoading && <span className='spinner-border spinner-border-sm align-middle me-2'></span>}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}