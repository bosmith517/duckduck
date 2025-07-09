import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../supabaseClient';
import clsx from 'clsx';
import { showToast } from '../../utils/toast';
import { USE_CUSTOM_PASSWORD_RESET } from '../../../config/passwordReset.config';

const resetPasswordSchema = Yup.object().shape({
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
      'Password must contain uppercase, lowercase, number and special character'
    )
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your password'),
});

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenData, setTokenData] = useState<{ email: string; userName: string } | null>(null);
  const token = searchParams.get('token');

  useEffect(() => {
    if (USE_CUSTOM_PASSWORD_RESET && token) {
      // Validate token for custom system
      validateToken();
    } else if (!USE_CUSTOM_PASSWORD_RESET) {
      // Check session for Supabase default system
      checkSession();
    } else {
      // No token provided for custom system
      setValidating(false);
      setIsValidToken(false);
    }
  }, [token]);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Reset password page - checking session:', session?.user?.email);
      
      if (error) {
        console.error('Error getting session:', error);
        setIsValidToken(false);
        return;
      }
      
      if (!session) {
        console.log('No session found on reset password page');
        setIsValidToken(false);
      } else {
        console.log('Valid session found for password reset');
        setIsValidToken(true);
      }
    } catch (err) {
      console.error('Error checking session:', err);
      setIsValidToken(false);
    } finally {
      setValidating(false);
    }
  };

  const validateToken = async () => {
    try {
      const response = await supabase.functions.invoke('reset-password/validate', {
        body: { token }
      });

      if (response.error) {
        console.error('Token validation error:', response.error);
        setIsValidToken(false);
        return;
      }

      if (response.data?.valid) {
        setIsValidToken(true);
        setTokenData({
          email: response.data.email,
          userName: response.data.userName
        });
      } else {
        setIsValidToken(false);
        showToast.error(response.data?.error || 'Invalid or expired reset link');
      }
    } catch (err) {
      console.error('Error validating token:', err);
      setIsValidToken(false);
    } finally {
      setValidating(false);
    }
  };

  const formik = useFormik({
    initialValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: resetPasswordSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setLoading(true);
      try {
        if (USE_CUSTOM_PASSWORD_RESET && token) {
          // Use custom reset password Edge Function
          const response = await supabase.functions.invoke('reset-password', {
            body: {
              token,
              newPassword: values.newPassword
            }
          });

          if (response.error) {
            throw new Error(response.error.message || 'Failed to reset password');
          }

          if (!response.data?.success) {
            throw new Error(response.data?.error || 'Failed to reset password');
          }
        } else {
          // Use Supabase default
          const { error } = await supabase.auth.updateUser({
            password: values.newPassword,
          });

          if (error) throw error;

          // Sign out to ensure clean state
          await supabase.auth.signOut();
        }

        showToast.success('Password reset successfully! Please log in with your new password.');
        navigate('/auth/login');
      } catch (error: any) {
        console.error('Password reset error:', error);
        showToast.error(error.message || 'Failed to reset password');
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    },
  });


  if (validating) {
    return (
      <div className="d-flex flex-column flex-root" style={{ minHeight: '100vh' }}>
        <div className="d-flex flex-center flex-column flex-lg-row-fluid">
          <div className="w-100 p-10" style={{ maxWidth: '500px' }}>
            <div className="text-center mb-10">
              <img
                alt="Logo"
                src="/media/logos/tradeworks-logo.png"
                className="h-60px mb-5"
              />
              <h1 className="text-dark fw-bolder mb-3">Validating Reset Link</h1>
              <div className="text-gray-500 fw-semibold fs-6">
                Please wait while we validate your password reset link...
              </div>
            </div>

            <div className="d-flex justify-content-center">
              <span className="spinner-border spinner-border-lg text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="d-flex flex-column flex-root" style={{ minHeight: '100vh' }}>
        <div className="d-flex flex-center flex-column flex-lg-row-fluid">
          <div className="w-100 p-10" style={{ maxWidth: '500px' }}>
            <div className="text-center mb-10">
              <img
                alt="Logo"
                src="/media/logos/tradeworks-logo.png"
                className="h-60px mb-5"
              />
              <h1 className="text-dark fw-bolder mb-3">Invalid or Expired Link</h1>
              <div className="text-gray-500 fw-semibold fs-6">
                This password reset link is invalid or has expired.
              </div>
            </div>

            <div className="alert alert-danger d-flex align-items-center mb-10">
              <i className="ki-duotone ki-information-5 fs-2hx text-danger me-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="d-flex flex-column">
                <h4 className="mb-1 text-danger">Link Invalid or Expired</h4>
                <span>This password reset link is no longer valid. This can happen if:
                  <ul className="mt-2 mb-0">
                    <li>The link has expired (links are valid for a limited time)</li>
                    <li>The link has already been used</li>
                    <li>A newer reset link was requested</li>
                  </ul>
                </span>
              </div>
            </div>

            <div className="text-center">
              <a href="/auth/login" className="btn btn-primary">
                Back to Login
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column flex-root" style={{ minHeight: '100vh' }}>
      <div className="d-flex flex-center flex-column flex-lg-row-fluid">
        <div className="w-100 p-10" style={{ maxWidth: '500px' }}>
          <form className="form w-100" onSubmit={formik.handleSubmit}>
            <div className="text-center mb-10">
              <img
                alt="Logo"
                src="/media/logos/tradeworks-logo.png"
                className="h-60px mb-5"
              />
              <h1 className="text-dark fw-bolder mb-3">Create New Password</h1>
              <div className="text-gray-500 fw-semibold fs-6">
                {USE_CUSTOM_PASSWORD_RESET && tokenData?.userName ? (
                  <>Hi {tokenData.userName}, please enter your new password below.</>
                ) : (
                  <>Please enter your new password below</>
                )}
              </div>
              {USE_CUSTOM_PASSWORD_RESET && tokenData?.email && (
                <div className="text-gray-400 fw-semibold fs-7 mt-2">
                  Account: {tokenData.email}
                </div>
              )}
            </div>

            <div className="fv-row mb-8">
              <label className="form-label fw-bolder text-dark fs-6">New Password</label>
              <div className="position-relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className={clsx(
                    'form-control bg-transparent',
                    { 'is-invalid': formik.touched.newPassword && formik.errors.newPassword }
                  )}
                  placeholder="Enter new password"
                  {...formik.getFieldProps('newPassword')}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute end-0 top-50 translate-middle-y pe-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                >
                  <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'} fs-4`}></i>
                </button>
                {formik.touched.newPassword && formik.errors.newPassword && (
                  <div className="invalid-feedback">{formik.errors.newPassword}</div>
                )}
              </div>
            </div>

            <div className="fv-row mb-8">
              <label className="form-label fw-bolder text-dark fs-6">Confirm Password</label>
              <div className="position-relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={clsx(
                    'form-control bg-transparent',
                    { 'is-invalid': formik.touched.confirmPassword && formik.errors.confirmPassword }
                  )}
                  placeholder="Confirm new password"
                  {...formik.getFieldProps('confirmPassword')}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute end-0 top-50 translate-middle-y pe-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'} fs-4`}></i>
                </button>
                {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                  <div className="invalid-feedback">{formik.errors.confirmPassword}</div>
                )}
              </div>
            </div>

            <div className="alert alert-info mb-8">
              <div className="d-flex align-items-center">
                <i className="ki-duotone ki-shield-tick fs-2hx text-info me-4">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                <div className="d-flex flex-column">
                  <h5 className="mb-1">Password Requirements</h5>
                  <span className="small">
                    • At least 8 characters<br/>
                    • One uppercase letter (A-Z)<br/>
                    • One lowercase letter (a-z)<br/>
                    • One number (0-9)<br/>
                    • One special character (!@#$%^&*)
                  </span>
                </div>
              </div>
            </div>

            <div className="d-grid mb-10">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !formik.isValid}
              >
                {loading ? (
                  <>
                    <span className="indicator-progress">
                      Please wait...
                      <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="indicator-label">Reset Password</span>
                    <i className="ki-duotone ki-arrow-right fs-3 ms-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                    </i>
                  </>
                )}
              </button>
            </div>

            <div className="text-gray-500 text-center fw-semibold fs-6">
              Remember your password?{' '}
              <a href="/auth/login" className="link-primary">
                Sign In
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
