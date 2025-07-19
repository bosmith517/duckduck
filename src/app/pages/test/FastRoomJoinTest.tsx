import React, { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import SignalWireVideoRoomSimple from '../../components/video/SignalWireVideoRoomSimple'

interface TestStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'success' | 'error'
  message?: string
  startTime?: number
  endTime?: number
}

export const FastRoomJoinTest: React.FC = () => {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: 'permissions', name: 'Pre-warm Media Permissions', status: 'pending' },
    { id: 'room', name: 'Create Room via Supabase', status: 'pending' },
    { id: 'connect', name: 'Connect to Room', status: 'pending' }
  ])
  
  const [isRunning, setIsRunning] = useState(false)
  const [totalTime, setTotalTime] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [token, setToken] = useState<string>('')
  const [roomName, setRoomName] = useState<string>('')
  const [permissionTime, setPermissionTime] = useState<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const permissionStartRef = useRef<number>(0)

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    const logEntry = `${timestamp} (+${elapsed}ms) ${emoji} ${message}`
    setLogs(prev => [...prev, logEntry])
    console.log(`[FastRoomJoin] ${message}`)
  }, [])

  const updateStep = useCallback((stepId: string, status: TestStep['status'], message?: string) => {
    const now = Date.now()
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { 
            ...step, 
            status, 
            message, 
            startTime: status === 'running' ? now : step.startTime,
            endTime: status === 'success' || status === 'error' ? now : undefined
          } 
        : step
    ))
  }, [])

  // Pre-warm permissions on page load
  useEffect(() => {
    const preWarmPermissions = async () => {
      permissionStartRef.current = Date.now()
      updateStep('permissions', 'running')
      addLog('Pre-warming media permissions on page load...')
      
      try {
        // Request permissions first to avoid delays
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        // This "pre-warms" the browser's media permissions
        stream.getTracks().forEach(track => track.stop())
        
        const elapsed = Date.now() - permissionStartRef.current
        setPermissionTime(elapsed)
        updateStep('permissions', 'success', `Pre-warmed in ${elapsed}ms`)
        addLog(`✅ Permissions pre-warmed in ${elapsed}ms`, 'success')
      } catch (err: any) {
        updateStep('permissions', 'error', err.message)
        addLog(`❌ Failed to pre-warm permissions: ${err.message}`, 'error')
      }
    }
    
    preWarmPermissions()
  }, [])

  const runFastTest = async () => {
    setIsRunning(true)
    setLogs([])
    setTotalTime(null)
    setToken('')
    setRoomName('')
    startTimeRef.current = Date.now()
    
    // Reset room and connect steps (keep permissions as is)
    setSteps(prev => prev.map(step => 
      step.id === 'permissions' ? step : { ...step, status: 'pending', message: undefined, startTime: undefined, endTime: undefined }
    ))
    
    try {
      // Step 1: Create Room via Supabase
      updateStep('room', 'running')
      addLog('Creating room via Supabase Edge Function...')
      
      const testRoomName = `fast-test-${Date.now()}`
      
      const { data, error } = await supabase.functions.invoke('create-signalwire-room-fast', {
        body: { 
          room_name: testRoomName,
          customer_name: 'Speed Test User'
        }
      })

      if (error) throw error
      if (!data.token) throw new Error('No token received')

      const roomCreationTime = Date.now() - startTimeRef.current
      updateStep('room', 'success', `Room created in ${roomCreationTime}ms`)
      addLog(`✅ Room created: ${data.room_name}`, 'success')
      addLog(`Token received (${data.token.length} chars)`, 'success')
      
      setToken(data.token)
      setRoomName(data.room_name)
      
      // Step 2: Connect to Room
      updateStep('connect', 'running')
      addLog('⏱️ Starting connection timer...')
      addLog('SignalWireVideoRoom component will handle connection')
      
    } catch (error: any) {
      addLog(`Fatal error: ${error.message}`, 'error')
      updateStep('room', 'error', error.message)
      setIsRunning(false)
    }
  }

  const handleRoomJoined = (roomSession: any) => {
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current
      setTotalTime(elapsed)
      updateStep('connect', 'success', `Connected in ${elapsed}ms`)
      addLog(`🎉 Room joined in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`, 'success')
      
      if (elapsed < 5000) {
        addLog('⚡ FAST CONNECTION! Less than 5 seconds!', 'success')
      } else if (elapsed < 10000) {
        addLog('✅ Good connection time (5-10 seconds)', 'success')
      } else if (elapsed < 20000) {
        addLog('⚠️ Moderate connection time (10-20 seconds)', 'info')
      } else {
        addLog('❌ Slow connection (20+ seconds)', 'error')
      }
      
      if (permissionTime) {
        addLog(`📊 Permission pre-warming saved approximately ${(45000 - elapsed)}ms`, 'success')
      }
    }
    setIsRunning(false)
  }

  const handleError = (error: any) => {
    addLog(`❌ Connection error: ${error.message}`, 'error')
    updateStep('connect', 'error', error.message)
    setIsRunning(false)
  }

  const clearTest = () => {
    setToken('')
    setRoomName('')
    setTotalTime(null)
    setLogs([])
    startTimeRef.current = 0
    setSteps(prev => prev.map(step => 
      step.id === 'permissions' ? step : { ...step, status: 'pending', message: undefined, startTime: undefined, endTime: undefined }
    ))
  }

  const clearLogs = () => {
    setLogs([])
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">⚡ Fast Room Join Test</h1>
          <p className="lead mb-4">
            Testing if pre-warming media permissions reduces the 44-second connection delay.
          </p>

          {/* Performance Summary */}
          {totalTime && (
            <div className={`alert ${totalTime < 5000 ? 'alert-success' : totalTime < 20000 ? 'alert-warning' : 'alert-danger'} mb-4`}>
              <h4>🏆 Join Completed in {(totalTime / 1000).toFixed(1)} seconds</h4>
              <p className="mb-0">
                {totalTime < 5000 && '⚡ AMAZING! Sub-5 second connection!'}
                {totalTime >= 5000 && totalTime < 10000 && '✅ Great! Under 10 seconds'}
                {totalTime >= 10000 && totalTime < 20000 && '⚠️ OK, but could be faster'}
                {totalTime >= 20000 && totalTime < 40000 && '🐢 Still slow, but better than 44s'}
                {totalTime >= 40000 && '❌ No improvement - still over 40 seconds'}
              </p>
            </div>
          )}

          {/* Pre-warming Status */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Media Permission Pre-warming</h3>
            </div>
            <div className="card-body">
              {permissionTime !== null ? (
                <div className="alert alert-info mb-0">
                  <h5>✅ Permissions Pre-warmed</h5>
                  <p className="mb-0">
                    Media permissions were pre-requested in <strong>{permissionTime}ms</strong>.
                    This should prevent SignalWire from waiting for permissions during connection.
                  </p>
                </div>
              ) : (
                <div className="alert alert-warning mb-0">
                  <div className="spinner-border spinner-border-sm me-2" />
                  Pre-warming media permissions...
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          {!token ? (
            <div className="text-center mb-4">
              <button
                className="btn btn-primary btn-lg"
                onClick={runFastTest}
                disabled={isRunning || permissionTime === null}
              >
                {isRunning ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating Room...
                  </>
                ) : (
                  '⚡ Start Speed Test'
                )}
              </button>
              
              {permissionTime === null && (
                <div className="mt-2 text-muted">
                  <small>Waiting for media permissions to be pre-warmed...</small>
                </div>
              )}
            </div>
          ) : (
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h5>Room: {roomName}</h5>
                <span className="text-muted">Connection in progress...</span>
              </div>
              <button className="btn btn-secondary" onClick={clearTest}>
                New Test
              </button>
            </div>
          )}

          {/* Test Steps with Timing */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Connection Steps</h3>
            </div>
            <div className="card-body">
              {steps.map(step => {
                const duration = step.startTime && step.endTime ? step.endTime - step.startTime : null
                return (
                  <div key={step.id} className="d-flex align-items-center mb-3">
                    <div className="me-3" style={{ minWidth: '30px' }}>
                      {step.status === 'pending' && '⏳'}
                      {step.status === 'running' && <span className="spinner-border spinner-border-sm text-primary"></span>}
                      {step.status === 'success' && '✅'}
                      {step.status === 'error' && '❌'}
                    </div>
                    <div className="flex-grow-1">
                      <strong>{step.name}</strong>
                      {duration && <span className="badge bg-info ms-2">{duration}ms</span>}
                      {step.message && <div className="text-muted small">{step.message}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Video Room */}
          {token && (
            <div className="card mb-4">
              <div className="card-header">
                <h3 className="card-title">Video Room</h3>
              </div>
              <div className="card-body">
                <SignalWireVideoRoomSimple
                  token={token}
                  roomName={roomName}
                  userName="Speed Test"
                  onRoomJoined={handleRoomJoined}
                  onError={handleError}
                  enableAudio={true}
                  enableVideo={true}
                  layout="grid-responsive"
                />
              </div>
            </div>
          )}

          {/* Live Logs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Performance Logs</h3>
            </div>
            <div className="card-body">
              <div
                className="bg-dark text-light p-3 rounded"
                style={{
                  maxHeight: '500px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-muted">Click "Run Fast Test" to start</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Optimization Summary */}
          <div className="alert alert-info mt-4">
            <h5>⚡ Performance Optimization: Media Permission Pre-warming</h5>
            <p>This test implements the following optimization:</p>
            <pre className="bg-dark text-light p-3 rounded">
{`// Request permissions first to avoid delays
await navigator.mediaDevices.getUserMedia({ audio: true, video: true })

// This "pre-warms" the browser's media permissions, 
// so when SignalWire needs them, they're already available.`}
            </pre>
            <p className="mb-0 mt-3">
              <strong>Theory:</strong> The 44-second delay might be the browser waiting for 
              user interaction or some internal timeout when SignalWire requests permissions 
              during the connection process.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FastRoomJoinTest