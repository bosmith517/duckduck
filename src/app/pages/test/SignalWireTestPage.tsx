import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabaseClient'

// This interface can be expanded as needed
interface SignalWireApiResponse {
  success?: boolean
  data?: any[] | any // Allow both array and object formats
  details?: {
    hasSpaceUrl: boolean
    hasApiToken: boolean
    spaceUrlValue: string
    apiTokenValue: string
    constructedUrl: string
    timestamp: string
  }
  [key: string]: any; // Allow other properties
}

export const SignalWireTestPage: React.FC = () => {
  // --- Consolidated State ---
  const [loading, setLoading] = useState(false)
  const [apiResponse, setApiResponse] = useState<SignalWireApiResponse | null>(null) // Renamed to avoid conflicts
  const [error, setError] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState('') // Start with empty and fetch it
  
  // Softphone State
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([])
  const [myPhoneNumber, setMyPhoneNumber] = useState<string>('')
  const [phoneClient, setPhoneClient] = useState<any>(null)
  const [isRegistered, setIsRegistered] = useState<boolean>(false)
  const [onCall, setOnCall] = useState<boolean>(false)
  const [destinationNumber, setDestinationNumber] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<string>('Not connected.')
  const [activeCall, setActiveCall] = useState<any>(null)

  // --- Functions ---

  // Get user and tenant info on load
  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()
        
        if (userProfile?.tenant_id) {
          setTenantId(userProfile.tenant_id)
          console.log('Current user tenant ID:', userProfile.tenant_id)
        } else {
           console.log('User found, but no tenant ID in profile.')
        }
      }
    } catch (err) {
      console.error('Error getting user info:', err)
      setError('Could not retrieve user profile.')
    }
  }, [])

  useEffect(() => {
    getCurrentUser()
  }, [getCurrentUser])

  // Fetch phone numbers once tenantId is available
  const fetchPhoneNumbers = useCallback(async () => {
    if (!tenantId) return; // Don't run if we don't have a tenantId yet

    setStatusMessage('Fetching available phone numbers...')
    const { data, error: fetchError } = await supabase.functions.invoke('list-signalwire-phone-numbers', {
      body: { tenant_id: tenantId }
    })

    if (fetchError) {
      setError(`Error fetching numbers: ${fetchError.message}`)
      setStatusMessage('Error fetching numbers.')
      return
    }
    
    if (data.data && data.data.length > 0) {
      setPhoneNumbers(data.data)
      const number = data.data[0].number
      setMyPhoneNumber(number)
      setStatusMessage(`Found ${data.data.length} phone number(s). Using: ${number}`)
    } else {
      setPhoneNumbers([])
      setStatusMessage('No phone numbers found. Please purchase a number first.')
    }
  }, [tenantId])

  useEffect(() => {
    fetchPhoneNumbers()
  }, [fetchPhoneNumbers])

  const connectSoftphone = async () => {
    try {
        setStatusMessage('Checking authentication...');
        setError(null);

        // Check if user is authenticated first
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error('Please log in first before connecting the softphone');
        }

        setStatusMessage('Requesting Scoped Relay JWT...');

        // In a real multi-tenant app, you would fetch this from the user's profile.
        // For this test, we are defining it here. This is the SIP Endpoint you created.
        const sipEndpointUri = 'softphone@taurustech-015b3ce9166a.sip.signalwire.com'; // <-- Use your SIP Endpoint

        // Pass the SIP Endpoint as the 'resource' to the backend function.
        const { data, error: tokenError } = await supabase.functions.invoke('generate-signalwire-voice-token', {
            body: { resource: sipEndpointUri }
        });

        if (tokenError) throw new Error(`Token generation failed: ${tokenError.message}`);
        
        const { project, sip_username, tenant_id } = data;
        if (!project) throw new Error('Server did not return a valid project ID.');
        
        setStatusMessage(`Token received for tenant ${tenant_id}. Initializing Relay client...`);

        // Relay testing has been moved to the relay-service backend
        setApiResponse({ 
          success: true, 
          data: {
            message: 'Token generated successfully. Relay testing must be done server-side.',
            project_id: project,
            tenant_id: tenant_id,
            note: 'The @signalwire/realtime-api package only works in Node.js environments. Use the relay-service for real-time features.'
          }
        });
        setStatusMessage('Token generated. Real-time features are handled by the relay service.');
        return;

        // client.on('signalwire.ready', () => {
        //     setStatusMessage('Relay client ready and registered as your SIP Endpoint.');
        //     setIsRegistered(true);
        //     setPhoneClient(client);
        // });
        
        // client.on('signalwire.error', (err: any) => {
        //     setError(`Relay client error: ${err.message}`);
        //     setStatusMessage('Client error.');
        // });
        
        // await client.connect();

    } catch (err: any) {
        setError(`Connection failed: ${err.message}`);
        setStatusMessage('Connection failed.');
    }
  }

  const makeCall = async () => {
    if (!phoneClient || !isRegistered || !destinationNumber || !myPhoneNumber) {
      setError('Client not ready, or missing destination/caller ID.')
      return
    }
    try {
      setStatusMessage(`Calling ${destinationNumber}...`)
      setOnCall(true)
      setError(null)
      
      // CHANGE 1: Use the Relay method for a new call, including the 'from' number
      const call = await phoneClient.newCall({
        to: destinationNumber,
        from: myPhoneNumber 
      })

      // CHANGE 2: Listen for events on the new call object
      call.on('call.state', (c: any) => {
        setStatusMessage(`Call state: ${c.state}`);
        // When the call ends, clear the activeCall state
        if (c.state === 'ended') {
          setOnCall(false)
          setActiveCall(null);
        }
      });
      
      // CHANGE 3: Store the returned call object in state
      setActiveCall(call);

    } catch (err: any) {
      setError(`Call failed: ${err.message}`)
      setStatusMessage('Call failed.')
      setOnCall(false)
    }
  }

  const hangUp = async () => {
    // CHANGE: Check for the 'activeCall' object and call hangup() on it
    if (!activeCall) return
    await activeCall.hangup()
  }

  // --- API Testing Functions ---
  const testSimpleSignalWire = async () => {
    setLoading(true)
    setError(null)
    setApiResponse(null)

    try {
      console.log('Testing Simple SignalWire API Connection')

      const { data, error: functionError } = await supabase.functions.invoke('test-signalwire-simple')

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      console.log('Raw response from simple test function:', data)
      setApiResponse(data)

    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const testListPhoneNumbers = async () => {
    if (!tenantId) {
      setError('Please ensure you are logged in and have a Tenant ID.');
      return;
    }
    setLoading(true)
    setError(null)
    setApiResponse(null)

    try {
      console.log('Testing SignalWire Relay API - List Phone Numbers')
      console.log('Tenant ID:', tenantId)

      const { data, error: functionError } = await supabase.functions.invoke('list-signalwire-phone-numbers', {
        body: { tenant_id: tenantId }
      })

      if (functionError) {
        throw new Error(functionError.message);
      }
      
      console.log('Raw response from function:', data)
      setApiResponse(data)

      // Check if the response contains detailed error information
      if (data && !data.success && data.details) {
        console.log('Detailed error information:', data.details)
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const testDirectSignalWireAPI = async () => {
    setLoading(true)
    setError(null)
    setApiResponse(null)

    try {
      console.log('Testing Direct SignalWire Relay API Call')
      
      // This would normally require CORS to be enabled on SignalWire's side
      // But we'll try it to see what happens
      const response = await fetch('https://taurustech.signalwire.com/api/relay/rest/phone_numbers', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE', // This won't work but shows the format
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Direct API response:', data)
      setApiResponse(data)

    } catch (err: any) {
      console.error('Error with direct API call:', err)
      setError(`Direct API call failed (expected due to CORS): ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // --- Render Method ---
  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header"><h3 className="card-title">SignalWire Complete Test Suite</h3></div>
            <div className="card-body">
              {/* User Authentication Status */}
              <div className="mb-4">
                <h5 className="text-secondary">👤 Authentication & Setup Status</h5>
                <div className="alert alert-info">
                  <strong>Tenant ID:</strong> {tenantId || 'Loading...'}
                  <br />
                  <strong>Phone Numbers Available:</strong> {phoneNumbers.length}
                  <br />
                  <strong>Current Softphone Number:</strong> {myPhoneNumber || 'None selected'}
                  <br />
                  <strong>Note:</strong> You must be logged in and have phone numbers to test the softphone.
                </div>
                {phoneNumbers.length === 0 && (
                  <div className="alert alert-warning">
                    <strong>⚠️ No Phone Numbers Found!</strong>
                    <br />
                    Please visit <a href="/settings/phone-numbers" className="alert-link">/settings/phone-numbers</a> to search and purchase phone numbers before testing the softphone.
                  </div>
                )}
              </div>

              {/* Softphone Section */}
              <div className="mb-5">
                <h4 className="text-primary">🎯 Softphone Test</h4>
                <div className="alert alert-info mb-3">
                  <strong>Status:</strong> {statusMessage}
                </div>

                {!isRegistered ? (
                  <button className="btn btn-success" onClick={connectSoftphone}>
                    Connect Softphone
                  </button>
                ) : (
                  <div>
                    <div className="mb-3">
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter number to call (e.g., +1234567890)"
                          value={destinationNumber}
                          onChange={(e) => setDestinationNumber(e.target.value)}
                          disabled={onCall}
                        />
                        <button className="btn btn-primary" onClick={makeCall} disabled={onCall || !destinationNumber}>
                          📞 Call
                        </button>
                      </div>
                    </div>
                    {onCall && (
                      <button className="btn btn-danger" onClick={hangUp}>
                        📞 Hang Up
                      </button>
                    )}
                  </div>
                )}
              </div>

              <hr />

              {/* Universal Error Display */}
              {error && (
                <div className="alert alert-danger">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {/* API Diagnostics Section */}
              <div className="mb-4">
                 <h4 className="text-secondary">🔧 API Diagnostics</h4>
                 <div className="mb-3">
                  <label className="form-label">Tenant ID:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Enter tenant ID"
                  />
                </div>
                 <div className="d-flex gap-3 mb-3">
                   <button className="btn btn-success" onClick={testSimpleSignalWire} disabled={loading}>
                     {loading ? 'Testing...' : '🧪 Test SignalWire API (Simple)'}
                   </button>
                   
                   <button className="btn btn-primary" onClick={testListPhoneNumbers} disabled={loading || !tenantId}>
                     {loading ? 'Testing...' : 'Test via Supabase Function'}
                   </button>
                   
                   <button 
                    className="btn btn-secondary" 
                    onClick={testDirectSignalWireAPI}
                    disabled={loading}
                  >
                    {loading ? 'Testing...' : 'Test Direct API (will fail due to CORS)'}
                  </button>
                 </div>
              </div>
              
              {apiResponse && (
                <div className="alert alert-info">
                  <h6>Response from Supabase Function:</h6>
                  <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                  
                  {/* Show diagnostic information if error */}
                  {apiResponse.details && (
                    <div className="mt-3">
                      <h6>🔍 Diagnostic Information:</h6>
                      <div className="row">
                        <div className="col-md-6">
                          <strong>Environment Variables:</strong>
                          <ul className="list-unstyled mt-2">
                            <li>
                              <span className={`badge ${apiResponse.details.hasSpaceUrl ? 'bg-success' : 'bg-danger'}`}>
                                {apiResponse.details.hasSpaceUrl ? '✓' : '✗'}
                              </span>
                              {' '}SIGNALWIRE_SPACE_URL: {apiResponse.details.spaceUrlValue}
                            </li>
                            <li>
                              <span className={`badge ${apiResponse.details.hasApiToken ? 'bg-success' : 'bg-danger'}`}>
                                {apiResponse.details.hasApiToken ? '✓' : '✗'}
                              </span>
                              {' '}SIGNALWIRE_API_TOKEN: {apiResponse.details.apiTokenValue}
                            </li>
                          </ul>
                        </div>
                        <div className="col-md-6">
                          <strong>API Request Details:</strong>
                          <ul className="list-unstyled mt-2">
                            <li><strong>URL:</strong> {apiResponse.details.constructedUrl}</li>
                            <li><strong>Timestamp:</strong> {apiResponse.details.timestamp}</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <strong>🎯 Likely Issues:</strong>
                        <ul className="mt-2">
                          {!apiResponse.details.hasSpaceUrl && (
                            <li className="text-danger">❌ Missing SIGNALWIRE_SPACE_URL environment variable</li>
                          )}
                          {!apiResponse.details.hasApiToken && (
                            <li className="text-danger">❌ Missing SIGNALWIRE_API_TOKEN environment variable</li>
                          )}
                          {apiResponse.details.hasSpaceUrl && apiResponse.details.hasApiToken && (
                            <>
                              <li className="text-warning">⚠️ API Token may be invalid or expired</li>
                              <li className="text-warning">⚠️ API Token may not have 'Numbers' scope permission</li>
                              <li className="text-warning">⚠️ Space URL may be incorrect</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <h5>Expected SignalWire Relay API Response Format</h5>
                <div className="alert alert-light">
                  <pre>{`{
  "links": {
    "self": "string",
    "first": "string", 
    "next": "string",
    "prev": "string"
  },
  "data": [
    {
      "id": "uuid",
      "number": "+15558675309",
      "name": "Jenny",
      "call_handler": "relay_context",
      "call_receive_mode": "voice",
      "capabilities": ["voice", "sms", "mms", "fax"],
      "number_type": "toll-free",
      "created_at": "2023-01-01T00:00:00Z",
      "updated_at": "2023-01-01T00:00:00Z",
      "next_billed_at": "2023-02-01T00:00:00Z"
    }
  ]
}`}</pre>
                </div>
              </div>

              <div className="mt-4">
                <h5>Quick Links</h5>
                <div className="alert alert-light">
                  <div className="d-flex gap-3">
                    <a href="/settings/phone-numbers" className="btn btn-primary btn-sm">
                      📱 Manage Phone Numbers
                    </a>
                    <a href="/test-database" className="btn btn-secondary btn-sm">
                      🗄️ Database Test
                    </a>
                    <a href="/communications" className="btn btn-info btn-sm">
                      📞 Communications Dashboard
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h5>📋 Testing Instructions</h5>
                <div className="alert alert-light">
                  <ol>
                    <li><strong>Phone Numbers</strong>: Visit <a href="/settings/phone-numbers">/settings/phone-numbers</a> to search and purchase phone numbers</li>
                    <li><strong>API Connection</strong>: Use the "Test SignalWire API" button to verify backend connectivity</li>
                    <li><strong>Softphone Registration</strong>: Click "Connect Softphone" to register with SignalWire</li>
                    <li><strong>Make Test Call</strong>: Enter a destination number and click "Call" to test voice functionality</li>
                    <li><strong>Call Management</strong>: Use "Hang Up" to end calls</li>
                  </ol>
                  <p className="mb-0"><strong>Expected:</strong> The softphone should register successfully and be able to make calls using your purchased phone numbers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
