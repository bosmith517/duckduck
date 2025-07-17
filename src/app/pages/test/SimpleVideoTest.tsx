import React, { useState, useRef } from 'react'
import { Video } from '@signalwire/js'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

const SimpleVideoTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready to start')
  const [roomName, setRoomName] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [error, setError] = useState('')
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
    console.log(`[SimpleVideoTest] ${message}`)
  }

  // Original function - kept for compatibility
  const createTestRoom = async () => {
    setStatus('Creating room...')
    setError('')
    
    try {
      const response = await supabase.functions.invoke('create-simple-video-room')
      
      // Check if we got data even with an error (SignalWire sometimes returns 400 but still works)
      if (response.data && response.data.room) {
        console.log('Room created:', response.data)
        setRoomInfo(response.data)
        setStatus('Room created successfully!')
        
        // Open debug page in new tab
        if (response.data.debug_url) {
          window.open(response.data.debug_url, '_blank')
        }
        return
      }
      
      if (response.error) {
        throw response.error
      }
      
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Failed to create room')
      setStatus('')
    }
  }

  // Step 1: Create a room with standard function
  const createRoom = async () => {
    try {
      setStatus('Creating room...')
      addLog('Creating video room via Edge Function')
      
      const roomName = `test_${Date.now()}`
      const { data, error } = await supabase.functions.invoke('create-video-room', {
        body: {
          room_name: roomName,
          trade_type: 'ROOFING',
          enable_vision: false, // Keep it simple
          enable_recording: false,
          max_participants: 2
        }
      })

      if (error) {
        addLog(`Edge Function error: ${error.message}`, 'error')
        throw error
      }

      if (!data || !data.room_name) {
        addLog('No room data returned from Edge Function', 'error')
        throw new Error('Invalid response from create-video-room')
      }

      setRoomName(data.room_name)
      setRoomInfo(data)
      addLog(`Room created successfully: ${data.room_name}`, 'success')
      addLog(`Room URL: ${data.room_url}`, 'info')
      setStatus('Room created! Now generate a token.')
      
      return data.room_name
    } catch (error: any) {
      addLog(`Failed to create room: ${error.message}`, 'error')
      setStatus('Failed to create room')
      setError(error.message)
      showToast.error('Failed to create room')
      throw error
    }
  }

  // Step 2: Generate a token
  const generateToken = async (roomNameParam?: string) => {
    try {
      const targetRoom = roomNameParam || roomName
      if (!targetRoom) {
        addLog('No room name available', 'error')
        throw new Error('Create a room first')
      }

      setStatus('Generating token...')
      addLog(`Generating token for room: ${targetRoom}`)

      const { data, error } = await supabase.functions.invoke('generate-room-token', {
        body: {
          room_id: targetRoom,
          user_name: 'Test User',
          permissions: [
            'room.self.audio_mute',
            'room.self.audio_unmute',
            'room.self.video_mute',
            'room.self.video_unmute'
          ]
        }
      })

      if (error) {
        addLog(`Token generation error: ${error.message}`, 'error')
        throw error
      }

      if (!data || !data.token) {
        addLog('No token returned from Edge Function', 'error')
        throw new Error('Invalid token response')
      }

      setToken(data.token)
      addLog('Token generated successfully', 'success')
      addLog(`Token length: ${data.token.length} characters`, 'info')
      setStatus('Token ready! Now test the connection.')
      
      return data.token
    } catch (error: any) {
      addLog(`Failed to generate token: ${error.message}`, 'error')
      setStatus('Failed to generate token')
      setError(error.message)
      showToast.error('Failed to generate token')
      throw error
    }
  }

  // Step 3: Test media permissions
  const testMediaPermissions = async () => {
    try {
      setStatus('Testing media permissions...')
      addLog('Requesting camera and microphone access')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      addLog(`Video device: ${videoTrack?.label || 'Unknown'}`, 'success')
      addLog(`Audio device: ${audioTrack?.label || 'Unknown'}`, 'success')
      
      // Show preview
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.muted = true
      video.style.width = '100%'
      video.style.maxWidth = '400px'
      
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = ''
        videoContainerRef.current.appendChild(video)
      }

      // Stop after 3 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop())
        if (videoContainerRef.current) {
          videoContainerRef.current.innerHTML = '<p class="text-muted">Media test completed</p>'
        }
      }, 3000)

      setStatus('Media permissions granted!')
      return true
    } catch (error: any) {
      addLog(`Media permission error: ${error.name} - ${error.message}`, 'error')
      setStatus('Media permissions denied')
      return false
    }
  }

  // Step 4: Join room with SignalWire SDK
  const joinRoom = async (tokenParam?: string) => {
    try {
      const targetToken = tokenParam || token
      if (!targetToken) {
        addLog('No token available', 'error')
        throw new Error('Generate a token first')
      }

      setStatus('Connecting to SignalWire...')
      addLog('Initializing SignalWire Video SDK')

      // Clean up any existing session
      if (roomSessionRef.current) {
        try {
          await roomSessionRef.current.leave()
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Create room session
      addLog('Creating RoomSession object')
      const roomSession = new Video.RoomSession({
        token: targetToken,
        rootElement: videoContainerRef.current,
        audio: true,
        video: true
      })

      roomSessionRef.current = roomSession

      // Set up all event handlers
      roomSession.on('room.joined', (params: any) => {
        addLog('EVENT: room.joined', 'success')
        addLog(`Room ID: ${params.room?.id}`, 'info')
        addLog(`Member ID: ${params.member_id}`, 'info')
        addLog(`Room session ID: ${params.room_session_id}`, 'info')
        setStatus('Connected to room!')
      })

      roomSession.on('room.updated', (params: any) => {
        addLog('EVENT: room.updated', 'info')
      })

      roomSession.on('member.joined', (params: any) => {
        addLog(`EVENT: member.joined - ${params.member.name}`, 'info')
      })

      roomSession.on('member.left', (params: any) => {
        addLog(`EVENT: member.left - ${params.member.name}`, 'info')
      })

      roomSession.on('error', (error: any) => {
        addLog(`EVENT: error - ${error.message || JSON.stringify(error)}`, 'error')
      })

      roomSession.on('room.left', (params: any) => {
        addLog('EVENT: room.left', 'info')
        if (params?.error) {
          addLog(`Left with error: ${params.error.message}`, 'error')
        }
        setStatus('Disconnected from room')
      })

      // Attempt to join
      addLog('Calling roomSession.join()')
      await roomSession.join()
      
      addLog('Join method completed, waiting for events...', 'info')

    } catch (error: any) {
      addLog(`Join room error: ${error.message}`, 'error')
      addLog(`Error stack: ${error.stack}`, 'error')
      setStatus('Failed to join room')
      setError(error.message)
      showToast.error('Failed to join room')
    }
  }

  // Step 5: Leave room
  const leaveRoom = async () => {
    try {
      if (roomSessionRef.current) {
        addLog('Leaving room...')
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
        addLog('Left room successfully', 'success')
        setStatus('Disconnected')
      }
    } catch (error: any) {
      addLog(`Leave room error: ${error.message}`, 'error')
    }
  }

  // All-in-one test
  const runFullTest = async () => {
    try {
      setLogs([])
      setError('')
      addLog('Starting full video system test', 'info')
      
      // Test media first
      const hasMedia = await testMediaPermissions()
      if (!hasMedia) {
        addLog('Continuing without media access', 'info')
      }

      // Create room
      const newRoomName = await createRoom()
      
      // Generate token
      const newToken = await generateToken(newRoomName)
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Join room
      await joinRoom(newToken)
      
    } catch (error: any) {
      addLog(`Full test failed: ${error.message}`, 'error')
    }
  }

  const clearLogs = () => {
    setLogs([])
    setError('')
  }
  
  return (
    <div className="container py-5">
      <h1 className="mb-5">Simple Video Connection Test</h1>
      
      {/* Status Display */}
      <div className="alert alert-info mb-5">
        <h4>Status: {status}</h4>
        {roomName && <p className="mb-1">Room: <code>{roomName}</code></p>}
        {token && <p className="mb-0">Token: <code>{token.substring(0, 50)}...</code></p>}
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger mb-5">
          <h5>Error:</h5>
          {error}
        </div>
      )}

      {/* Control Buttons */}
      <div className="row mb-5">
        <div className="col-12">
          <div className="d-flex gap-3 flex-wrap">
            <button 
              className="btn btn-primary"
              onClick={runFullTest}
            >
              🚀 Run Full Test
            </button>
            
            <div className="vr"></div>
            
            <button 
              className="btn btn-light-primary"
              onClick={createTestRoom}
            >
              Create Simple Room (Legacy)
            </button>
            
            <button 
              className="btn btn-light-primary"
              onClick={createRoom}
            >
              1. Create Room
            </button>
            
            <button 
              className="btn btn-light-primary"
              onClick={() => generateToken()}
              disabled={!roomName}
            >
              2. Generate Token
            </button>
            
            <button 
              className="btn btn-light-primary"
              onClick={testMediaPermissions}
            >
              3. Test Media
            </button>
            
            <button 
              className="btn btn-light-primary"
              onClick={() => joinRoom()}
              disabled={!token}
            >
              4. Join Room
            </button>
            
            <button 
              className="btn btn-light-danger"
              onClick={leaveRoom}
            >
              Leave Room
            </button>
            
            <button 
              className="btn btn-light"
              onClick={clearLogs}
            >
              Clear Logs
            </button>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="row mb-5">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Video Container</h3>
            </div>
            <div className="card-body">
              <div 
                ref={videoContainerRef}
                style={{ 
                  minHeight: '400px', 
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <p className="text-muted">Video will appear here when connected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Room Info */}
      {roomInfo && (
        <div className="row mb-5">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Room Information</h3>
              </div>
              <div className="card-body">
                <pre className="bg-light p-3 rounded">{JSON.stringify(roomInfo, null, 2)}</pre>
                
                {roomInfo.debug_url && (
                  <div className="mt-3">
                    <h5>Test Links:</h5>
                    <ul>
                      <li>
                        <a href={roomInfo.debug_url} target="_blank" rel="noopener noreferrer">
                          Open Debug Page
                        </a>
                      </li>
                      {roomInfo.token && (
                        <li>
                          <a 
                            href={`/estimating-portal/video-session-minimal?sw_token=${encodeURIComponent(roomInfo.token)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Open Minimal Video Page (Estimating Portal)
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Logs */}
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Debug Logs</h3>
            </div>
            <div className="card-body">
              <div 
                className="bg-dark text-light p-3 rounded"
                style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}
              >
                {logs.length === 0 ? (
                  <div className="text-muted">No logs yet. Click "Run Full Test" to begin.</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="alert alert-warning mt-5">
        <h5>Quick Debugging Tips:</h5>
        <ul className="mb-0">
          <li>Check browser console (F12) for additional errors</li>
          <li>Ensure you're on HTTPS (required for WebRTC)</li>
          <li>Try Chrome/Edge if using Safari (better WebRTC support)</li>
          <li>Check Supabase Edge Function logs for server-side errors</li>
          <li>Verify SignalWire credentials in environment variables</li>
          <li>If getting CORS errors, check Edge Function headers</li>
          <li>Room names must be unique - they include timestamps</li>
        </ul>
      </div>
    </div>
  )
}

export default SimpleVideoTest