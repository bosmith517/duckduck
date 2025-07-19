// src/components/WorkingVideoComponent.tsx

import React, { useRef, useState } from 'react'
import { supabase } from '../../../supabaseClient' // Corrected path for components/video location

// Declare SignalWire globally (loaded via CDN)
declare global {
  interface Window {
    SignalWire: any
  }
}

interface WorkingVideoComponentProps {
  roomName?: string
  onRoomJoined?: (roomName: string) => void
  onRoomLeft?: () => void
}

export const WorkingVideoComponent: React.FC<WorkingVideoComponentProps> = ({ 
  roomName: propRoomName,
  onRoomJoined,
  onRoomLeft 
}) => {
  const videoRef = useRef<HTMLDivElement>(null)
  const roomSessionRef = useRef<any>(null)
  const [status, setStatus] = useState('Idle')
  const [joinTime, setJoinTime] = useState(0)
  const [isJoined, setIsJoined] = useState(false)
  const [currentRoomName, setCurrentRoomName] = useState(propRoomName || '')
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (roomSessionRef.current) {
        console.log('Cleaning up video session...')
        try {
          roomSessionRef.current.leave()
          roomSessionRef.current = null
        } catch (e) {
          console.error('Error cleaning up video session:', e)
        }
      }
    }
  }, [])
  
  // Function to load SDK dynamically
  const loadSignalWireSDK = async () => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.SignalWire) {
        console.log('SignalWire SDK already loaded')
        resolve(true)
        return
      }
      
      console.log('Loading SignalWire SDK...')
      const script = document.createElement('script')
      script.src = 'https://cdn.signalwire.com/@signalwire/js'
      script.async = true
      script.onload = async () => {
        console.log('SignalWire SDK loaded successfully')
        // Check if SignalWire is available
        if (window.SignalWire) {
          console.log('SignalWire object confirmed available')
          
          // Try to initialize/pre-warm the connection pool
          if (window.SignalWire.Video) {
            console.log('Video namespace available, attempting to pre-warm connection pool...')
            // This might help initialize the connection pool
            try {
              // Check if there's an init or setup method
              if (window.SignalWire.Video.init) {
                await window.SignalWire.Video.init()
                console.log('SignalWire Video initialized')
              }
            } catch (e) {
              console.log('No init method or initialization not needed')
            }
          }
          
          resolve(true)
        } else {
          reject(new Error('SignalWire object not found after script load'))
        }
      }
      script.onerror = () => {
        console.error('Failed to load SignalWire SDK from CDN')
        reject(new Error('Failed to load SignalWire SDK'))
      }
      document.body.appendChild(script)
    })
  }

  const joinRoom = async () => {
    // Prevent multiple simultaneous connections
    if (isJoined || roomSessionRef.current) {
      console.log('Already connected or connecting...')
      return
    }
    
    try {
      setStatus('1. Getting Token...')
      // Use provided room name or generate one
      const roomName = propRoomName || `works-${Date.now()}`
      setCurrentRoomName(roomName)
      
      // Call the CORRECT backend function with the CORRECT body
      const { data, error } = await supabase.functions.invoke('create-video-token', {
        body: {
          room_name: roomName,
          user_name: 'Test User'
        }
      })

      if (error) throw new Error(error.message)
      
      console.log('Token generation response:', data)
      const { token, iceServers } = data
      
      console.log('ICE servers received from backend:', iceServers)
      console.log('Number of ICE servers:', iceServers?.length || 0)

      setStatus('2. Loading SignalWire SDK...')
      
      // Load SDK if needed
      await loadSignalWireSDK()
      
      setStatus('3. Connecting to SignalWire...')
      
      // Request permissions BEFORE creating RoomSession to avoid device watcher error
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        console.log('✅ Media permissions granted')
      } catch (permError) {
        console.warn('⚠️ Media permissions denied, continuing without pre-granted permissions:', permError)
      }
      
      // Try passing ICE servers to RoomSession
      const roomSessionConfig: any = {
        token,
        rootElement: videoRef.current!
        // Note: speakerDetection removed as it's not in RoomSessionOptions type
      }
      
      // Based on SignalWireVideoRoom.tsx, it seems RoomSession might accept iceServers
      if (iceServers && iceServers.length > 0) {
        roomSessionConfig.iceServers = iceServers
        console.log('Passing ICE servers to RoomSession:', iceServers.length)
      }
      
      const roomSession = new window.SignalWire.Video.RoomSession(roomSessionConfig)
      roomSessionRef.current = roomSession

      roomSession.on('room.joined', () => {
        setStatus('4. Connected! ✅')
        setIsJoined(true)
        onRoomJoined?.(roomName)
      })
      
      roomSession.on('room.left', () => {
        console.log('Left room')
        setIsJoined(false)
        roomSessionRef.current = null
        onRoomLeft?.()
      })
      
      roomSession.on('error', (error: any) => {
        console.error('Room session error:', error)
        setStatus(`Error: ${error.message || 'Connection failed'}`)
      })

      const startTime = performance.now()
      // Use the modern .join() syntax to connect
      await roomSession.join({ audio: true, video: true })
      const endTime = performance.now()
      setJoinTime(Math.round(endTime - startTime))

    } catch (error: any) {
      console.error('Join room error:', error)
      setStatus(`Error: ${error.message}`)
      setIsJoined(false)
      roomSessionRef.current = null
    }
  }
  
  const leaveRoom = async () => {
    if (roomSessionRef.current) {
      try {
        setStatus('Leaving room...')
        await roomSessionRef.current.leave()
        setStatus('Disconnected')
        setIsJoined(false)
        roomSessionRef.current = null
      } catch (error: any) {
        console.error('Leave room error:', error)
        setStatus(`Error leaving: ${error.message}`)
      }
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <h3 className="card-title">Video Room</h3>
        <p>Status: <strong>{status}</strong></p>
        {currentRoomName && (
          <p>Room: <code>{currentRoomName}</code></p>
        )}
        {joinTime > 0 && (
          <div className="alert alert-success">
            Connection took just {joinTime} milliseconds.
          </div>
        )}
        <button 
          className="btn btn-primary me-2" 
          onClick={joinRoom}
          disabled={isJoined}
        >
          {isJoined ? 'Connected' : 'Join Room'}
        </button>
        {isJoined && (
          <button 
            className="btn btn-danger" 
            onClick={leaveRoom}
          >
            Leave Room
          </button>
        )}
        <div ref={videoRef} style={{ width: '100%', height: '400px', backgroundColor: '#000', marginTop: '1rem' }} />
      </div>
    </div>
  )
}