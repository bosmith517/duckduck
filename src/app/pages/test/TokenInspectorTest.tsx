import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const TokenInspectorTest: React.FC = () => {
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inspectToken = async () => {
    setIsLoading(true)
    setError(null)
    setTokenInfo(null)

    try {
      const { data, error } = await supabase.functions.invoke('signalwire-token-working', {
        body: {
          roomName: `test-${Date.now()}`,
          userName: 'Inspector'
        }
      })

      if (error) throw error

      // Decode the JWT token
      const parts = data.token.split('.')
      const header = JSON.parse(atob(parts[0]))
      const payload = JSON.parse(atob(parts[1]))

      // Check for ICE servers in various locations
      const iceServers = 
        payload.ice_servers || 
        payload.s?.ice_servers || 
        payload.video?.ice_servers ||
        payload.r?.ice_servers ||
        null

      setTokenInfo({
        header,
        payload,
        iceServers,
        hasIceServers: !!iceServers,
        tokenLength: data.token.length,
        roomName: data.roomName
      })

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🔍 Token Inspector</h1>
          
          <button 
            className="btn btn-primary mb-4"
            onClick={inspectToken}
            disabled={isLoading}
          >
            {isLoading ? 'Inspecting...' : 'Inspect Token'}
          </button>

          {error && (
            <div className="alert alert-danger">
              <strong>Error:</strong> {error}
            </div>
          )}

          {tokenInfo && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  Token Analysis {tokenInfo.hasIceServers ? 
                    <span className="badge bg-success ms-2">ICE Servers Present ✅</span> : 
                    <span className="badge bg-danger ms-2">NO ICE Servers ❌ (45-second delay!)</span>
                  }
                </h5>
              </div>
              <div className="card-body">
                <p><strong>Room Name:</strong> {tokenInfo.roomName}</p>
                <p><strong>Token Length:</strong> {tokenInfo.tokenLength} characters</p>
                
                {!tokenInfo.hasIceServers && (
                  <div className="alert alert-warning">
                    <h6>⚠️ This token will cause the 45-second delay!</h6>
                    <p>The token doesn't include ICE servers, causing a 42-second ICE gathering timeout.</p>
                    <p className="mb-0">Deploy the updated Edge Function to fix this.</p>
                  </div>
                )}

                <details className="mt-3">
                  <summary>Token Header</summary>
                  <pre className="bg-light p-2 rounded mt-2">
                    {JSON.stringify(tokenInfo.header, null, 2)}
                  </pre>
                </details>

                <details className="mt-3">
                  <summary>Token Payload (Full)</summary>
                  <pre className="bg-light p-2 rounded mt-2">
                    {JSON.stringify(tokenInfo.payload, null, 2)}
                  </pre>
                </details>

                {tokenInfo.iceServers && (
                  <details className="mt-3">
                    <summary>ICE Servers Configuration</summary>
                    <pre className="bg-light p-2 rounded mt-2">
                      {JSON.stringify(tokenInfo.iceServers, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          <div className="alert alert-info mt-4">
            <h5>📝 Deploy Instructions</h5>
            <p>To fix the 45-second delay, deploy the updated function:</p>
            <code>supabase functions deploy signalwire-token-working</code>
            <hr />
            <p className="mb-0">The updated function uses two-step room creation to ensure ICE servers are included.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TokenInspectorTest