import React, { useState } from 'react'
import { PageTitle } from '../../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../../_metronic/helpers'
import { supabase } from '../../../../supabaseClient'

const AIJoinDebugTest: React.FC = () => {
  const [roomName, setRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const testMethod = async (method: string) => {
    if (!roomName) {
      alert('Please enter a room name')
      return
    }

    setLoading(true)
    const startTime = Date.now()

    try {
      console.log(`Testing ${method} method for room: ${roomName}`)
      
      const { data, error } = await supabase.functions.invoke('test-ai-join-room', {
        body: {
          room_name: roomName,
          method: method
        }
      })

      const duration = Date.now() - startTime

      if (error) {
        setResults(prev => [{
          method,
          success: false,
          error: error.message,
          duration,
          timestamp: new Date().toISOString()
        }, ...prev])
      } else {
        setResults(prev => [{
          method,
          success: data?.success || false,
          data,
          duration,
          timestamp: new Date().toISOString()
        }, ...prev])
      }

      console.log(`${method} result:`, data || error)
    } catch (err: any) {
      console.error(`${method} error:`, err)
      setResults(prev => [{
        method,
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const testAllMethods = async () => {
    setResults([])
    await testMethod('relay')
    await new Promise(r => setTimeout(r, 1000))
    await testMethod('laml')
    await new Promise(r => setTimeout(r, 1000))
    await testMethod('token')
  }

  const testOriginalButton = async () => {
    if (!roomName) {
      alert('Please enter a room name')
      return
    }

    setLoading(true)
    const startTime = Date.now()

    try {
      console.log('Testing original add-ai-agent-simple...')
      
      const { data, error } = await supabase.functions.invoke('add-ai-agent-simple', {
        body: {
          room_name: roomName,
          agent_name: "Alex",
          agent_role: "AI Estimator"
        }
      })

      const duration = Date.now() - startTime

      setResults(prev => [{
        method: 'add-ai-agent-simple',
        success: data?.success || false,
        data,
        error: error?.message,
        duration,
        timestamp: new Date().toISOString()
      }, ...prev])

      console.log('Original button result:', data || error)
    } catch (err: any) {
      console.error('Original button error:', err)
      setResults(prev => [{
        method: 'add-ai-agent-simple',
        success: false,
        error: err.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageTitle breadcrumbs={[]}>AI Join Room Debug Test</PageTitle>
      
      <KTCard>
        <KTCardBody>
          <h3 className='mb-5'>Test AI Agent Joining Video Room</h3>
          
          <div className='mb-5'>
            <label className='form-label'>Room Name (from SignalWire)</label>
            <input
              type='text'
              className='form-control'
              placeholder='e.g., Video_Estimate_ROOFING_1234567890_abc123'
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <div className='form-text'>
              Enter the actual SignalWire room name (check console logs or database)
            </div>
          </div>

          <div className='d-flex gap-2 mb-5'>
            <button
              className='btn btn-primary'
              onClick={() => testMethod('relay')}
              disabled={loading || !roomName}
            >
              Test Relay Method
            </button>
            
            <button
              className='btn btn-primary'
              onClick={() => testMethod('laml')}
              disabled={loading || !roomName}
            >
              Test LAML Method
            </button>
            
            <button
              className='btn btn-primary'
              onClick={() => testMethod('token')}
              disabled={loading || !roomName}
            >
              Test Token Method
            </button>
            
            <button
              className='btn btn-warning'
              onClick={testOriginalButton}
              disabled={loading || !roomName}
            >
              Test Original AI Button
            </button>
            
            <button
              className='btn btn-success'
              onClick={testAllMethods}
              disabled={loading || !roomName}
            >
              Test All Methods
            </button>
          </div>

          {loading && (
            <div className='alert alert-info'>
              <div className='d-flex align-items-center'>
                <div className='spinner-border spinner-border-sm me-3' />
                Testing AI join method...
              </div>
            </div>
          )}

          <div className='mt-5'>
            <h4>Results:</h4>
            {results.length === 0 ? (
              <p className='text-muted'>No tests run yet</p>
            ) : (
              <div className='table-responsive'>
                <table className='table table-bordered'>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Success</th>
                      <th>Duration</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr key={idx} className={result.success ? 'table-success' : 'table-danger'}>
                        <td>{result.method}</td>
                        <td>
                          {result.success ? (
                            <span className='badge badge-success'>Success</span>
                          ) : (
                            <span className='badge badge-danger'>Failed</span>
                          )}
                        </td>
                        <td>{result.duration}ms</td>
                        <td>
                          <details>
                            <summary>View Details</summary>
                            <pre className='mt-2' style={{ fontSize: '12px' }}>
                              {JSON.stringify(result.data || { error: result.error }, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className='mt-5'>
            <h4>How to use this test:</h4>
            <ol>
              <li>Create a video room first (from Video Estimating page)</li>
              <li>Check browser console or database for the actual SignalWire room name</li>
              <li>It should look like: <code>Video_Estimate_ROOFING_1234567890_abc123</code></li>
              <li>Enter that room name above and test different methods</li>
              <li>Check which method successfully adds AI to the room</li>
            </ol>
          </div>
        </KTCardBody>
      </KTCard>
    </>
  )
}

export default AIJoinDebugTest