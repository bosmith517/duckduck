import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../supabaseClient';
import clsx from 'clsx';
import { showToast } from '../../utils/toast';

interface ForgotPasswordModalProps {
  show: boolean;
  onHide: () => void;
}

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email format')
    .required('Email is required'),
});

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ show, onHide }) => {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: '',
    },
    validationSchema: forgotPasswordSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setLoading(true);
      try {
        // Use Supabase default password reset
        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });

        if (error) throw error;

        setEmailSent(true);
        showToast.success('Password reset email sent! Check your inbox.');
      } catch (error: any) {
        console.error('Password reset error:', error);
        // Check for rate limiting error
        if (error.message?.includes('Too many password reset attempts')) {
          showToast.error(error.message);
        } else {
          showToast.error(error.message || 'Failed to send reset email');
        }
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    setEmailSent(false);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Reset Password</Modal.Title>
      </Modal.Header>
      {emailSent ? (
        <Modal.Body>
          <div className="text-center py-5">
            <i className="bi bi-envelope-check text-success" style={{ fontSize: '4rem' }}></i>
            <h4 className="mt-3">Check Your Email</h4>
            <p className="text-muted">
              We've sent a password reset link to <strong>{formik.values.email}</strong>
            </p>
            <p className="text-muted small">
              If you don't see the email, check your spam folder or try again.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-3"
              onClick={handleClose}
            >
              Done
            </button>
          </div>
        </Modal.Body>
      ) : (
        <form onSubmit={formik.handleSubmit}>
          <Modal.Body>
            <p className="text-muted mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <div className="mb-5">
              <label className="form-label fw-bold">Email Address</label>
              <input
                type="email"
                className={clsx(
                  'form-control',
                  { 'is-invalid': formik.touched.email && formik.errors.email }
                )}
                placeholder="Enter your email"
                {...formik.getFieldProps('email')}
                disabled={loading}
                autoFocus
              />
              {formik.touched.email && formik.errors.email && (
                <div className="invalid-feedback">{formik.errors.email}</div>
              )}
            </div>

            <div className="alert alert-info d-flex align-items-center">
              <i className="bi bi-info-circle me-2"></i>
              <small>
                You'll receive an email with a secure link to reset your password. 
                The link expires in 1 hour.
              </small>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-light text-dark"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !formik.isValid}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
};
