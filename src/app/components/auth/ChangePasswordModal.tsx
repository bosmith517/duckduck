import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { supabase } from '../../../supabaseClient';
import clsx from 'clsx';
import { showToast } from '../../utils/toast';

interface ChangePasswordModalProps {
  show: boolean;
  onHide: () => void;
}

const passwordSchema = Yup.object().shape({
  currentPassword: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Current password is required'),
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

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ show, onHide }) => {
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: passwordSchema,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      setLoading(true);
      try {
        // First, verify current password by reauthenticating
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error('No user found');

        // Attempt to sign in with current password to verify it
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: values.currentPassword,
        });

        if (signInError) {
          setErrors({ currentPassword: 'Current password is incorrect' });
          return;
        }

        // Update password
        const { error: updateError } = await supabase.auth.updateUser({
          password: values.newPassword,
        });

        if (updateError) throw updateError;

        showToast.success('Password changed successfully!');
        formik.resetForm();
        onHide();
      } catch (error: any) {
        console.error('Password change error:', error);
        showToast.error(error.message || 'Failed to change password');
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Change Password</Modal.Title>
      </Modal.Header>
      <form onSubmit={formik.handleSubmit}>
        <Modal.Body>
          <div className="mb-5">
            <label className="form-label fw-bold">Current Password</label>
            <div className="position-relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                className={clsx(
                  'form-control',
                  { 'is-invalid': formik.touched.currentPassword && formik.errors.currentPassword }
                )}
                placeholder="Enter current password"
                {...formik.getFieldProps('currentPassword')}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-link position-absolute end-0 top-50 translate-middle-y pe-3"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                tabIndex={-1}
              >
                <i className={`bi ${showCurrentPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
              {formik.touched.currentPassword && formik.errors.currentPassword && (
                <div className="invalid-feedback">{formik.errors.currentPassword}</div>
              )}
            </div>
          </div>

          <div className="mb-5">
            <label className="form-label fw-bold">New Password</label>
            <div className="position-relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                className={clsx(
                  'form-control',
                  { 'is-invalid': formik.touched.newPassword && formik.errors.newPassword }
                )}
                placeholder="Enter new password"
                {...formik.getFieldProps('newPassword')}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-link position-absolute end-0 top-50 translate-middle-y pe-3"
                onClick={() => setShowNewPassword(!showNewPassword)}
                tabIndex={-1}
              >
                <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
              {formik.touched.newPassword && formik.errors.newPassword && (
                <div className="invalid-feedback">{formik.errors.newPassword}</div>
              )}
            </div>
            <div className="form-text">
              Password must be at least 8 characters with uppercase, lowercase, number and special character
            </div>
          </div>

          <div className="mb-5">
            <label className="form-label fw-bold">Confirm New Password</label>
            <div className="position-relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className={clsx(
                  'form-control',
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
                <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
              {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                <div className="invalid-feedback">{formik.errors.confirmPassword}</div>
              )}
            </div>
          </div>

          <div className="alert alert-info d-flex align-items-center">
            <i className="bi bi-info-circle me-2"></i>
            <div>
              <strong>Security Tips:</strong>
              <ul className="mb-0 mt-1">
                <li>Use a unique password for this account</li>
                <li>Don't share your password with anyone</li>
                <li>Change your password regularly</li>
              </ul>
            </div>
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
                Changing Password...
              </>
            ) : (
              'Change Password'
            )}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};
