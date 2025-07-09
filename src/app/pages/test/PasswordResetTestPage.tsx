import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { showToast } from '../../utils/toast';

export const PasswordResetTestPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testPasswordReset = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing password reset for:', email);
      console.log('Redirect URL:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      
      console.log('Reset response:', { data, error });
      
      if (error) {
        setResult({ error: error.message });
        showToast.error(error.message);
      } else {
        setResult({ 
          success: true, 
          message: 'Password reset email sent! Check your inbox.',
          redirectUrl: `${window.location.origin}/auth/callback`
        });
        showToast.success('Password reset email sent!');
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResult({ error: err.message });
      showToast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testSupabaseConnection = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Supabase connection test:', { 
        session: session?.user?.email,
        error,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL 
      });
      
      setResult({
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        hasSession: !!session,
        sessionEmail: session?.user?.email,
        error: error?.message
      });
    } catch (err: any) {
      setResult({ error: err.message });
    }
  };

  return (
    <div className="container py-10">
      <h1 className="mb-8">Password Reset Test Page</h1>
      
      <div className="card mb-5">
        <div className="card-header">
          <h3 className="card-title">Test Supabase Connection</h3>
        </div>
        <div className="card-body">
          <button 
            className="btn btn-primary"
            onClick={testSupabaseConnection}
          >
            Test Connection
          </button>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header">
          <h3 className="card-title">Test Password Reset</h3>
        </div>
        <div className="card-body">
          <div className="form-group mb-4">
            <label>Email Address</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>
          
          <button 
            className="btn btn-primary"
            onClick={testPasswordReset}
            disabled={!email || loading}
          >
            {loading ? 'Sending...' : 'Send Password Reset Email'}
          </button>
          
          <div className="mt-4">
            <small className="text-muted">
              Expected redirect URL: {window.location.origin}/auth/callback
            </small>
          </div>
        </div>
      </div>

      {result && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Result</h3>
          </div>
          <div className="card-body">
            <pre className="bg-light p-3 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      <div className="mt-5">
        <h4>Debug Information:</h4>
        <ul>
          <li>Current Origin: {window.location.origin}</li>
          <li>Expected Callback: {window.location.origin}/auth/callback</li>
          <li>Supabase URL: {import.meta.env.VITE_SUPABASE_URL}</li>
        </ul>
      </div>
    </div>
  );
};