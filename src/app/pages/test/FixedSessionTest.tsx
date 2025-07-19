import React, { useState, useRef, useCallback } from 'react'
import { supabase } from '../../../supabaseClient'
import SignalWireVideoRoomSimple from '../../components/video/SignalWireVideoRoomSimple'

interface TestResult {
  functionName: string
  tokenLength: number
  hasIceServers: boolean
  iceServerCount?: number
  connectionTime?: number
  error?: string
  separateIceServers?: boolean
}

export const FixedSessionTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [currentTest, setCurrentTest] = useState<string>('')
  const [results, setResults] = useState<TestResult[]>([])
  const [activeToken, setActiveToken] = useState<string>('')
  const [activeRoom, setActiveRoom] = useState<string>('')
  const startTimeRef = useRef<number>(0)

  const testFunction = async (functionName: string, payload: any): Promise<TestResult> => {
    console.log(`\n🧪 Testing ${functionName}...`)
    const result: TestResult = {
      functionName,
      tokenLength: 0,
      hasIceServers: false
    }

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      })

      if (error) throw error
      if (!data.token) throw new Error('No token received')

      result.tokenLength = data.token.length

      // Check if ICE servers are returned separately (like create-room-with-ice)
      if (data.iceServers && Array.isArray(data.iceServers)) {
        result.separateIceServers = true
        result.hasIceServers = data.iceServers.length > 0
        result.iceServerCount = data.iceServers.length
        console.log(`${functionName} returned ${data.iceServers.length} ICE servers separately`)
      }

      // Check if token contains ICE servers
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]))
        const iceServers = payload.ice_servers || payload.s?.ice_servers || 
                          payload.video?.ice_servers || []
        
        if (!result.separateIceServers) {
          result.hasIceServers = Array.isArray(iceServers) && iceServers.length > 0
          result.iceServerCount = result.hasIceServers ? iceServers.length : 0
        }
        
        console.log(`Token analysis for ${functionName}:`)
        console.log(`- Token length: ${result.tokenLength}`)
        console.log(`- Has ICE servers: ${result.hasIceServers}`)
        console.log(`- ICE server count: ${result.iceServerCount || 0}`)
        console.log(`- ICE servers location: ${result.separateIceServers ? 'Returned separately' : 'In token'}`)
        
        if (result.hasIceServers && result.iceServerCount && result.iceServerCount > 0) {
          const servers = result.separateIceServers ? data.iceServers : iceServers
          console.log(`- First ICE server: ${servers[0].urls || servers[0].url || 'unknown'}`)
        }
      } catch (e) {
        console.log('Could not decode token payload:', e)
      }

      return result
    } catch (err: any) {
      result.error = err.message
      console.error(`Error testing ${functionName}:`, err)
      return result
    }
  }

  const runAllTests = async () => {
    setIsRunning(true)
    setResults([])
    
    const testCases = [
      {
        name: 'create-signalwire-room-fast',
        payload: {
          room_name: `test-fast-${Date.now()}`,
          customer_name: 'ICE Test User'
        }
      },
      {
        name: 'signalwire-token-v2',
        payload: {
          roomName: `test-v2-${Date.now()}`,
          userName: 'ICE Test User'
        }
      },
      {
        name: 'generate-signalwire-token',
        payload: {
          clientIdentity: 'ICE Test User',
          room_name: `test-gen-${Date.now()}`
        }
      },
      {
        name: 'create-signalwire-session',
        payload: {
          room_name: `test-session-${Date.now()}`,
          customer_name: 'ICE Test User'
        }
      },
      {
        name: 'create-room-with-ice',
        payload: {
          room_name: `test-ice-${Date.now()}`,
          user_name: 'ICE Test User'
        }
      }
    ]

    const testResults: TestResult[] = []
    
    for (const testCase of testCases) {
      setCurrentTest(testCase.name)
      const result = await testFunction(testCase.name, testCase.payload)
      testResults.push(result)
      setResults([...testResults])
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Find the best result (has ICE servers and no error)
    const goodResult = testResults.find(r => r.hasIceServers && !r.error)
    if (goodResult) {
      console.log(`\n✅ Best result: ${goodResult.functionName} - Testing connection...`)
      await testConnectionSpeed(goodResult.functionName)
    } else {
      console.log('\n❌ No function returned a token with ICE servers!')
    }

    setIsRunning(false)
    setCurrentTest('')
  }

  const testConnectionSpeed = async (functionName: string) => {
    console.log(`\n⚡ Testing connection speed with ${functionName}...`)
    
    // Generate a fresh token
    const roomName = `speed-test-${Date.now()}`
    const payload = functionName === 'signalwire-token-v2' 
      ? { roomName, userName: 'Speed Test' }
      : { room_name: roomName, customer_name: 'Speed Test' }
    
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: payload
    })

    if (error || !data.token) {
      console.error('Failed to generate token for speed test')
      return
    }

    setActiveToken(data.token)
    setActiveRoom(roomName)
    startTimeRef.current = Date.now()
  }

  const handleRoomJoined = (roomSession: any) => {
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current
      console.log(`\n🎉 Room joined in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`)
      
      // Update the last result with connection time
      setResults(prev => {
        const newResults = [...prev]
        if (newResults.length > 0) {
          newResults[newResults.length - 1].connectionTime = elapsed
        }
        return newResults
      })
      
      if (elapsed < 5000) {
        console.log('⚡ EXCELLENT! Sub-5 second connection!')
      } else if (elapsed < 10000) {
        console.log('✅ Good connection time (5-10 seconds)')
      } else if (elapsed < 20000) {
        console.log('⚠️ Moderate connection time (10-20 seconds)')
      } else {
        console.log('❌ Slow connection (20+ seconds) - ICE servers may still be missing')
      }
    }
  }

  const clearResults = () => {
    setResults([])
    setActiveToken('')
    setActiveRoom('')
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🔧 Fixed SignalWire Session Test</h1>
          <p className="lead mb-4">
            Testing Edge Functions for proper ICE server configuration
          </p>

          {/* Info Alert */}
          <div className="alert alert-info mb-4">
            <h5>🎯 What This Tests</h5>
            <ul className="mb-0">
              <li>Each Edge Function's token generation</li>
              <li>Whether tokens contain ICE servers (required for fast connections)</li>
              <li>Connection speed with a properly configured token</li>
              <li>The new create-signalwire-session uses two-step process for reliability</li>
            </ul>
          </div>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={runAllTests}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Testing {currentTest}...
                </>
              ) : (
                '🚀 Run All Tests'
              )}
            </button>
            
            <button
              className="btn btn-secondary"
              onClick={clearResults}
              disabled={isRunning}
            >
              Clear Results
            </button>
          </div>

          {/* Results Table */}
          {results.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h3 className="card-title">Test Results</h3>
              </div>
              <div className="card-body">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Edge Function</th>
                      <th>Token Length</th>
                      <th>Has ICE Servers</th>
                      <th>Connection Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index}>
                        <td>
                          <strong>{result.functionName}</strong>
                          {result.functionName === 'create-signalwire-session' && (
                            <div className="text-muted small">NEW: Two-step process</div>
                          )}
                          {result.functionName === 'create-room-with-ice' && (
                            <div className="text-muted small">Returns ICE servers separately</div>
                          )}
                        </td>
                        <td>{result.error ? '-' : result.tokenLength}</td>
                        <td>
                          {result.error ? '-' : (
                            result.hasIceServers ? (
                              <div>
                                <span className="badge bg-success">YES ✅</span>
                                <div className="text-muted small">
                                  {result.iceServerCount} servers
                                  {result.separateIceServers && ' (separate)'}
                                </div>
                              </div>
                            ) : (
                              <span className="badge bg-danger">NO ❌</span>
                            )
                          )}
                        </td>
                        <td>
                          {result.connectionTime ? (
                            <span className={
                              result.connectionTime < 5000 ? 'text-success' :
                              result.connectionTime < 20000 ? 'text-warning' : 'text-danger'
                            }>
                              {(result.connectionTime / 1000).toFixed(1)}s
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {result.error ? (
                            <span className="text-danger" title={result.error}>❌ Error</span>
                          ) : result.hasIceServers ? (
                            <span className="text-success">✅ Good</span>
                          ) : (
                            <span className="text-danger">❌ Missing ICE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Video Room Test */}
          {activeToken && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Connection Speed Test</h3>
              </div>
              <div className="card-body">
                <SignalWireVideoRoomSimple
                  token={activeToken}
                  roomName={activeRoom}
                  userName="Speed Test"
                  onRoomJoined={handleRoomJoined}
                  enableAudio={true}
                  enableVideo={true}
                  layout="grid-responsive"
                />
              </div>
            </div>
          )}

          {/* Analysis */}
          <div className="alert alert-warning mt-4">
            <h5>📊 Expected Results</h5>
            <ul className="mb-0">
              <li><strong>With auto_create_room:</strong> May not include ICE servers (causing 45s delay)</li>
              <li><strong>Two-step process:</strong> Should always include ICE servers (fast connection)</li>
              <li><strong>room.join permission:</strong> Required for users to actually join the room</li>
              <li><strong>Goal:</strong> All functions should show "YES" for ICE servers</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FixedSessionTest