import React, { useState, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import SignalWireVideoRoom from '../../components/video/SignalWireVideoRoom'
import SignalWireVideoRoomSimple from '../../components/video/SignalWireVideoRoomSimple'
import SignalWireVideoRoomCDN from '../../components/video/SignalWireVideoRoomCDN'
import SignalWireVideoRoomUltraSimple from '../../components/video/SignalWireVideoRoomUltraSimple'

interface ConnectionMetrics {
  startTime: number
  endTime?: number
  duration?: number
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error?: string
}

export const SimpleRoomComparisonTest: React.FC = () => {
  const [token, setToken] = useState<string>('')
  const [roomName, setRoomName] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeComponent, setActiveComponent] = useState<'original' | 'simple' | 'cdn' | 'ultra' | null>(null)
  
  const [metrics, setMetrics] = useState<{
    original: ConnectionMetrics
    simple: ConnectionMetrics
    cdn: ConnectionMetrics
    ultra: ConnectionMetrics
  }>({
    original: { startTime: 0, status: 'idle' },
    simple: { startTime: 0, status: 'idle' },
    cdn: { startTime: 0, status: 'idle' },
    ultra: { startTime: 0, status: 'idle' }
  })

  const generateTestToken = async () => {
    setIsGenerating(true)
    try {
      const testRoomName = `comparison-test-${Date.now()}`
      // Use signalwire-token-v2 like the testimonial component
      const { data, error } = await supabase.functions.invoke('signalwire-token-v2', {
        body: { 
          roomName: testRoomName,
          userName: 'Comparison Test'
        }
      })

      if (error) throw error
      if (!data.token) throw new Error('No token received')

      setToken(data.token)
      setRoomName(data.roomName)
      console.log('Test token generated for room:', data.roomName)
    } catch (err: any) {
      console.error('Error generating test token:', err)
      alert('Failed to generate test token: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const startTest = (component: 'original' | 'simple' | 'cdn' | 'ultra') => {
    setActiveComponent(component)
    setMetrics(prev => ({
      ...prev,
      [component]: {
        startTime: Date.now(),
        status: 'connecting'
      }
    }))
  }

  const handleRoomJoined = (component: 'original' | 'simple' | 'cdn' | 'ultra') => (roomSession: any) => {
    const endTime = Date.now()
    const startTime = metrics[component].startTime
    const duration = endTime - startTime
    
    setMetrics(prev => ({
      ...prev,
      [component]: {
        ...prev[component],
        endTime,
        duration,
        status: 'connected'
      }
    }))
    
    console.log(`✅ ${component} connected in ${duration}ms (${(duration/1000).toFixed(1)}s)`)
  }

  const handleError = (component: 'original' | 'simple' | 'cdn' | 'ultra') => (error: any) => {
    setMetrics(prev => ({
      ...prev,
      [component]: {
        ...prev[component],
        status: 'error',
        error: error.message
      }
    }))
  }

  const reset = () => {
    setActiveComponent(null)
    setToken('')
    setRoomName('')
    setMetrics({
      original: { startTime: 0, status: 'idle' },
      simple: { startTime: 0, status: 'idle' },
      cdn: { startTime: 0, status: 'idle' },
      ultra: { startTime: 0, status: 'idle' }
    })
  }

  const getStatusBadge = (status: ConnectionMetrics['status']) => {
    switch (status) {
      case 'idle': return <span className="badge bg-secondary">Idle</span>
      case 'connecting': return <span className="badge bg-warning">Connecting...</span>
      case 'connected': return <span className="badge bg-success">Connected</span>
      case 'error': return <span className="badge bg-danger">Error</span>
    }
  }

  const getTimingColor = (duration?: number) => {
    if (!duration) return ''
    if (duration < 5000) return 'text-success'
    if (duration < 20000) return 'text-warning'
    return 'text-danger'
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🧪 SignalWire Room Implementation Comparison</h1>
          <p className="lead mb-4">
            Compare connection times between different SignalWire implementations
          </p>

          {/* Token Generation */}
          {!token ? (
            <div className="card mb-4">
              <div className="card-body text-center">
                <h3>Step 1: Generate Test Token</h3>
                <p>Create a test room and token to use for all comparisons</p>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={generateTestToken}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Generating...
                    </>
                  ) : (
                    '🔑 Generate Test Token'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Test Info */}
              <div className="alert alert-info mb-4">
                <h5>Test Room: {roomName}</h5>
                <p className="mb-0">Token generated. Click on each implementation to test connection speed.</p>
                <button className="btn btn-sm btn-secondary mt-2" onClick={reset}>
                  Reset Test
                </button>
              </div>

              {/* Comparison Table */}
              <div className="card mb-4">
                <div className="card-header">
                  <h3 className="card-title">Connection Performance</h3>
                </div>
                <div className="card-body">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Implementation</th>
                        <th>Status</th>
                        <th>Connection Time</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Original</strong>
                          <div className="text-muted small">Complex ICE configuration</div>
                        </td>
                        <td>{getStatusBadge(metrics.original.status)}</td>
                        <td className={getTimingColor(metrics.original.duration)}>
                          {metrics.original.duration 
                            ? `${(metrics.original.duration / 1000).toFixed(1)}s`
                            : '-'
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => startTest('original')}
                            disabled={activeComponent !== null || metrics.original.status === 'connected'}
                          >
                            Test Original
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Simple (Like Testimonial)</strong>
                          <div className="text-muted small">Minimal config, no ICE servers</div>
                        </td>
                        <td>{getStatusBadge(metrics.simple.status)}</td>
                        <td className={getTimingColor(metrics.simple.duration)}>
                          {metrics.simple.duration 
                            ? `${(metrics.simple.duration / 1000).toFixed(1)}s`
                            : '-'
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => startTest('simple')}
                            disabled={activeComponent !== null || metrics.simple.status === 'connected'}
                          >
                            Test Simple ⭐
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>CDN Version</strong>
                          <div className="text-muted small">Loads SDK from CDN</div>
                        </td>
                        <td>{getStatusBadge(metrics.cdn.status)}</td>
                        <td className={getTimingColor(metrics.cdn.duration)}>
                          {metrics.cdn.duration 
                            ? `${(metrics.cdn.duration / 1000).toFixed(1)}s`
                            : '-'
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-info"
                            onClick={() => startTest('cdn')}
                            disabled={activeComponent !== null || metrics.cdn.status === 'connected'}
                          >
                            Test CDN
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Ultra Simple (Exact Testimonial)</strong>
                          <div className="text-muted small">CDN + Wait for SDK + signalwire-token-v2</div>
                        </td>
                        <td>{getStatusBadge(metrics.ultra.status)}</td>
                        <td className={getTimingColor(metrics.ultra.duration)}>
                          {metrics.ultra.duration 
                            ? `${(metrics.ultra.duration / 1000).toFixed(1)}s`
                            : '-'
                          }
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-warning"
                            onClick={() => startTest('ultra')}
                            disabled={activeComponent !== null || metrics.ultra.status === 'connected'}
                          >
                            Test Ultra ⚡
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Component */}
              {activeComponent && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">
                      {activeComponent === 'original' && 'Original SignalWireVideoRoom'}
                      {activeComponent === 'simple' && 'SignalWireVideoRoomSimple (Testimonial Pattern)'}
                      {activeComponent === 'cdn' && 'SignalWireVideoRoomCDN'}
                      {activeComponent === 'ultra' && 'SignalWireVideoRoomUltraSimple (Exact Testimonial Copy)'}
                    </h3>
                  </div>
                  <div className="card-body">
                    {activeComponent === 'original' && (
                      <SignalWireVideoRoom
                        token={token}
                        roomName={roomName}
                        userName="Original Test"
                        onRoomJoined={handleRoomJoined('original')}
                        onError={handleError('original')}
                        enableAudio={true}
                        enableVideo={true}
                        layout="grid-responsive"
                      />
                    )}
                    {activeComponent === 'simple' && (
                      <SignalWireVideoRoomSimple
                        token={token}
                        roomName={roomName}
                        userName="Simple Test"
                        onRoomJoined={handleRoomJoined('simple')}
                        onError={handleError('simple')}
                        enableAudio={true}
                        enableVideo={true}
                        layout="grid-responsive"
                      />
                    )}
                    {activeComponent === 'cdn' && (
                      <SignalWireVideoRoomCDN
                        token={token}
                        roomName={roomName}
                        userName="CDN Test"
                        onRoomJoined={handleRoomJoined('cdn')}
                        onError={handleError('cdn')}
                        enableAudio={true}
                        enableVideo={true}
                        layout="grid-responsive"
                      />
                    )}
                    {activeComponent === 'ultra' && (
                      <SignalWireVideoRoomUltraSimple
                        token={token}
                        roomName={roomName}
                        userName="Ultra Test"
                        onRoomJoined={handleRoomJoined('ultra')}
                        onError={handleError('ultra')}
                        enableAudio={true}
                        enableVideo={true}
                        layout="grid-responsive"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Analysis */}
          <div className="alert alert-warning mt-4">
            <h5>🔍 Key Findings</h5>
            <ul className="mb-0">
              <li><strong>Testimonial Pattern Success:</strong> TestimonialVideoRoomClean achieves sub-6 second connections</li>
              <li><strong>Key Differences:</strong>
                <ul>
                  <li>Uses CDN instead of npm package</li>
                  <li>Waits for SDK to load before initializing</li>
                  <li>Uses signalwire-token-v2 Edge Function</li>
                  <li>NO iceServers configuration specified</li>
                </ul>
              </li>
              <li><strong>Gemini Analysis:</strong> Empty iceServers array bypasses STUN/TURN entirely (bad)</li>
              <li><strong>Real Issue:</strong> Likely firewall/network blocking SignalWire's STUN/TURN servers</li>
              <li><strong>Solution:</strong> Follow the Ultra Simple pattern exactly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SimpleRoomComparisonTest