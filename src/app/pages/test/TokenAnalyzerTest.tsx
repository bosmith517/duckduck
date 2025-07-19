// TokenAnalyzerTest.tsx

import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { WorkingVideoComponent } from '../../components/video/WorkingVideoComponent'

export const TokenAnalyzerTest: React.FC = () => {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Remove the automatic SDK loading - we'll load it when needed

  // This function correctly calls your one working backend function
  const testCorrectFunction = async () => {
    console.log('Button clicked, starting test...')
    setIsLoading(true)
    setResult('Loading...')

    try {
      // This is the invoke call that needs to be correct.
      // It MUST include the 'body' object with 'room_name' and 'user_name'.
      console.log('Invoking create-video-token function...')
      const { data, error } = await supabase.functions.invoke('create-video-token', {
        body: {
          room_name: `final-test-${Date.now()}`,
          user_name: 'Final Tester'
        }
      })

      console.log('Function response:', { data, error })
      if (error) throw error

      if (!data || !data.token) {
        throw new Error('No token received from function')
      }

      console.log('Token received:', data.token)
      console.log('ICE servers received:', data.iceServers)
      
      // Check if ICE servers are present in the response
      if (data.iceServers && data.iceServers.length > 0) {
        setResult(`SUCCESS! ✅ Token received with ${data.iceServers.length} ICE servers from backend.`)
        console.log('ICE server details:', data.iceServers)
      } else {
        setResult('ERROR: Token received but no ICE servers provided by backend.')
      }

    } catch (err: any) {
      console.error('Test failed:', err)
      setResult(`FAILED: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container py-5">
      <div className="card mb-5">
        <div className="card-body">
          <h3 className="card-title">1. Test the Backend Function</h3>
          <p>Click this button to test the `create-video-token` function directly.</p>
          <button
            className="btn btn-primary"
            onClick={testCorrectFunction}
            disabled={isLoading}
          >
            {isLoading ? 'Testing...' : 'Test the Correct Function'}
          </button>
          {result && (
            <div className="alert alert-info mt-3 mb-0">
              <strong>Result:</strong> {result}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h3 className="card-title">2. Test the Full Component</h3>
          <p>
            This component uses the exact same logic. Click "Join Room" to see the fast connection.
          </p>
          <WorkingVideoComponent />
        </div>
      </div>
    </div>
  )
}

export default TokenAnalyzerTest