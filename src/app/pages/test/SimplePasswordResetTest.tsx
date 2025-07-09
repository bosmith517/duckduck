import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create a direct Supabase client for testing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const testSupabase = createClient(supabaseUrl, supabaseAnonKey);

export const SimplePasswordResetTest: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testPasswordReset = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing password reset for:', email);
      console.log('Supabase URL:', supabaseUrl);
      console.log('Redirect URL:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await testSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      
      console.log('Reset response:', { data, error });
      
      if (error) {
        setResult({ 
          error: error.message,
          details: error
        });
      } else {
        setResult({ 
          success: true, 
          message: 'Password reset email sent! Check your inbox.',
          redirectUrl: `${window.location.origin}/auth/callback`,
          supabaseUrl: supabaseUrl
        });
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Password Reset Test Page</h1>
      
      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Test Password Reset</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>Email Address:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '8px',
              marginTop: '5px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <button 
          onClick={testPasswordReset}
          disabled={!email || loading}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !email ? 'not-allowed' : 'pointer',
            opacity: loading || !email ? 0.6 : 1
          }}
        >
          {loading ? 'Sending...' : 'Send Password Reset Email'}
        </button>
        
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Expected redirect URL: {window.location.origin}/auth/callback
        </div>
      </div>

      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          backgroundColor: result.error ? '#fee' : '#efe',
          border: `1px solid ${result.error ? '#fcc' : '#cfc'}`,
          borderRadius: '8px'
        }}>
          <h3>Result:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h4>Debug Information:</h4>
        <ul>
          <li>Current Origin: {window.location.origin}</li>
          <li>Expected Callback: {window.location.origin}/auth/callback</li>
          <li>Supabase URL: {supabaseUrl || 'NOT SET'}</li>
          <li>Has Anon Key: {supabaseAnonKey ? 'Yes' : 'No'}</li>
        </ul>
        
        <h4 style={{ marginTop: '20px' }}>Check Console for Logs</h4>
        <p>Open browser DevTools (F12) and check the Console tab for detailed logs.</p>
      </div>
    </div>
  );
};