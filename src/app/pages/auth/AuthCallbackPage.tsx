import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../supabaseClient';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Get the hash from URL (Supabase sends auth data in URL hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      // Check for auth tokens in URL
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      console.log('Auth callback params:', { accessToken, refreshToken, type });

      if (accessToken && refreshToken) {
        // Set the session using the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          setError(error.message);
          setLoading(false);
          return;
        }

        console.log('Session set successfully:', data);

        // Check the type of auth callback
        if (type === 'recovery') {
          // This is a password reset
          console.log('Password recovery callback detected');
          navigate('/auth/reset-password');
        } else if (type === 'invite') {
          // This is an invite - user needs to set initial password
          console.log('Invite callback detected - redirecting to password setup');
          navigate('/auth/password-setup');
        } else if (type === 'signup') {
          // This is an email confirmation
          console.log('Signup confirmation callback detected');
          navigate('/dashboard');
        } else {
          // Default to dashboard
          console.log('Default auth callback, redirecting to dashboard');
          navigate('/dashboard');
        }
      } else {
        // No auth tokens, check for errors
        const errorParam = searchParams.get('error') || hashParams.get('error');
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
        
        if (errorParam) {
          console.error('Auth callback error:', errorParam, errorDescription);
          setError(errorDescription || errorParam);
        } else {
          console.error('No auth tokens found in callback');
          setError('Invalid authentication callback');
        }
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Auth callback error:', err);
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  if (loading) {
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
              <h1 className="text-dark fw-bolder mb-3">Processing Authentication</h1>
              <div className="text-gray-500 fw-semibold fs-6">
                Please wait while we authenticate you...
              </div>
            </div>

            <div className="d-flex justify-content-center mb-10">
              <span className="spinner-border spinner-border-lg text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
              <h1 className="text-dark fw-bolder mb-3">Authentication Error</h1>
            </div>

            <div className="alert alert-danger d-flex align-items-center mb-10">
              <i className="ki-duotone ki-information-5 fs-2hx text-danger me-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="d-flex flex-column">
                <h4 className="mb-1 text-danger">Authentication Failed</h4>
                <span>{error}</span>
              </div>
            </div>

            <div className="text-center">
              <a href="/auth/login" className="btn btn-primary me-3">
                Back to Login
              </a>
              <a href="/auth/forgot-password" className="btn btn-light">
                Reset Password
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // This shouldn't be reached, but just in case
  return null;
};