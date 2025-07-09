import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

const passwordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/,
      'Must contain uppercase, lowercase, number and special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
})

export const PasswordSetupPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useSupabaseAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // If no user is logged in, redirect to login
    if (!user) {
      navigate('/auth/login')
    }
  }, [user, navigate])

  const formik = useFormik({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validationSchema: passwordSchema,
    onSubmit: async (values) => {
      setLoading(true)
      setError(null)

      try {
        // Update the user's password
        const { error: updateError } = await supabase.auth.updateUser({
          password: values.password,
        })

        if (updateError) throw updateError

        // Update user metadata to indicate password has been set
        await supabase.auth.updateUser({
          data: { password_set: true }
        })

        setSuccess(true)
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } catch (err: any) {
        // Error handled via UI
        setError(err.message || 'Failed to set password')
      } finally {
        setLoading(false)
      }
    },
  })

  return (
    <div className="d-flex flex-column flex-root">
      <div className="d-flex flex-column flex-lg-row flex-column-fluid">
        {/* Logo side */}
        <div className="d-flex flex-column flex-lg-row-fluid w-lg-50 p-10 order-2 order-lg-1">
          <div className="d-flex flex-center flex-column flex-lg-row-fluid">
            <div className="w-lg-500px p-10">
              <form className="form w-100" onSubmit={formik.handleSubmit}>
                <div className="text-center mb-10">
                  <h1 className="text-dark fw-bolder mb-3">Set Your Password</h1>
                  <div className="text-gray-500 fw-semibold fs-6">
                    {user?.email ? (
                      <>Setting password for: <strong>{user.email}</strong></>
                    ) : (
                      'Create a secure password for your account'
                    )}
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger d-flex align-items-center mb-5">
                    <i className="ki-duotone ki-information-5 fs-2hx text-danger me-4">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    <div className="d-flex flex-column">
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="alert alert-success d-flex align-items-center mb-5">
                    <i className="ki-duotone ki-check-circle fs-2hx text-success me-4">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                    <div className="d-flex flex-column">
                      <span>Password set successfully! Redirecting to dashboard...</span>
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div className="fv-row mb-8">
                  <label className="form-label fw-bolder text-dark fs-6 required">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    {...formik.getFieldProps('password')}
                    className={`form-control bg-transparent ${
                      formik.touched.password && formik.errors.password ? 'is-invalid' : ''
                    }`}
                  />
                  {formik.touched.password && formik.errors.password && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block">
                        <span role="alert">{formik.errors.password}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-muted fs-7 mt-2">
                    Must be at least 8 characters with uppercase, lowercase, number and special character
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="fv-row mb-8">
                  <label className="form-label fw-bolder text-dark fs-6 required">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    {...formik.getFieldProps('confirmPassword')}
                    className={`form-control bg-transparent ${
                      formik.touched.confirmPassword && formik.errors.confirmPassword
                        ? 'is-invalid'
                        : ''
                    }`}
                  />
                  {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                    <div className="fv-plugins-message-container">
                      <div className="fv-help-block">
                        <span role="alert">{formik.errors.confirmPassword}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="d-grid mb-10">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !formik.isValid || success}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Setting Password...
                      </>
                    ) : (
                      'Set Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Image side */}
        <div
          className="d-flex flex-lg-row-fluid w-lg-50 bgi-size-cover bgi-position-center order-1 order-lg-2"
          style={{
            backgroundImage: `url('/media/misc/auth-bg.png')`,
          }}
        >
          <div className="d-flex flex-column flex-center py-7 py-lg-15 px-5 px-md-15 w-100">
            <img
              className="d-none d-lg-block mx-auto w-275px w-md-50 w-xl-80 mb-10 mb-lg-20"
              src="/media/logos/tradeworks-logo-white.png"
              alt="TradeWorks Pro"
            />
            <h1 className="d-none d-lg-block text-white fs-2qx fw-bolder text-center mb-7">
              Welcome to TradeWorks Pro
            </h1>
            <div className="d-none d-lg-block text-white fs-base text-center">
              Your complete business management platform for service contractors.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}