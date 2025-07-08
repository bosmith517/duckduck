import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../supabaseClient';
import clsx from 'clsx';
import { showToast } from '../../utils/toast';

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
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  useEffect(() => {
    // Check if we have a valid session from the email link
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Reset password page - checking session:', session?.user?.email);
    
    if (!session) {
      console.log('No session found on reset password page');
      setIsValidToken(false);
    } else {
      console.log('Valid session found for password reset');
      setIsValidToken(true);
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
        const { error } = await supabase.auth.updateUser({
          password: values.newPassword,
        });

        if (error) throw error;

        showToast.success('Password reset successfully! Please log in with your new password.');
        
        // Sign out to ensure clean state
        await supabase.auth.signOut();
        
        // Redirect to login
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
                <h4 className="mb-1 text-danger">Link Expired</h4>
                <span>Password reset links expire after 1 hour for security reasons.</span>
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
                Please enter your new password below
              </div>
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
