import React, { useState } from 'react'
import { supabase } from '../../../supabaseClient'

export const AIIntegrationTest: React.FC = () => {
  const [results, setResults] = useState<any[]>([])
  const [testing, setTesting] = useState(false)
  const [roomName, setRoomName] = useState('test-room-' + Date.now())

  const addResult = (test: string, success: boolean, details: any) => {
    const result = {
      test,
      success,
      details,
      timestamp: new Date().toISOString()
    }
    console.log(`[AI Test] ${test}:`, success ? '✅ PASS' : '❌ FAIL', details)
    setResults(prev => [...prev, result])
  }

  const runTests = async () => {
    console.log('🚀 [AI Test] Starting AI Integration Diagnostic Tests')
    console.log('[AI Test] Room name:', roomName)
    setTesting(true)
    setResults([])

    try {
      // Test 1: Check AI configuration and environment
      console.log('\n🔧 [AI Test] Test 1: Checking AI configuration and environment...')
      addResult('Check AI Config', true, 'Starting AI configuration check...')
      
      const { data: aiConfigData, error: aiConfigError } = await supabase.functions.invoke('check-ai-config')
      console.log('[AI Test] AI Config response:', { data: aiConfigData, error: aiConfigError })
      
      if (aiConfigError) {
        addResult('AI Config', false, aiConfigError)
      } else {
        addResult('AI Config', true, aiConfigData)
        
        // Log detailed AI config information
        console.log('\n📊 [AI Test] AI Configuration Details:')
        console.log('Environment Variables:', aiConfigData.config)
        console.log('API Test Result:', aiConfigData.apiTest)
        console.log('Script Check:', aiConfigData.scriptCheck)
        console.log('Recommendations:', aiConfigData.recommendations)
        
        // Log specific missing items
        if (aiConfigData.config.ai.estimatorId === 'Not set') {
          console.error('❌ SIGNALWIRE_AI_ESTIMATOR_ID is not set!')
        } else {
          console.log(`✅ AI Script ID: ${aiConfigData.config.ai.estimatorId}`)
        }
        
        if (!aiConfigData.scriptCheck.exists && aiConfigData.config.ai.estimatorId !== 'Not set') {
          console.error(`❌ AI Script "${aiConfigData.config.ai.estimatorId}" does not exist!`)
        }
      }

      // Test 1b: Check SignalWire configuration
      console.log('\n📋 [AI Test] Test 1b: Checking SignalWire configuration...')
      addResult('Check SignalWire Config', true, 'Starting configuration check...')
      
      const { data: configData, error: configError } = await supabase.functions.invoke('test-signalwire-config')
      console.log('[AI Test] Config response:', { data: configData, error: configError })
      
      if (configError) {
        addResult('SignalWire Config', false, configError)
      } else {
        addResult('SignalWire Config', true, configData)
      }

      // Test 2: Create a test room
      console.log('\n🏠 [AI Test] Test 2: Creating test room...')
      addResult('Create Test Room', true, 'Creating room: ' + roomName)
      
      const roomPayload = {
        room_name: roomName,
        customer_name: 'Test User',
        session_id: null
      }
      console.log('[AI Test] Room creation payload:', roomPayload)
      
      const { data: roomData, error: roomError } = await supabase.functions.invoke('create-signalwire-room', {
        body: roomPayload
      })
      console.log('[AI Test] Room creation response:', { data: roomData, error: roomError })

      if (roomError) {
        addResult('Room Creation', false, roomError)
        return
      }

      addResult('Room Creation', true, {
        room_id: roomData.room_id,
        room_name: roomData.room_name,
        token_length: roomData.token?.length
      })

      // Test 3: Try add-ai-to-video-room (script execution)
      console.log('\n📜 [AI Test] Test 3: Testing AI script execution...')
      addResult('AI Script Execution', true, 'Attempting to execute AI script...')
      
      const scriptPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] Script execution payload:', scriptPayload)
      
      const { data: scriptData, error: scriptError } = await supabase.functions.invoke('add-ai-to-video-room', {
        body: scriptPayload
      })
      console.log('[AI Test] Script execution response:', { data: scriptData, error: scriptError })

      if (scriptError) {
        addResult('AI Script Execution', false, scriptError)
      } else {
        addResult('AI Script Execution', scriptData?.success || false, scriptData)
      }

      // Test 4: Try add-ai-agent-to-room (phone call method)
      console.log('\n📞 [AI Test] Test 4: Testing AI agent phone call method...')
      addResult('AI Agent Add (Phone)', true, 'Attempting to add AI agent via phone call...')
      
      const phonePayload = {
        room_id: roomName,
        session_id: 'test-session-' + Date.now()
      }
      console.log('[AI Test] Phone method payload:', phonePayload)
      
      const { data: agentData, error: agentError } = await supabase.functions.invoke('add-ai-agent-to-room', {
        body: phonePayload
      })
      console.log('[AI Test] Phone method response:', { data: agentData, error: agentError })

      if (agentError) {
        console.error('[AI Test] Phone method error details:', agentError)
        addResult('AI Agent Add (Phone)', false, agentError)
      } else {
        addResult('AI Agent Add (Phone)', agentData?.success || false, agentData)
      }

      // Test 5: Try add-ai-agent-to-video (direct video room method)
      console.log('\n🎥 [AI Test] Test 5: Testing direct video room AI agent method...')
      addResult('AI Agent Add (Video)', true, 'Attempting to add AI agent directly to video room...')
      
      const videoPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] Video method payload:', videoPayload)
      
      const { data: videoAgentData, error: videoAgentError } = await supabase.functions.invoke('add-ai-agent-to-video', {
        body: videoPayload
      })
      console.log('[AI Test] Video method response:', { data: videoAgentData, error: videoAgentError })

      if (videoAgentError) {
        console.error('[AI Test] Video method error details:', videoAgentError)
        addResult('AI Agent Add (Video)', false, videoAgentError)
      } else {
        addResult('AI Agent Add (Video)', videoAgentData?.success || false, videoAgentData)
      }

      // Test 6: Try SWML execution
      console.log('\n📄 [AI Test] Test 6: Testing SWML execution...')
      addResult('AI SWML Execution', true, 'Attempting to execute AI SWML...')
      
      const swmlPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] SWML execution payload:', swmlPayload)
      
      const { data: swmlData, error: swmlError } = await supabase.functions.invoke('execute-ai-swml', {
        body: swmlPayload
      })
      console.log('[AI Test] SWML execution response:', { data: swmlData, error: swmlError })
      
      if (swmlError) {
        console.error('[AI Test] SWML error details:', swmlError)
        // Try to get the actual error message from the response
        if (swmlError.context?.body) {
          try {
            const errorBody = JSON.parse(swmlError.context.body)
            console.error('[AI Test] SWML error body:', errorBody)
            addResult('AI SWML Execution', false, { error: swmlError.message, details: errorBody })
          } catch {
            addResult('AI SWML Execution', false, swmlError)
          }
        } else {
          addResult('AI SWML Execution', false, swmlError)
        }
      } else {
        addResult('AI SWML Execution', swmlData?.success || false, swmlData)
      }

      // Test 6b: Try relay bin method directly
      console.log('\n🔄 [AI Test] Test 6b: Testing relay bin method...')
      addResult('AI Relay Bin', true, 'Attempting to add AI via relay bin...')
      
      const relayPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] Relay bin payload:', relayPayload)
      
      const { data: relayData, error: relayError } = await supabase.functions.invoke('add-ai-via-relay-bin', {
        body: relayPayload
      })
      console.log('[AI Test] Relay bin response:', { data: relayData, error: relayError })
      
      if (relayError) {
        console.error('[AI Test] Relay error details:', relayError)
        if (relayError.context?.body) {
          try {
            const errorBody = JSON.parse(relayError.context.body)
            console.error('[AI Test] Relay error body:', errorBody)
            addResult('AI Relay Bin', false, { error: relayError.message, details: errorBody })
          } catch {
            addResult('AI Relay Bin', false, relayError)
          }
        } else {
          addResult('AI Relay Bin', false, relayError)
        }
      } else {
        addResult('AI Relay Bin', relayData?.success || false, relayData)
      }

      // Test 6c: Try video-specific SWML
      console.log('\n🎬 [AI Test] Test 6c: Testing video-specific SWML...')
      addResult('AI Video SWML', true, 'Attempting to join AI to video room with SWML...')
      
      const videoSwmlPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] Video SWML payload:', videoSwmlPayload)
      
      const { data: videoSwmlData, error: videoSwmlError } = await supabase.functions.invoke('ai-join-video-swml', {
        body: videoSwmlPayload
      })
      console.log('[AI Test] Video SWML response:', { data: videoSwmlData, error: videoSwmlError })
      
      if (videoSwmlError) {
        console.error('[AI Test] Video SWML error details:', videoSwmlError)
        if (videoSwmlError.context?.body) {
          try {
            const errorBody = JSON.parse(videoSwmlError.context.body)
            console.error('[AI Test] Video SWML error body:', errorBody)
            addResult('AI Video SWML', false, { error: videoSwmlError.message, details: errorBody })
          } catch {
            addResult('AI Video SWML', false, videoSwmlError)
          }
        } else {
          addResult('AI Video SWML', false, videoSwmlError)
        }
      } else {
        addResult('AI Video SWML', videoSwmlData?.success || false, videoSwmlData)
      }

      // Test 6d: Create proper AI Agent
      console.log('\n🤖 [AI Test] Test 6d: Creating proper AI Agent...')
      addResult('Create AI Agent', true, 'Creating AI agent using Agents SDK...')
      
      const createAgentPayload = {
        room_name: roomName,
        session_id: 'test-session-' + Date.now(),
        trade_type: 'ROOFING'
      }
      console.log('[AI Test] Agent creation payload:', createAgentPayload)
      
      const { data: createAgentData, error: createAgentError } = await supabase.functions.invoke('create-ai-agent', {
        body: createAgentPayload
      })
      console.log('[AI Test] Agent creation response:', { data: createAgentData, error: createAgentError })
      
      if (createAgentError) {
        console.error('[AI Test] Agent error details:', createAgentError)
        if (createAgentError.context?.body) {
          try {
            const errorBody = JSON.parse(createAgentError.context.body)
            console.error('[AI Test] Agent error body:', errorBody)
            addResult('Create AI Agent', false, { error: createAgentError.message, details: errorBody })
          } catch {
            addResult('Create AI Agent', false, createAgentError)
          }
        } else {
          addResult('Create AI Agent', false, createAgentError)
        }
      } else {
        addResult('Create AI Agent', createAgentData?.success || false, createAgentData)
        if (createAgentData?.agent_id) {
          console.log(`✅ [AI Test] Agent created with ID: ${createAgentData.agent_id}`)
        }
      }

      // Test 7: Debug video session
      console.log('\n🔍 [AI Test] Test 7: Running debug diagnostics...')
      addResult('Debug Session', true, 'Running debug diagnostics...')
      
      const debugPayload = {
        session_id: 'test-session-' + Date.now()
      }
      console.log('[AI Test] Debug payload:', debugPayload)
      
      const { data: debugData, error: debugError } = await supabase.functions.invoke('debug-video-session', {
        body: debugPayload
      })
      console.log('[AI Test] Debug response:', { data: debugData, error: debugError })

      if (debugError) {
        addResult('Debug Session', false, debugError)
      } else {
        addResult('Debug Session', true, debugData)
      }

      // Test 8: Simple test function
      console.log('\n🧪 [AI Test] Test 8: Testing simple function...')
      addResult('Simple Test', true, 'Testing basic Edge Function...')
      
      const { data: simpleData, error: simpleError } = await supabase.functions.invoke('test-simple-ai', {
        body: { test: true }
      })
      console.log('[AI Test] Simple test response:', { data: simpleData, error: simpleError })
      
      if (simpleError) {
        console.error('[AI Test] Simple test error:', simpleError)
        addResult('Simple Test', false, simpleError)
      } else {
        addResult('Simple Test', simpleData?.success || false, simpleData)
        if (simpleData?.environment) {
          console.log('\n🔐 [AI Test] Environment Variables from Edge Function:')
          Object.entries(simpleData.environment).forEach(([key, value]) => {
            console.log(`${key}: ${value}`)
          })
        }
      }

      // Test 9: Check environment variables
      console.log('\n🔐 [AI Test] Test 9: Checking environment variables...')
      addResult('Environment Check', true, 'Checking AI-related environment variables...')
      
      // This would need a dedicated edge function to safely check env vars
      const envVarsToCheck = [
        'SIGNALWIRE_AI_ESTIMATOR_ID',
        'SIGNALWIRE_AI_PHONE_NUMBER',
        'SIGNALWIRE_AI_RELAY_BIN_URL',
        'SIGNALWIRE_AI_SWAIG_URL'
      ]
      
      console.log('[AI Test] Required environment variables:', envVarsToCheck)
      addResult('Environment Variables', true, {
        note: 'Check Supabase dashboard for these variables:',
        required: envVarsToCheck
      })

      console.log('\n✅ [AI Test] All tests completed!')

    } catch (error: any) {
      console.error('❌ [AI Test] Test suite error:', error)
      addResult('Test Error', false, error.message)
    } finally {
      console.log('🏁 [AI Test] Test suite finished')
      setTesting(false)
    }
  }

  return (
    <div className="container-fluid py-5">
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">AI Integration Diagnostic Test</h3>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <p>This test will check all AI integration methods and help diagnose connection issues.</p>
            <div className="d-flex gap-3 align-items-center">
              <button 
                className="btn btn-primary" 
                onClick={runTests}
                disabled={testing}
              >
                {testing ? 'Running Tests...' : 'Run Diagnostic Tests'}
              </button>
              <input
                type="text"
                className="form-control w-auto"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name"
              />
            </div>
          </div>

          {results.length > 0 && (
            <div className="mt-4">
              <h4>Test Results:</h4>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Status</th>
                      <th>Details</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index}>
                        <td>{result.test}</td>
                        <td>
                          <span className={`badge ${result.success ? 'badge-success' : 'badge-danger'}`}>
                            {result.success ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                        <td>
                          <pre className="mb-0" style={{ maxHeight: '200px', overflow: 'auto' }}>
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </td>
                        <td>{new Date(result.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 alert alert-info">
            <h5>AI Integration Methods:</h5>
            <ol>
              <li><strong>Script Execution:</strong> Uses /api/video/scripts/{'{'}id{'}'}/execute endpoint (legacy)</li>
              <li><strong>Agent Add (Phone):</strong> Makes outbound call to connect AI via phone/SIP</li>
              <li><strong>Agent Add (Video):</strong> Direct video room connection using Agents API</li>
              <li><strong>SWML Execution:</strong> Executes SignalWire Markup Language for AI configuration</li>
              <li><strong>Relay Bin:</strong> Triggers AI via relay bin URL (webhook approach)</li>
              <li><strong>Video SWML:</strong> SWML specifically for video room joining</li>
              <li><strong>Agents SDK:</strong> Proper agent creation following SignalWire guide (recommended)</li>
            </ol>
            <div className="mt-3">
              <strong>Common Issues:</strong>
              <ul className="mb-0">
                <li>400 errors = Edge Function not deployed or missing environment variables</li>
                <li>404 on script execute = Script ID is wrong or not deployed</li>
                <li>Agent add fails = Agent ID format issue or permissions</li>
                <li>No AI joins = Missing environment variables or misconfiguration</li>
                <li>Relay bin fails = SIGNALWIRE_AI_RELAY_BIN_URL not set</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AIIntegrationTest