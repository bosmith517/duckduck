// WebRTC-enabled Softphone Dialer using SIP.js
import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSoftphoneContext } from '../../contexts/SoftphoneContext'
import { 
  UserAgent, 
  Registerer, 
  Inviter, 
  SessionState,
  Session,
  Messager,
  InviterOptions,
  RegistererOptions,
  URI
} from 'sip.js'
import { User } from '@supabase/supabase-js'

interface SoftphoneDialerProps {
  isVisible: boolean
  onClose: () => void
}

type CallState = 'idle' | 'connecting' | 'dialing' | 'active' | 'muted' | 'disconnected'
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface CallInfo {
  name: string
  number: string
  contactId?: string
}

export const WebRTCSoftphoneDialer: React.FC<SoftphoneDialerProps> = ({ isVisible, onClose }) => {
  const [callState, setCallState] = useState<CallState>('idle')
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [callInfo, setCallInfo] = useState<CallInfo>({ name: '-', number: '-' })
  const [timer, setTimer] = useState(0)
  const [dialedNumber, setDialedNumber] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { callInfo: contextCallInfo } = useSoftphoneContext()
  
  const userAgentRef = useRef<UserAgent | null>(null)
  const registererRef = useRef<Registerer | null>(null)
  const currentSessionRef = useRef<Session | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Timer logic
  useEffect(() => {
    if (callState === 'active' || callState === 'muted') {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (callState === 'idle') {
        setTimer(0)
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callState])

  // Initialize WebRTC connection
  useEffect(() => {
    const initializeWebRTC = async () => {
      if (!isVisible) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUser(user)
      
      try {
        setConnectionState('connecting')
        showToast.loading('Connecting to VoIP system...')

        // Get WebRTC credentials
        const { data: credentials, error } = await supabase.functions.invoke('generate-signalwire-voice-token', {})
        
        if (error || !credentials) {
          throw new Error('Failed to get WebRTC credentials')
        }

        console.log('WebRTC credentials received:', credentials)

        // Create audio element for remote audio
        if (!audioRef.current) {
          audioRef.current = new Audio()
          audioRef.current.autoplay = true
          document.body.appendChild(audioRef.current)
        }

        // Configure UserAgent
        const uri = new URI('sip', credentials.sip.username, credentials.sip.domain)
        const transportOptions = {
          server: credentials.sip.wsServers[0]
        }

        const userAgentOptions = {
          authorizationUsername: credentials.sip.username,
          authorizationPassword: credentials.sip.password,
          transportOptions,
          uri,
          displayName: user.email || 'User',
          delegate: {
            onConnect: () => {
              console.log('WebRTC Connected')
              setConnectionState('connected')
              showToast.dismiss()
              showToast.success('VoIP connected! Ready for calls.')
            },
            onDisconnect: (error?: Error) => {
              console.log('WebRTC Disconnected', error)
              setConnectionState('disconnected')
              showToast.error('VoIP disconnected')
            }
          }
        }

        // Create and start UserAgent
        const userAgent = new UserAgent(userAgentOptions)
        userAgentRef.current = userAgent

        await userAgent.start()

        // Create and start Registerer
        const registerer = new Registerer(userAgent)
        registererRef.current = registerer

        await registerer.register()

        // Set up incoming call handler
        userAgent.delegate = {
          ...userAgent.delegate,
          onInvite: (invitation) => {
            console.log('Incoming call:', invitation)
            handleIncomingCall(invitation)
          }
        }

      } catch (error) {
        console.error('WebRTC initialization error:', error)
        setConnectionState('error')
        showToast.dismiss()
        showToast.error('Failed to connect to VoIP system')
      }
    }

    if (isVisible) {
      initializeWebRTC()
    }

    return () => {
      // Cleanup
      if (registererRef.current) {
        registererRef.current.unregister().catch(console.error)
      }
      if (userAgentRef.current) {
        userAgentRef.current.stop().catch(console.error)
      }
      if (audioRef.current && audioRef.current.parentNode) {
        audioRef.current.parentNode.removeChild(audioRef.current)
      }
    }
  }, [isVisible])

  // Handle incoming calls
  const handleIncomingCall = (session: Session) => {
    setCallInfo({
      name: 'Incoming Call',
      number: session.remoteIdentity?.uri?.user || 'Unknown'
    })
    setCallState('dialing')
    currentSessionRef.current = session

    // Set up session event handlers
    setupSessionHandlers(session)

    // Auto-answer for now (you might want to add a UI for accepting/rejecting)
    if ('accept' in session && typeof session.accept === 'function') {
      (session as any).accept()
    }
  }

  // Set up session event handlers
  const setupSessionHandlers = (session: Session) => {
    session.stateChange.addListener((state: SessionState) => {
      console.log('Session state changed:', state)
      
      switch (state) {
        case SessionState.Establishing:
          setCallState('dialing')
          break
        case SessionState.Established:
          setCallState('active')
          showToast.success('Call connected!')
          
          // Handle remote media
          if (session.sessionDescriptionHandler) {
            const sdh = session.sessionDescriptionHandler as any
            const remoteStream = sdh.remoteMediaStream
            if (remoteStream && audioRef.current) {
              audioRef.current.srcObject = remoteStream
            }
          }
          break
        case SessionState.Terminated:
          setCallState('idle')
          setCallInfo({ name: '-', number: '-' })
          currentSessionRef.current = null
          showToast.info('Call ended')
          break
      }
    })
  }

  // Initiate outbound call
  const initiateCall = async (name: string, phoneNumber: string, contactId?: string) => {
    if (!userAgentRef.current || connectionState !== 'connected') {
      showToast.error('Not connected to VoIP system')
      return
    }

    try {
      setCallState('dialing')
      setCallInfo({ name, number: phoneNumber, contactId })

      // Create target URI
      const uriString = userAgentRef.current.configuration.uri.toString()
      const domain = uriString.split('@')[1]
      const target = new URI('sip', phoneNumber, domain)
      
      // Options for the call
      const inviterOptions: InviterOptions = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          }
        }
      }

      // Make the call
      const inviter = new Inviter(userAgentRef.current, target, inviterOptions)
      currentSessionRef.current = inviter

      // Set up session handlers
      setupSessionHandlers(inviter)

      // Send the invite
      await inviter.invite()

      showToast.loading(`Calling ${name}...`)

      // Also log the call in database
      const fromUri = userAgentRef.current.configuration.uri.toString()
      const fromUser = fromUri.split('@')[0].replace('sip:', '')
      supabase.functions.invoke('start-outbound-call', {
        body: {
          to: phoneNumber,
          from: fromUser,
          tenantId: null, // Will use user's tenant
          userId: currentUser?.id,
          contactId
        }
      }).catch(console.error)

    } catch (error) {
      console.error('Failed to initiate call:', error)
      showToast.error('Failed to initiate call')
      setCallState('idle')
      setCallInfo({ name: '-', number: '-' })
      currentSessionRef.current = null
    }
  }

  // Handle hangup
  const handleHangup = async () => {
    if (currentSessionRef.current) {
      try {
        if (currentSessionRef.current.state !== SessionState.Terminated) {
          if ('bye' in currentSessionRef.current) {
            await (currentSessionRef.current as any).bye()
          } else if ('cancel' in currentSessionRef.current) {
            await (currentSessionRef.current as any).cancel()
          } else if ('reject' in currentSessionRef.current) {
            await (currentSessionRef.current as any).reject()
          }
        }
      } catch (error) {
        console.error('Error ending call:', error)
      }
    }
    
    setCallState('idle')
    setCallInfo({ name: '-', number: '-' })
    setDialedNumber('')
    currentSessionRef.current = null
    showToast.info('Call ended')
  }

  // Handle mute/unmute
  const handleMuteToggle = async () => {
    if (!currentSessionRef.current || currentSessionRef.current.state !== SessionState.Established) return

    try {
      const sessionDescriptionHandler = (currentSessionRef.current as any).sessionDescriptionHandler
      if (!sessionDescriptionHandler) return

      const peerConnection = sessionDescriptionHandler.peerConnection
      const localStream = sessionDescriptionHandler.localMediaStream

      if (localStream) {
        const audioTracks = localStream.getAudioTracks()
        if (callState === 'active') {
          audioTracks.forEach((track: MediaStreamTrack) => track.enabled = false)
          setCallState('muted')
          showToast.info('Call muted')
        } else if (callState === 'muted') {
          audioTracks.forEach((track: MediaStreamTrack) => track.enabled = true)
          setCallState('active')
          showToast.info('Call unmuted')
        }
      }
    } catch (error) {
      console.error('Mute/unmute failed:', error)
      showToast.error('Mute/unmute failed')
    }
  }

  // Handle keypad press
  const handleKeypadPress = (key: string) => {
    if (callState === 'idle') {
      setDialedNumber(prev => prev + key)
    } else if (currentSessionRef.current && currentSessionRef.current.state === SessionState.Established) {
      // Send DTMF
      sendDTMF(key)
    }
  }

  // Send DTMF
  const sendDTMF = async (digits: string) => {
    if (!currentSessionRef.current || currentSessionRef.current.state !== SessionState.Established) return

    try {
      const sessionDescriptionHandler = (currentSessionRef.current as any).sessionDescriptionHandler
      if (sessionDescriptionHandler && sessionDescriptionHandler.sendDtmf) {
        sessionDescriptionHandler.sendDtmf(digits)
        showToast.info(`Sent DTMF: ${digits}`)
      }
    } catch (error) {
      console.error('Failed to send DTMF:', error)
      showToast.error('Failed to send DTMF')
    }
  }

  // Format phone number
  const formatPhoneNumber = (number: string): string => {
    const digits = number.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    if (digits.length === 10) {
      return `+1${digits}`
    }
    if (number.startsWith('+')) {
      return number
    }
    return `+1${digits}`
  }

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return

      const key = event.key
      
      if (/^[0-9*#]$/.test(key)) {
        event.preventDefault()
        handleKeypadPress(key)
      } else if (key === 'Enter' && callState === 'idle' && dialedNumber && connectionState === 'connected') {
        event.preventDefault()
        handleCall()
      } else if (key === 'Backspace' && callState === 'idle') {
        event.preventDefault()
        setDialedNumber(prev => prev.slice(0, -1))
      } else if (key === 'Escape' && callState === 'idle') {
        event.preventDefault()
        setDialedNumber('')
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, callState, dialedNumber, connectionState])

  const handleCall = () => {
    if (callState === 'idle' && dialedNumber && connectionState === 'connected') {
      const formattedNumber = formatPhoneNumber(dialedNumber)
      initiateCall('Manual Dial', formattedNumber)
    }
  }

  const handleClear = () => {
    if (callState === 'idle') setDialedNumber('')
  }

  const handleReconnect = () => {
    window.location.reload() // Simple reconnect for now
  }

  const formatTimer = (seconds: number): string => {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0')
    const sec = String(seconds % 60).padStart(2, '0')
    return `${min}:${sec}`
  }

  const getStatusInfo = () => {
    if (connectionState !== 'connected') {
      return { text: 'Connecting...', color: '#FBBF24', pulse: true }
    }
    switch (callState) {
      case 'idle': return { text: 'Ready', color: '#10B981', pulse: false }
      case 'connecting':
      case 'dialing': return { text: 'Dialing...', color: '#FBBF24', pulse: true }
      case 'active': return { text: 'Connected', color: '#10B981', pulse: false }
      case 'muted': return { text: 'Muted', color: '#10B981', pulse: false }
      case 'disconnected': return { text: 'Disconnected', color: '#EF4444', pulse: false }
      default: return { text: 'Ready', color: '#10B981', pulse: false }
    }
  }

  const statusInfo = getStatusInfo()

  if (!isVisible) return null

  // Render the UI (same as original SoftphoneDialer)
  return (
    <>
      <style>{`
        #tradeworks-softphone {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
          transition: all 0.3s ease-in-out !important;
          position: fixed !important;
          bottom: 2rem !important;
          right: 2rem !important;
          z-index: 1000 !important;
          background: white !important;
          border-radius: 1rem !important;
          padding: 1.5rem !important;
          width: 20rem !important;
          max-width: 20rem !important;
          border: 1px solid #E5E7EB !important;
        }
        /* ... rest of the styles from original SoftphoneDialer ... */
      `}</style>
      <div id="tradeworks-softphone">
        <div className="softphone-header">
          <h2 className="softphone-title">VoIP Phone</h2>
          <div className="status-indicator">
            <span className="status-text">{statusInfo.text}</span>
            <div 
              className={`status-dot ${statusInfo.pulse ? 'pulse' : ''}`}
              style={{ backgroundColor: statusInfo.color }}
            />
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>
        </div>

        {connectionState !== 'connected' && (
          <div className={`connection-status ${connectionState}`}>
            {connectionState === 'connecting' && 'Connecting to VoIP system...'}
            {connectionState === 'error' && 'Connection failed'}
            {connectionState === 'disconnected' && 'Not connected'}
          </div>
        )}

        <div className="call-display">
          <p className="callee-name">{callInfo.name}</p>
          <p className="callee-number">
            {callState === 'idle' && dialedNumber ? dialedNumber : callInfo.number}
          </p>
          {callState === 'idle' && dialedNumber && (
            <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.25rem 0' }}>
              Will call: {formatPhoneNumber(dialedNumber)}
            </p>
          )}
          <p className="call-timer">{formatTimer(timer)}</p>
        </div>

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
            <button
              key={key}
              onClick={() => handleKeypadPress(key)}
              className="keypad-btn"
              disabled={callState === 'dialing' || connectionState !== 'connected'}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="action-buttons">
          <button
            onClick={handleMuteToggle}
            disabled={callState !== 'active' && callState !== 'muted'}
            className="control-btn mute-btn"
          >
            {callState === 'muted' ? '🔇' : '🎤'}
          </button>

          <button
            onClick={handleHangup}
            disabled={callState === 'idle' || callState === 'connecting'}
            className="control-btn hangup-btn"
          >
            📞
          </button>

          {connectionState === 'error' || connectionState === 'disconnected' ? (
            <button
              onClick={handleReconnect}
              className="control-btn reconnect-btn"
            >
              🔄
            </button>
          ) : callState === 'idle' ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleCall}
                disabled={!dialedNumber || connectionState !== 'connected'}
                className="control-btn call-btn"
              >
                📞
              </button>
              <button
                onClick={handleClear}
                disabled={!dialedNumber}
                className="control-btn clear-btn"
              >
                🗑️
              </button>
            </div>
          ) : (
            <button
              disabled
              className="control-btn"
              style={{ opacity: 0.5, width: '4rem', height: '4rem' }}
            >
              ...
            </button>
          )}
        </div>

        {connectionState === 'connected' && currentUser && (
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #E5E7EB',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#6B7280'
          }}>
            <div>VoIP Connected • {currentUser.email}</div>
            {callState === 'idle' && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.7rem' }}>
                Keyboard: 0-9, *, # • Enter to call • Backspace to delete • Esc to clear
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default WebRTCSoftphoneDialer
