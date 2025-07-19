import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const DirectTokenTest: React.FC = () => {
  const [results, setResults] = useState<any[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const testFunction = async (functionName: string) => {
    console.log(`\n=== Testing ${functionName} ===`)
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          roomName: `test-room-${Date.now()}`,
          userName: 'Test User'
        }
      })

      if (error) {
        console.error('Error:', error)
        
        // Try to read the error body
        if (error.context?.body) {
          try {
            const bodyText = await error.context.body.text()
            console.error('Error response:', bodyText)
            
            setResults(prev => [...prev, {
              function: functionName,
              error: bodyText || error.message,
              status: 'error'
            }])
            return
          } catch (e) {
            console.error('Could not read error body')
          }
        }
        
        setResults(prev => [...prev, {
          function: functionName,
          error: error.message,
          status: 'error'
        }])
      } else {
        console.log('Success:', data)
        
        // Check for ICE servers if token exists
        let hasIce = false
        if (data?.token) {
          try {
            const parts = data.token.split('.')
            const payload = JSON.parse(atob(parts[1]))
            hasIce = !!(payload.ice_servers || payload.s?.ice_servers || payload.video?.ice_servers)
          } catch (e) {
            console.error('Failed to decode token')
          }
        }
        
        setResults(prev => [...prev, {
          function: functionName,
          data: data,
          hasIceServers: hasIce,
          status: 'success'
        }])
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setResults(prev => [...prev, {
        function: functionName,
        error: err.message,
        status: 'error'
      }])
    }
  }

  const runTests = async () => {
    setIsRunning(true)
    setResults([])

    // First check environment
    await testFunction('debug-signalwire-env')      // Check if env vars are set
    
    // Then test all the token functions
    await testFunction('signalwire-token-working')  // The one testimonial is using
    await testFunction('signalwire-token-v2')       // The fixed one
    await testFunction('signalwire-token-fixed')    // Alternative fixed one

    setIsRunning(false)
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🔍 Direct Token Function Test</h1>
          
          <div className="alert alert-info mb-4">
            <p className="mb-0">Testing which Edge Functions are deployed and if they include ICE servers.</p>
          </div>

          <button 
            className="btn btn-primary mb-4"
            onClick={runTests}
            disabled={isRunning}
          >
            {isRunning ? 'Testing...' : 'Test All Token Functions'}
          </button>

          {results.map((result, index) => (
            <div key={index} className={`card mb-3 border-${result.status === 'error' ? 'danger' : 'success'}`}>
              <div className="card-header">
                <h5 className="mb-0">
                  {result.function} 
                  {result.status === 'error' ? ' ❌' : ' ✅'}
                </h5>
              </div>
              <div className="card-body">
                {result.error ? (
                  <div className="alert alert-danger mb-0">
                    <strong>Error:</strong><br />
                    <pre className="mb-0">{result.error}</pre>
                  </div>
                ) : (
                  <>
                    <p className="mb-2">
                      <strong>Has ICE Servers:</strong> {result.hasIceServers ? 
                        <span className="badge bg-success">YES ✅</span> : 
                        <span className="badge bg-danger">NO ❌ (45-second delay!)</span>
                      }
                    </p>
                    <details>
                      <summary>Response Data</summary>
                      <pre className="bg-light p-2 rounded mt-2">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </>
                )}
              </div>
            </div>
          ))}

          {results.length > 0 && (
            <div className="alert alert-warning mt-4">
              <h5>📋 Summary</h5>
              <p>The testimonial component is using <code>signalwire-token-working</code> which:</p>
              <ul>
                <li>Uses <code>auto_create_room: true</code> (no ICE servers)</li>
                <li>Missing <code>room.join</code> permission</li>
                <li>Causes the 45-second delay</li>
              </ul>
              <p className="mb-0">Deploy the fixed versions with: <code>supabase functions deploy signalwire-token-v2</code></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DirectTokenTest