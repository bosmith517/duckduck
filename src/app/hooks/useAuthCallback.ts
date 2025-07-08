import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export const useAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there are auth params in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    if (accessToken && refreshToken) {
      // We have auth tokens, process them
      handleAuthTokens(accessToken, refreshToken, type);
    }
  }, []);

  const handleAuthTokens = async (accessToken: string, refreshToken: string, type: string | null) => {
    try {
      console.log('Processing auth tokens from URL...', { type });

      // Set the session
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('Error setting session:', error);
        navigate('/auth/login');
        return;
      }

      console.log('Session set successfully');

      // Clear the hash from URL to prevent reprocessing
      window.history.replaceState(null, '', window.location.pathname);

      // Navigate based on type
      if (type === 'recovery') {
        navigate('/auth/reset-password');
      } else if (type === 'invite') {
        navigate('/auth/password-setup');
      } else if (type === 'magiclink') {
        // Magic link login - go to dashboard
        navigate('/dashboard');
      } else if (type === 'signup') {
        navigate('/dashboard');
      } else {
        // Default to dashboard
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error processing auth callback:', error);
      navigate('/auth/login');
    }
  };
};