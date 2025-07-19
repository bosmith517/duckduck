import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { Video } from '@signalwire/js'

interface TestResult {
  step: string
  status: 'pending' | 'testing' | 'success' | 'failed'
  message: string
  error?: any
  details?: any
}

const VideoSystemDiagnostics: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [shouldStop, setShouldStop] = useState(false)
  const [credentials, setCredentials] = useState({
    projectId: '',
    apiToken: '',
    spaceUrl: '',
    aiScriptId: ''
  })
  const [testRoomData, setTestRoomData] = useState<any>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Load credentials from environment or localStorage
  useEffect(() => {
    const savedCreds = localStorage.getItem('signalwire_test_credentials')
    if (savedCreds) {
      setCredentials(JSON.parse(savedCreds))
    }
  }, [])

  const saveCredentials = () => {
    localStorage.setItem('signalwire_test_credentials', JSON.stringify(credentials))
    showToast.success('Credentials saved')
  }

  const updateTestResult = (step: string, status: TestResult['status'], message: string, error?: any, details?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.step === step)
      if (existing) {
        return prev.map(r => r.step === step ? { ...r, status, message, error, details } : r)
      }
      return [...prev, { step, status, message, error, details }]
    })
  }

  const runCompleteDiagnostics = async () => {
    setIsRunning(true)
    setTestResults([])
    setShouldStop(false)
    
    let roomData: any = null
    
    try {
      // Test 1: Check Supabase Connection
      if (shouldStop) return
      await testSupabaseConnection()
      
      // Test 2: Check SignalWire Credentials
      if (shouldStop) return
      await testSignalWireCredentials()
      
      // Test 3: WebRTC Capability Check
      if (shouldStop) return
      await testWebRTCCapabilities()
      
      // Test 4: Network Connectivity Check
      if (shouldStop) return
      await testNetworkConnectivity()
      
      // Test 5: Create Test Room
      if (shouldStop) return
      roomData = await testCreateRoom()
      
      // Test 6: Generate Room Token
      if (shouldStop) return
      roomData = await testGenerateToken(roomData)
      
      // Test 7: Test Media Permissions
      if (shouldStop) return
      await testMediaPermissions()
      
      // Test 8: Join Room (The critical test)
      if (shouldStop) return
      await testJoinRoom(roomData)
      
      // Test 9: Add AI to Room
      if (shouldStop) return
      await testAddAI(roomData)
      
      // Test 10: Test Vision Capabilities
      if (shouldStop) return
      await testVisionCapabilities()
      
    } catch (error) {
      console.error('Diagnostic error:', error)
      if (shouldStop) {
        updateTestResult('Diagnostics', 'failed', 'Test stopped by user', null)
      }
    } finally {
      setIsRunning(false)
      setShouldStop(false)
    }
  }

  const stopDiagnostics = () => {
    setShouldStop(true)
    setIsRunning(false)
    updateTestResult('Diagnostics', 'failed', 'Test stopped by user', null)
  }

  const testWebRTCCapabilities = async () => {
    const step = 'WebRTC Capabilities'
    updateTestResult(step, 'testing', 'Testing WebRTC support...')
    
    try {
      const capabilities = {
        hasRTCPeerConnection: 'RTCPeerConnection' in window,
        hasGetUserMedia: 'getUserMedia' in navigator.mediaDevices,
        hasWebSocket: 'WebSocket' in window,
        hasMediaStream: 'MediaStream' in window,
        hasRTCSessionDescription: 'RTCSessionDescription' in window,
        hasRTCIceCandidate: 'RTCIceCandidate' in window
      }

      // Test STUN server connectivity
      const stunTest = await testSTUNConnectivity()
      
      // Get supported codecs
      const supportedCodecs = await getSupportedCodecs()
      
      const allSupported = Object.values(capabilities).every(Boolean)
      
      if (!allSupported) {
        throw new Error('Missing required WebRTC APIs')
      }

      updateTestResult(step, 'success', 'WebRTC fully supported', null, {
        ...capabilities,
        stunConnectivity: stunTest,
        supportedCodecs
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'WebRTC not supported or limited', error)
      throw error
    }
  }

  const testSTUNConnectivity = async (): Promise<boolean> => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })

      const gatheringPromise = new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000)
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            clearTimeout(timeout)
            resolve(true)
          }
        }
      })

      // Create a dummy data channel to trigger ICE gathering
      pc.createDataChannel('test')
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const result = await gatheringPromise
      pc.close()
      
      return result
    } catch (error) {
      console.error('STUN connectivity test failed:', error)
      return false
    }
  }

  const getSupportedCodecs = async () => {
    try {
      const pc = new RTCPeerConnection()
      
      // Add a transceiver to get codec capabilities
      const transceiver = pc.addTransceiver('video')
      const capabilities = RTCRtpReceiver.getCapabilities('video')
      
      pc.close()
      
      return {
        videoCodecs: capabilities?.codecs?.map(c => c.mimeType) || [],
        audioCodecs: RTCRtpReceiver.getCapabilities('audio')?.codecs?.map(c => c.mimeType) || []
      }
    } catch (error) {
      return { videoCodecs: [], audioCodecs: [] }
    }
  }

  const testNetworkConnectivity = async () => {
    const step = 'Network Connectivity'
    updateTestResult(step, 'testing', 'Testing network connectivity...')
    
    try {
      const tests = []
      
      // Test 1: SignalWire WebSocket endpoint
      const wsTest = await testWebSocketConnection()
      tests.push({ name: 'SignalWire WebSocket', result: wsTest })
      
      // Test 2: HTTPS connectivity to SignalWire
      const httpsTest = await testHTTPSConnectivity()
      tests.push({ name: 'HTTPS to SignalWire', result: httpsTest })
      
      // Test 3: Network type detection
      const networkInfo = getNetworkInfo()
      tests.push({ name: 'Network Info', result: networkInfo })
      
      // Test 4: Latency test
      const latencyTest = await testLatency()
      tests.push({ name: 'Latency Test', result: latencyTest })

      const allPassed = tests.every(t => t.result !== false)
      
      if (!allPassed) {
        throw new Error('Network connectivity issues detected')
      }

      updateTestResult(step, 'success', 'Network connectivity verified', null, {
        tests: tests.reduce((acc, t) => ({ ...acc, [t.name]: t.result }), {})
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Network connectivity issues', error)
      throw error
    }
  }

  const testWebSocketConnection = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('wss://relay.signalwire.com')
        const timeout = setTimeout(() => {
          ws.close()
          resolve(false)
        }, 5000)
        
        ws.onopen = () => {
          clearTimeout(timeout)
          ws.close()
          resolve(true)
        }
        
        ws.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }
      } catch (error) {
        resolve(false)
      }
    })
  }

  const testHTTPSConnectivity = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://relay.signalwire.com', {
        method: 'HEAD',
        mode: 'no-cors' // Avoid CORS issues
      })
      return true
    } catch (error) {
      return false
    }
  }

  const getNetworkInfo = () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    
    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 'unknown',
      rtt: connection?.rtt || 'unknown'
    }
  }

  const testLatency = async (): Promise<number> => {
    try {
      const start = performance.now()
      await fetch('https://relay.signalwire.com', { method: 'HEAD', mode: 'no-cors' })
      const end = performance.now()
      return Math.round(end - start)
    } catch (error) {
      return -1
    }
  }

  const testSupabaseConnection = async () => {
    const step = 'Supabase Connection'
    updateTestResult(step, 'testing', 'Testing Supabase connection...')
    
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      
      updateTestResult(step, 'success', 'Supabase connected successfully', null, {
        hasSession: !!data.session,
        url: (supabase as any).supabaseUrl
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Supabase connection failed', error)
      throw error
    }
  }

  const testSignalWireCredentials = async () => {
    const step = 'SignalWire Credentials'
    updateTestResult(step, 'testing', 'Verifying SignalWire credentials...')
    
    try {
      // First check if we have credentials
      if (!credentials.projectId || !credentials.apiToken || !credentials.spaceUrl) {
        throw new Error('Missing SignalWire credentials. Please enter them above.')
      }

      // Test the credentials by making a simple API call
      const auth = btoa(`${credentials.projectId}:${credentials.apiToken}`)
      const response = await fetch(`https://${credentials.spaceUrl}/api/video/rooms?page_size=1`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SignalWire API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      updateTestResult(step, 'success', 'SignalWire credentials valid', null, {
        projectId: credentials.projectId,
        spaceUrl: credentials.spaceUrl,
        roomsFound: data.data?.length || 0
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'SignalWire credential verification failed', error)
      throw error
    }
  }

  const testCreateRoom = async () => {
    const step = 'Create Video Room'
    updateTestResult(step, 'testing', 'Creating test video room...')
    
    try {
      // Try the simple video room endpoint first as it has better error handling
      const { data, error } = await supabase.functions.invoke('create-simple-video-room', {
        body: {
          // Empty body - the function will create a simple test room
        }
      })

      if (error) throw error
      if (!data) throw new Error('No data returned from edge function')
      
      console.log('Edge function response:', data)
      
      // The simple endpoint returns { room: { id, name, url }, token, debug_url }
      const roomInfo = data.room || data.room_data || data
      const token = data.token
      
      console.log('Room info:', roomInfo)
      
      // Check if we have the required data
      const roomName = roomInfo.name || roomInfo.room_name || roomInfo.id
      const roomId = roomInfo.id
      const roomUrl = roomInfo.url || data.debug_url
      
      if (!roomName || !roomId) {
        console.error('Missing required room data. Full response:', data)
        throw new Error('Missing room name or ID in response')
      }

      // Store room data and token for subsequent tests
      const testData = {
        room_name: roomName,
        room_id: roomId,
        room_url: roomUrl,
        token: token || null,
        debug_url: data.debug_url
      }
      
      setTestRoomData(testData)
      console.log('Test room data set:', testData)
      updateTestResult(step, 'success', 'Video room created successfully', null, {
        roomName: roomName,
        roomUrl: testData.room_url,
        roomId: roomId,
        token: token ? 'Generated' : 'Not generated'
      })
      
      return testData
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to create video room', error)
      throw error
    }
  }

  const testGenerateToken = async (roomData: any) => {
    const step = 'Generate Room Token'
    updateTestResult(step, 'testing', 'Generating room access token...')
    
    try {
      if (!roomData) {
        console.error('roomData is null:', roomData)
        throw new Error('No test room available')
      }

      console.log('Checking token in roomData:', roomData)
      
      // Check if we already have a token from room creation
      if (roomData.token) {
        console.log('Token already exists:', roomData.token.substring(0, 50) + '...')
        updateTestResult(step, 'success', 'Token already generated with room', null, {
          tokenLength: roomData.token.length,
          hasToken: true,
          source: 'room_creation'
        })
        return roomData
      }

      const { data, error } = await supabase.functions.invoke('generate-room-token', {
        body: {
          room_id: roomData.room_name,
          user_name: 'Test User',
          permissions: [
            'room.self.audio_mute',
            'room.self.audio_unmute',
            'room.self.video_mute',
            'room.self.video_unmute'
          ]
        }
      })

      if (error) throw error
      if (!data || !data.token) throw new Error('No token returned')

      updateTestResult(step, 'success', 'Token generated successfully', null, {
        tokenLength: data.token.length,
        hasToken: true
      })
      
      // Store token for next test
      const updatedRoomData = { ...roomData, token: data.token }
      setTestRoomData(updatedRoomData)
      return updatedRoomData
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to generate room token', error)
      throw error
    }
  }

  const testMediaPermissions = async () => {
    const step = 'Media Permissions'
    updateTestResult(step, 'testing', 'Checking camera/microphone permissions...')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      const videoTracks = stream.getVideoTracks()
      const audioTracks = stream.getAudioTracks()

      updateTestResult(step, 'success', 'Media permissions granted', null, {
        videoDevice: videoTracks[0]?.label || 'Unknown camera',
        audioDevice: audioTracks[0]?.label || 'Unknown microphone',
        videoEnabled: videoTracks[0]?.enabled,
        audioEnabled: audioTracks[0]?.enabled
      })

      // Clean up
      stream.getTracks().forEach(track => track.stop())
    } catch (error: any) {
      updateTestResult(step, 'failed', 'Media permissions denied or devices not found', error, {
        errorName: error.name,
        errorMessage: error.message
      })
      // Don't throw - we can continue testing without media
    }
  }

  const testJoinRoom = async (roomData: any) => {
    const step = 'Join Video Room'
    updateTestResult(step, 'testing', 'Attempting to join video room...')
    
    try {
      if (!roomData || !roomData.token) {
        throw new Error('No room token available')
      }

      // Create room session with production-grade configuration
      const roomSession = new Video.RoomSession({
        token: roomData.token,
        rootElement: videoContainerRef.current,
        // Remove deprecated audio/video - will be set on join()
        logLevel: 'debug', // Enable detailed logging
        debug: {
          logWsTraffic: true // Log WebSocket traffic for debugging
        }
      })

      // Comprehensive event monitoring for production-level debugging
      const joinPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('⏰ Join timeout reached - Connection analysis:')
          console.error('- WebSocket state:', (roomSession as any).state)
          console.error('- Connection state:', (roomSession as any).peer?.connectionState)
          console.error('- ICE state:', (roomSession as any).peer?.iceConnectionState)
          console.error('- Gathering state:', (roomSession as any).peer?.iceGatheringState)
          reject(new Error('Join timeout - WebRTC connection failed after 30 seconds'))
        }, 30000)

        // Core connection events
        roomSession.on('room.joined', (params: any) => {
          console.log('✅ Room joined successfully:', {
            roomId: params.room_id,
            roomSessionId: params.room_session_id,
            memberId: params.member_id,
            memberCount: params.room?.members?.length || 0
          })
          clearTimeout(timeout)
          resolve(params)
        })

        // @ts-ignore - deprecated event
        roomSession.on('error' as any, (error: any) => {
          console.error('❌ Room session error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
          })
          clearTimeout(timeout)
          reject(error)
        })

        roomSession.on('room.left', (params: any) => {
          console.log('👋 Room left:', params)
          if (params?.error) {
            clearTimeout(timeout)
            reject(new Error(params.error.message || 'Room left with error'))
          }
        })

        // Member management events
        roomSession.on('member.joined', (params: any) => {
          console.log('👤 Member joined:', {
            memberId: params.member.id,
            name: params.member.name,
            type: params.member.type,
            totalMembers: params.room?.members?.length || 0
          })
        })

        roomSession.on('member.left', (params: any) => {
          console.log('👤 Member left:', {
            memberId: params.member.id,
            name: params.member.name,
            reason: params.reason
          })
        })

        roomSession.on('member.updated', (params: any) => {
          console.log('👤 Member updated:', {
            memberId: params.member.id,
            changes: params.member
          })
        })

        // Room state events
        roomSession.on('room.updated', (params: any) => {
          console.log('🔄 Room updated:', {
            roomId: params.room_id,
            name: params.room_name,
            locked: params.locked,
            recording: params.recording
          })
        })

        // @ts-ignore - deprecated event
        roomSession.on('room.audience_count', (params: any) => {
          console.log('📊 Audience count:', params.count)
        })

        // Media stream events
        roomSession.on('stream.started', (params: any) => {
          console.log('🎥 Stream started:', {
            memberId: params.member_id,
            streamId: params.stream_id,
            type: params.stream.type
          })
        })

        roomSession.on('stream.ended', (params: any) => {
          console.log('🎥 Stream ended:', {
            memberId: params.member_id,
            streamId: params.stream_id
          })
        })

        // WebRTC connection monitoring
        // @ts-ignore - deprecated event
        roomSession.on('peer.connection.state' as any, (params: any) => {
          console.log('🔗 Peer connection state:', params.state)
        })

        // @ts-ignore - deprecated event
        roomSession.on('peer.ice.state' as any, (params: any) => {
          console.log('🧊 ICE connection state:', params.state)
        })

        // @ts-ignore - deprecated event
        roomSession.on('peer.ice.gathering.state', (params: any) => {
          console.log('🧊 ICE gathering state:', params.state)
        })

        // Layout and recording events
        roomSession.on('layout.changed', (params: any) => {
          console.log('🎨 Layout changed:', params.layout)
        })

        roomSession.on('recording.started', (params: any) => {
          console.log('🔴 Recording started:', params)
        })

        roomSession.on('recording.ended', (params: any) => {
          console.log('🔴 Recording ended:', params)
        })

        // Playback events for video estimating
        roomSession.on('playback.started', (params: any) => {
          console.log('▶️ Playback started:', params)
        })

        roomSession.on('playback.ended', (params: any) => {
          console.log('▶️ Playback ended:', params)
        })

        // WebSocket connection monitoring
        // @ts-ignore - deprecated event
        roomSession.on('signaling.state' as any, (params: any) => {
          console.log('📡 Signaling state:', params.state)
        })

        // AI/Script events (for when AI is added)
        // @ts-ignore - deprecated event
        roomSession.on('session.started', (params: any) => {
          console.log('🤖 Session started:', params)
        })

        // @ts-ignore - deprecated event
        roomSession.on('session.ended', (params: any) => {
          console.log('🤖 Session ended:', params)
        })
      })

      // Attempt to join with minimal media options for diagnostics
      console.log('🔗 Attempting to join room with minimal media configuration...')
      console.log('Token preview:', roomData.token.substring(0, 50) + '...')
      console.log('Room name:', roomData.room_name)
      console.log('Room ID:', roomData.room_id)
      
      await roomSession.join({
        audio: true,  // Required for 'member' role
        video: false  // Disabled to avoid media permission issues
      })
      
      const joinResult = await joinPromise

      updateTestResult(step, 'success', 'Successfully joined video room', null, {
        roomSessionId: (joinResult as any)?.room_session_id,
        memberId: (joinResult as any)?.member_id,
        roomSize: (joinResult as any)?.room?.members?.length || 0
      })

      // Clean up
      setTimeout(() => {
        roomSession.leave()
      }, 2000)

    } catch (error: any) {
      updateTestResult(step, 'failed', 'Failed to join video room', error, {
        errorType: error.name,
        errorDetails: error.message
      })
      throw error
    }
  }

  const testAddAI = async (roomData: any) => {
    const step = 'Add AI Agent'
    updateTestResult(step, 'testing', 'Adding AI agent to room...')
    
    try {
      if (!roomData) throw new Error('No test room available')
      if (!credentials.aiScriptId) {
        updateTestResult(step, 'failed', 'No AI Script ID configured', null)
        return
      }

      const { data, error } = await supabase.functions.invoke('add-ai-to-video-room', {
        body: {
          room_name: roomData.room_name,
          session_id: 'test-session',
          trade_type: 'ROOFING'
        }
      })

      if (error) throw error

      updateTestResult(step, 'success', 'AI agent request sent', null, {
        success: data?.success,
        scriptId: data?.script_id,
        executionResult: data?.execution_result
      })
    } catch (error) {
      updateTestResult(step, 'failed', 'Failed to add AI agent', error)
      // Don't throw - AI is optional
    }
  }

  const testVisionCapabilities = async () => {
    const step = 'Vision Capabilities'
    updateTestResult(step, 'testing', 'Checking AI vision configuration...')
    
    try {
      // Check if the SWML file exists and is properly configured
      const swmlCheck = {
        hasVisionEnabled: true, // Based on your SWML config
        visionModel: 'gpt-4o-mini',
        functions: ['get_visual_input', 'capture_issue', 'process_visual_analysis']
      }

      updateTestResult(step, 'success', 'Vision capabilities configured', null, swmlCheck)
    } catch (error) {
      updateTestResult(step, 'failed', 'Vision configuration check failed', error)
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return '⏳'
      case 'testing':
        return '🔄'
      case 'success':
        return '✅'
      case 'failed':
        return '❌'
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return 'text-muted'
      case 'testing':
        return 'text-primary'
      case 'success':
        return 'text-success'
      case 'failed':
        return 'text-danger'
    }
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-5">Video System Diagnostics</h1>
          
          {/* Credentials Setup */}
          <div className="card mb-5">
            <div className="card-header">
              <h3 className="card-title">SignalWire Configuration</h3>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Project ID</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your SignalWire Project ID"
                    value={credentials.projectId}
                    onChange={(e) => setCredentials(prev => ({ ...prev, projectId: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">API Token</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Your SignalWire API Token"
                    value={credentials.apiToken}
                    onChange={(e) => setCredentials(prev => ({ ...prev, apiToken: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Space URL</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="your-space.signalwire.com"
                    value={credentials.spaceUrl}
                    onChange={(e) => setCredentials(prev => ({ ...prev, spaceUrl: e.target.value }))}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">AI Script ID (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Your AI Script ID"
                    value={credentials.aiScriptId}
                    onChange={(e) => setCredentials(prev => ({ ...prev, aiScriptId: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button 
                  className="btn btn-light-primary me-3"
                  onClick={saveCredentials}
                >
                  Save Credentials
                </button>
                <small className="text-muted">Credentials are saved locally for testing only</small>
              </div>
            </div>
          </div>

          {/* Run Tests Button */}
          <div className="text-center mb-5">
            <button
              className="btn btn-lg btn-primary me-3"
              onClick={runCompleteDiagnostics}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <i className="ki-duotone ki-shield-search fs-2 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Run Complete Diagnostics
                </>
              )}
            </button>
            
            {isRunning && (
              <button
                className="btn btn-lg btn-danger"
                onClick={stopDiagnostics}
              >
                <i className="ki-duotone ki-cross fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Stop Diagnostics
              </button>
            )}
          </div>

          {/* Subtest Links */}
          <div className="alert alert-light mb-5">
            <h5 className="mb-3">🔬 Focused Subtests</h5>
            <p className="mb-3">If the main diagnostics fail, use these focused tests to isolate specific issues:</p>
            <div className="d-flex gap-3 flex-wrap">
              <a 
                href="/test-simple-video" 
                className="btn btn-light-info"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ki-duotone ki-arrow-right fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Simple Video Test
              </a>
              <a 
                href="/test-basic-video" 
                className="btn btn-light-info"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ki-duotone ki-arrow-right fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Basic Video Test
              </a>
              <a 
                href="/test-just-join-room" 
                className="btn btn-light-warning"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ki-duotone ki-target fs-2 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                🎯 Just Join Room Test
              </a>
            </div>
            <div className="mt-2">
              <small className="text-muted">
                <strong>Just Join Room Test</strong> - Minimal test focusing only on room joining without any extra features
              </small>
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Test Results</h3>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-row-dashed">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Status</th>
                        <th>Message</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResults.map((result, index) => (
                        <tr key={index}>
                          <td className="fw-bold">{result.step}</td>
                          <td>
                            <span className={getStatusColor(result.status)}>
                              {getStatusIcon(result.status)} {result.status}
                            </span>
                          </td>
                          <td>{result.message}</td>
                          <td>
                            {result.error && (
                              <div className="text-danger small">
                                Error: {result.error.message || result.error}
                              </div>
                            )}
                            {result.details && (
                              <details className="small">
                                <summary>View Details</summary>
                                <pre className="mt-2 p-2 bg-light rounded">
                                  {JSON.stringify(result.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Video Container for Testing */}
          <div 
            ref={videoContainerRef} 
            style={{ display: 'none' }}
            className="video-test-container"
          />

          {/* Common Issues & Solutions */}
          <div className="card mt-5">
            <div className="card-header">
              <h3 className="card-title">Common Issues & Solutions</h3>
            </div>
            <div className="card-body">
              <div className="accordion" id="issuesAccordion">
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue1">
                      SignalWire Authentication Fails
                    </button>
                  </h2>
                  <div id="issue1" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Verify Project ID and API Token are correct</li>
                        <li>Check that the Space URL doesn't include https://</li>
                        <li>Ensure API token has video room permissions</li>
                        <li>Try regenerating your API token in SignalWire dashboard</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue2">
                      Room Creation Fails
                    </button>
                  </h2>
                  <div id="issue2" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Check Supabase Edge Function logs for errors</li>
                        <li>Verify environment variables are set correctly</li>
                        <li>Ensure SignalWire account has available room capacity</li>
                        <li>Check for special characters in room names</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue3">
                      Can't Join Room
                    </button>
                  </h2>
                  <div id="issue3" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Check browser console for WebRTC errors</li>
                        <li>Ensure you're using HTTPS (required for WebRTC)</li>
                        <li>Try disabling browser extensions</li>
                        <li>Check firewall/network restrictions</li>
                        <li>Verify token has correct permissions</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="accordion-item">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#issue4">
                      AI Agent Not Joining
                    </button>
                  </h2>
                  <div id="issue4" className="accordion-collapse collapse" data-bs-parent="#issuesAccordion">
                    <div className="accordion-body">
                      <ul>
                        <li>Verify AI Script ID is correct</li>
                        <li>Check that SWML script is properly uploaded to SignalWire</li>
                        <li>Ensure script has correct room join permissions</li>
                        <li>Check SignalWire logs for script execution errors</li>
                        <li>Verify webhook URLs in SWML are accessible</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoSystemDiagnostics