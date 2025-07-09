import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const SupabaseVerifyProxy: React.FC = () => {
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    // Get all query parameters
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const redirectTo = searchParams.get('redirect_to');
    
    if (token && type) {
      // Construct the correct Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const correctUrl = `${supabaseUrl}/auth/v1/verify?token=${token}&type=${type}&redirect_to=${encodeURIComponent(redirectTo || window.location.origin)}`;
      
      console.log('Redirecting to correct Supabase URL:', correctUrl);
      
      // Redirect to the correct Supabase endpoint
      window.location.href = correctUrl;
    }
  }, [searchParams]);
  
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
            <h1 className="text-dark fw-bolder mb-3">Verifying Your Request</h1>
            <div className="text-gray-500 fw-semibold fs-6">
              Please wait while we redirect you...
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
};