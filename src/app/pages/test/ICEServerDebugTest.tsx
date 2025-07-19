import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const ICEServerDebugTest: React.FC = () => {
  const [results, setResults] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const testTokenGeneration = async () => {
    setIsRunning(true)
    setResults([])

    // Test signalwire-token-v2 (the one testimonial uses)
    try {
      console.log('\n=== Testing signalwire-token-v2 ===')
      const { data, error } = await supabase.functions.invoke('signalwire-token-v2', {
        body: {
          roomName: `debug-test-${Date.now()}`,
          userName: 'Debug User'
        }
      })

      if (error) {
        console.error('Error:', error)
        setResults(prev => [...prev, {
          function: 'signalwire-token-v2',
          error: error.message,
          status: 'error'
        }])
      } else {
        console.log('Response:', data)
        
        // Decode the token to check for ICE servers
        if (data.token) {
          try {
            const parts = data.token.split('.')
            const payload = JSON.parse(atob(parts[1]))
            console.log('Token payload:', payload)
            
            const hasIce = !!(payload.ice_servers || payload.s?.ice_servers || payload.video?.ice_servers)
            
            setResults(prev => [...prev, {
              function: 'signalwire-token-v2',
              tokenLength: data.token.length,
              hasIceServers: hasIce,
              payload: payload,
              status: 'success'
            }])
          } catch (e) {
            console.error('Failed to decode token:', e)
          }
        }
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
    }

    setIsRunning(false)
  }

  const showConnectionDelay = () => {
    return (
      <div className="alert alert-danger mt-4">
        <h5>🚨 The Problem</h5>
        <p>Your Edge Functions are using <code>auto_create_room: true</code> which does NOT include ICE servers in the token.</p>
        <p>This causes a 42-second ICE gathering timeout as shown in your logs:</p>
        <pre className="bg-dark text-light p-2 rounded">
18:04:27.518Z - iceGatheringState new
18:05:09.321Z - Apply audio constraints
          ↑ 42 second gap!
        </pre>
        <p><strong>Solution:</strong> Deploy the updated Edge Functions that use the two-step process (create room, then token).</p>
      </div>
    )
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🔍 ICE Server Debug Test</h1>
          
          <div className="alert alert-info">
            <h5>What This Tests</h5>
            <p className="mb-0">This checks if your Edge Functions include ICE servers in the token. Without ICE servers, you get the 45-second delay.</p>
          </div>

          <button 
            className="btn btn-primary mb-4"
            onClick={testTokenGeneration}
            disabled={isRunning}
          >
            {isRunning ? 'Testing...' : 'Test Token Generation'}
          </button>

          {results.map((result, index) => (
            <div key={index} className="card mb-3">
              <div className="card-header">
                <h5>{result.function}</h5>
              </div>
              <div className="card-body">
                {result.error ? (
                  <div className="alert alert-danger">
                    Error: {result.error}
                  </div>
                ) : (
                  <>
                    <p>Token Length: {result.tokenLength}</p>
                    <p>Has ICE Servers: {result.hasIceServers ? 
                      <span className="badge bg-success">YES ✅</span> : 
                      <span className="badge bg-danger">NO ❌</span>
                    }</p>
                    
                    {!result.hasIceServers && (
                      <div className="alert alert-warning mt-3">
                        <strong>This is why you have the 45-second delay!</strong>
                        <p className="mb-0">The token doesn't include ICE servers, causing the browser to timeout during ICE gathering.</p>
                      </div>
                    )}

                    <details className="mt-3">
                      <summary>Token Payload (click to expand)</summary>
                      <pre className="bg-light p-2 rounded mt-2">
                        {JSON.stringify(result.payload, null, 2)}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            </div>
          ))}

          {results.length > 0 && !results[0].hasIceServers && showConnectionDelay()}

          <div className="alert alert-warning mt-4">
            <h5>📋 Deployment Checklist</h5>
            <ol className="mb-0">
              <li>Deploy the updated <code>create-signalwire-room-fast</code> with two-step process</li>
              <li>Deploy the updated <code>signalwire-token-v2</code> with two-step process</li>
              <li>Both now create room first, then token (ensures ICE servers)</li>
              <li>Both include <code>room.join</code> permission</li>
              <li>Test again - tokens should now include ICE servers</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ICEServerDebugTest