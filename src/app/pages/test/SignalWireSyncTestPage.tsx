import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjust path if necessary

interface ApiResponse {
  [key: string]: any;
}

export const SignalWireSyncTestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<string | null>(null);

  const runTest = async (functionName: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setActiveTest(functionName);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(functionName);

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      setResponse(data);

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
      if (err.message.includes('401')) {
          setError(`Authentication failed (401). Please check that your API Token has the correct scopes (e.g., 'Numbers' or 'SIP Endpoints') enabled in the SignalWire dashboard.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">SignalWire Data Sync Test</h3>
        </div>
        <div className="card-body">
          <p>
            Use these buttons to fetch existing data from your SignalWire account. This verifies that your API credentials are correct and have the necessary permissions.
          </p>
          <div className="d-flex gap-3 mb-4">
            <button 
              className="btn btn-primary" 
              onClick={() => runTest('list-signalwire-phone-numbers')}
              disabled={loading}
            >
              {loading && activeTest === 'list-signalwire-phone-numbers' ? 'Loading...' : 'Fetch Phone Numbers'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => runTest('list-sip-endpoints')}
              disabled={loading}
            >
              {loading && activeTest === 'list-signalwire-sip-endpoints' ? 'Loading...' : 'Fetch SIP Endpoints'}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger">
              <h5>Error</h5>
              <p>{error}</p>
            </div>
          )}

          {response && (
            <div>
              <h5>API Response:</h5>
              <div className="alert alert-success">
                <pre style={{ maxHeight: '500px', overflow: 'auto' }}>
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignalWireSyncTestPage;

