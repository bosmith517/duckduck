import React, { useState, useRef } from 'react'
import * as SignalWire from '@signalwire/js'
import { supabase } from '../../../supabaseClient'

export const SignalWireClientTest: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready')
  const [logs, setLogs] = useState<string[]>([])
  const [roomData, setRoomData] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<any>(null)
  const roomSessionRef = useRef<any>(null)

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'
    setLogs(prev => [...prev, `${timestamp} ${prefix} ${message}`])
    console.log(`[SignalWireClient] ${message}`)
  }

  const createAndJoinRoom = async () => {
    try {
      setIsConnecting(true)
      setStatus('Creating room...')
      setLogs([])

      // Step 1: Create room
      addLog('Creating room via create-simple-video-room')
      const { data: createData, error: createError } = await supabase.functions.invoke('create-simple-video-room')
      
      if (createError) {
        addLog(`Room creation failed: ${createError.message}`, 'error')
        throw createError
      }

      if (!createData?.room?.name || !createData?.token) {
        addLog('Invalid room data received', 'error')
        throw new Error('Invalid room data')
      }

      const roomInfo = {
        name: createData.room.name,
        id: createData.room.id,
        token: createData.token
      }

      setRoomData(roomInfo)
      addLog(`Room created: ${roomInfo.name}`, 'success')
      addLog(`Token length: ${roomInfo.token.length}`, 'info')

      // Step 2: Create SignalWire client (new approach from docs)
      setStatus('Creating SignalWire client...')
      addLog('Creating SignalWire client with token')
      
      const client = await (SignalWire as any).SignalWire({
        token: roomInfo.token,
        logLevel: 'debug',
        debug: {
          logWsTraffic: true
        }
      })

      clientRef.current = client;
      addLog('SignalWire client created', 'success');

      // Step 3: Set up event handlers BEFORE connecting
      (client as any).on('room.started', (roomSession: any) => {
        addLog('🎉 ROOM STARTED EVENT!', 'success')
        roomSessionRef.current = roomSession
        
        // Attach to video container
        if (videoContainerRef.current) {
          roomSession.setVideoElement(videoContainerRef.current)
        }

        // Room session events
        roomSession.on('room.joined', () => {
          addLog('🎉 ROOM JOINED!', 'success')
          setStatus('✅ CONNECTED!')
          setIsConnecting(false)
        })

        roomSession.on('room.updated', (params: any) => {
          addLog(`Room updated: ${JSON.stringify(params)}`, 'info')
        })

        roomSession.on('member.joined', (params: any) => {
          addLog(`Member joined: ${params.member.name}`, 'info')
        })

        roomSession.on('member.left', (params: any) => {
          addLog(`Member left: ${params.member.name}`, 'info')
        })

        roomSession.on('layout.changed', (params: any) => {
          addLog(`Layout changed: ${params.layout}`, 'info')
        })

        roomSession.on('room.left', () => {
          addLog('Room left', 'info')
          setStatus('Disconnected')
          setIsConnecting(false)
        })
      })

      (client as any).on('room.ended', () => {
        addLog('Room ended', 'info')
        setStatus('Room ended')
        setIsConnecting(false)
      })

      // Step 4: Connect the client
      setStatus('Connecting client...')
      addLog('Calling client.connect()')
      
      await (client as any).connect()
      
      addLog('Client connected successfully', 'success')
      
      // Step 5: Start video room with minimal configuration
      setStatus('Starting video room...')
      addLog('Starting video room with minimal config')
      
      const roomSession = await (client as any).video.startRoom({
        audio: true,
        video: false
      })
      
      addLog('Video room started!', 'success')

    } catch (error: any) {
      addLog(`❌ Fatal error: ${error.message}`, 'error')
      addLog(`Error details: ${JSON.stringify(error, null, 2)}`, 'error')
      setStatus(`❌ FAILED: ${error.message}`)
      setIsConnecting(false)
    }
  }

  const leaveRoom = async () => {
    try {
      addLog('Leaving room...')
      
      if (roomSessionRef.current) {
        await roomSessionRef.current.leave()
        roomSessionRef.current = null
      }
      
      if (clientRef.current) {
        await clientRef.current.disconnect()
        clientRef.current = null
      }
      
      setStatus('Disconnected')
      addLog('Left room successfully', 'success')
    } catch (error: any) {
      addLog(`Error leaving room: ${error.message}`, 'error')
    }
  }

  const clearLogs = () => {
    setLogs([])
    setStatus('Ready')
  }

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-12">
          <h1 className="mb-4">🆕 SignalWire Client Test (Official Docs Approach)</h1>
          <p className="lead mb-4">
            This test uses the NEW SignalWire client approach from the official documentation.
            <br/><small className="text-muted">Using SignalWire.SignalWire() instead of Video.RoomSession</small>
          </p>
          
          {/* Status */}
          <div className="alert alert-info mb-4">
            <h4>Status: {status}</h4>
            {roomData && (
              <div className="mt-2">
                <small>Room: <code>{roomData.name}</code></small>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="d-flex gap-3 mb-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={createAndJoinRoom}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Connecting...
                </>
              ) : (
                '🚀 Create & Join Room'
              )}
            </button>

            <button
              className="btn btn-danger"
              onClick={leaveRoom}
              disabled={isConnecting || !clientRef.current}
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

          {/* Video Container */}
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Video Container</h3>
            </div>
            <div className="card-body">
              <div 
                ref={videoContainerRef}
                style={{ 
                  minHeight: '300px', 
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

          {/* Live Logs */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Live Connection Logs</h3>
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
                  <div className="text-muted">Click "Create & Join Room" to start testing</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Documentation Reference */}
          <div className="alert alert-success mt-4">
            <h5>📚 Official Documentation Approach:</h5>
            <ul className="mb-0">
              <li>Uses <code>SignalWire.SignalWire()</code> client factory</li>
              <li>Calls <code>client.connect()</code> before starting room</li>
              <li>Uses <code>client.video.startRoom()</code> instead of RoomSession</li>
              <li>Based on: <a href="https://developer.signalwire.com/sdks/browser-sdk/signalwire-client/client/" target="_blank" rel="noopener noreferrer">SignalWire Client Docs</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignalWireClientTest