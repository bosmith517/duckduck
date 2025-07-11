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

const WebRTCSoftphoneDialer: React.FC<SoftphoneDialerProps> = ({ isVisible, onClose }) => {
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

        // Check for user profile first, create if needed
        let { data: userProfile } = await supabase
          .from('user_profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()
        
        if (!userProfile?.tenant_id) {
          console.log('No user profile found, checking for tenant associations...')
          
          const { data: userTenants } = await supabase
            .from('tenants')
            .select('id')
            .eq('is_active', true)
            .limit(1)
            .single()
          
          if (userTenants?.id) {
            const { data: newProfile, error: profileError } = await supabase
              .from('user_profiles')
              .insert([{
                id: user.id,
                tenant_id: userTenants.id,
                email: user.email,
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
                role: 'admin',
                is_active: true
              }])
              .select('tenant_id')
              .single()
            
            if (profileError) {
              throw new Error('Failed to create user profile. Please contact support.')
            }
            
            userProfile = newProfile
            console.log('Created missing user profile:', userProfile)
          } else {
            throw new Error('User account setup incomplete. Please complete your company onboarding to use the phone system.')
          }
        }

        // Get WebRTC credentials from Edge Function (tokens are session-based)
        console.log('Getting WebRTC credentials from Edge Function...')
        
        const { data: credentials, error } = await supabase.functions.invoke('generate-signalwire-voice-token', {
          body: { 
            tenantId: userProfile.tenant_id,
            userId: user.id,
            email: user.email
          }
        })
        
        if (error || !credentials) {
          console.error('WebRTC credentials error:', error)
          if (error?.message?.includes('User profile not found')) {
            throw new Error('Account setup incomplete. Please complete your company onboarding to use the phone system.')
          }
          throw new Error('Failed to get WebRTC credentials')
        }

        console.log('WebRTC credentials received:', credentials)

        // Validate that we have all required credentials
        if (!credentials.sip?.username || !credentials.sip?.password || !credentials.sip?.domain) {
          console.error('Missing required SIP credentials:', credentials)
          throw new Error('Incomplete SIP credentials received from server')
        }

        if (!credentials.websocket?.server) {
          console.error('Missing WebSocket server URL:', credentials)
          throw new Error('WebSocket server URL not provided')
        }

        // Create audio element for remote audio
        if (!audioRef.current) {
          audioRef.current = new Audio()
          audioRef.current.autoplay = true
          document.body.appendChild(audioRef.current)
        }

        // Use the exact credentials from the server
        const sipUsername = credentials.sip.username
        const sipDomain = credentials.sip.domain
        const sipPassword = credentials.sip.password
        const wsServer = credentials.websocket.server

        console.log('SIP Configuration:', { sipUsername, sipDomain, wsServer })

        // Validate WebSocket URL format
        if (!wsServer.startsWith('wss://')) {
          throw new Error(`Invalid WebSocket URL format: ${wsServer}`)
        }

        const uri = new URI('sip', sipUsername, sipDomain)
        const transportOptions = {
          server: wsServer,
          traceSip: true,
          connectionTimeout: 10
        }

        const userAgentOptions = {
          authorizationUsername: sipUsername,
          authorizationPassword: sipPassword,
          authorizationHa1: '', // Leave empty to use password
          transportOptions,
          uri,
          displayName: user.email || 'User',
          logBuiltinEnabled: true,
          logLevel: 'debug',
          sessionDescriptionHandlerFactoryOptions: {
            constraints: {
              audio: true,
              video: false
            },
            peerConnectionConfiguration: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
              ]
            }
          },
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

        // Create UserAgent
        const userAgent = new UserAgent(userAgentOptions)
        userAgentRef.current = userAgent

        // Add a small delay to ensure everything is ready
        await new Promise(resolve => setTimeout(resolve, 500))

        console.log('Starting UserAgent...')
        await userAgent.start()
        
        // Wait for transport to be connected
        let attempts = 0
        const maxAttempts = 10
        while (attempts < maxAttempts) {
          if (userAgent.transport && userAgent.transport.state === 'Connected') {
            console.log('Transport connected successfully')
            break
          }
          console.log(`Waiting for transport connection... (attempt ${attempts + 1}/${maxAttempts})`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          attempts++
        }

        if (!userAgent.transport || userAgent.transport.state !== 'Connected') {
          throw new Error('Failed to establish WebSocket connection to SignalWire')
        }

        // Create and start Registerer
        console.log('Creating SIP registerer...')
        const registerer = new Registerer(userAgent)
        registererRef.current = registerer

        console.log('Registering with SIP server...')
        await registerer.register()
        console.log('SIP registration successful!')

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
        
        // Provide specific error messages based on the error type
        if (error instanceof Error) {
          if (error.message.includes('SignalWire credentials not configured')) {
            showToast.error('VoIP system not configured. Please contact your administrator.')
          } else if (error.message.includes('User profile not found') || error.message.includes('Account setup incomplete')) {
            showToast.error('Account setup incomplete. Please complete your company onboarding to use the phone system.')
          } else if (error.message.includes('SIP configuration not found') || error.message.includes('complete your company onboarding')) {
            showToast.error('Phone system not configured. Setting up now...')
            // Try to auto-provision SIP configuration
            setTimeout(async () => {
              try {
                const { data, error } = await supabase.functions.invoke('provision-sip-user')
                if (data?.success) {
                  showToast.success('Phone system configured! Please try again.')
                } else {
                  showToast.error('Phone setup requires manual configuration. Please contact support.')
                }
              } catch (err) {
                showToast.error('Phone setup requires manual configuration. Please contact support.')
              }
            }, 1000)
          } else if (error.message.includes('SIP endpoint creation failed')) {
            showToast.error('Phone service provisioning in progress. This may take a few minutes.')
          } else if (error.message.includes('Failed to get WebRTC credentials')) {
            showToast.error('Unable to connect to phone service. Please try again in a few minutes.')
          } else {
            showToast.error(`Phone connection failed: ${error.message}`)
          }
        } else {
          showToast.error('Failed to connect to VoIP system')
        }
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

    // TODO: Add UI for accepting/rejecting calls
    // For now, show notification that there's an incoming call
    showToast.info(`Incoming call from ${session.remoteIdentity?.uri?.user || 'Unknown'}. Auto-accepting...`)
    
    // Auto-accept incoming calls (you can modify this later to show accept/reject buttons)
    setTimeout(() => {
      if ('accept' in session && typeof session.accept === 'function') {
        (session as any).accept()
      }
    }, 1000)
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

      // Create target URI with proper phone number formatting
      const uriString = userAgentRef.current.configuration.uri.toString()
      const domain = uriString.split('@')[1]
      
      // Clean and format phone number for SIP
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '')
      const sipNumber = cleanNumber.startsWith('+') ? cleanNumber.substring(1) : cleanNumber
      
      const target = new URI('sip', sipNumber, domain)
      
      // Options for the call
      // Check for audio permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
      } catch (mediaError) {
        console.error('Failed to get audio permissions:', mediaError)
        showToast.error('Microphone access is required to make calls. Please grant permissions and try again.')
        throw new Error('Microphone access denied')
      }

      const inviterOptions: InviterOptions = {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false
          },
          peerConnectionConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
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

      // Also log the call in database using tenant's configured phone number
      supabase.functions.invoke('start-outbound-call', {
        body: {
          to: phoneNumber,
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
        .softphone-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 1rem !important;
        }
        .softphone-title {
          font-size: 1.125rem !important;
          font-weight: 600 !important;
          margin: 0 !important;
          color: #1F2937 !important;
        }
        .status-indicator {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
        }
        .status-text {
          font-size: 0.75rem !important;
          color: #6B7280 !important;
        }
        .status-dot {
          width: 0.5rem !important;
          height: 0.5rem !important;
          border-radius: 50% !important;
        }
        .status-dot.pulse {
          animation: pulse 2s infinite !important;
        }
        .close-btn {
          background: none !important;
          border: none !important;
          font-size: 1.25rem !important;
          color: #6B7280 !important;
          cursor: pointer !important;
          padding: 0.25rem !important;
          width: 1.5rem !important;
          height: 1.5rem !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .close-btn:hover {
          color: #374151 !important;
        }
        .connection-status {
          padding: 0.75rem !important;
          border-radius: 0.5rem !important;
          margin-bottom: 1rem !important;
          text-align: center !important;
          font-size: 0.875rem !important;
        }
        .connection-status.connecting {
          background-color: #FEF3C7 !important;
          color: #92400E !important;
        }
        .connection-status.error {
          background-color: #FEE2E2 !important;
          color: #991B1B !important;
        }
        .connection-status.disconnected {
          background-color: #E5E7EB !important;
          color: #4B5563 !important;
        }
        .call-display {
          text-align: center !important;
          margin-bottom: 1.5rem !important;
          padding: 1rem !important;
          border-radius: 0.5rem !important;
          background-color: #F9FAFB !important;
        }
        .callee-name {
          font-size: 1rem !important;
          font-weight: 600 !important;
          margin: 0 0 0.25rem 0 !important;
          color: #1F2937 !important;
        }
        .callee-number {
          font-size: 0.875rem !important;
          margin: 0 0 0.5rem 0 !important;
          color: #6B7280 !important;
        }
        .call-timer {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          margin: 0 !important;
          color: #059669 !important;
        }
        .keypad {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 0.5rem !important;
          margin-bottom: 1rem !important;
        }
        .keypad-btn {
          aspect-ratio: 1 !important;
          border: 1px solid #D1D5DB !important;
          border-radius: 0.5rem !important;
          background: white !important;
          font-size: 1.125rem !important;
          font-weight: 600 !important;
          color: #374151 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }
        .keypad-btn:hover:not(:disabled) {
          background-color: #F3F4F6 !important;
          border-color: #9CA3AF !important;
        }
        .keypad-btn:active:not(:disabled) {
          transform: scale(0.95) !important;
          background-color: #E5E7EB !important;
        }
        .keypad-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        .action-buttons {
          display: flex !important;
          justify-content: space-around !important;
          align-items: center !important;
          gap: 0.5rem !important;
        }
        .control-btn {
          width: 3rem !important;
          height: 3rem !important;
          border-radius: 50% !important;
          border: none !important;
          font-size: 1.25rem !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .mute-btn {
          background-color: #F3F4F6 !important;
          color: #374151 !important;
        }
        .mute-btn:hover:not(:disabled) {
          background-color: #E5E7EB !important;
        }
        .hangup-btn {
          background-color: #EF4444 !important;
          color: white !important;
        }
        .hangup-btn:hover:not(:disabled) {
          background-color: #DC2626 !important;
        }
        .call-btn {
          background-color: #10B981 !important;
          color: white !important;
        }
        .call-btn:hover:not(:disabled) {
          background-color: #059669 !important;
        }
        .clear-btn {
          background-color: #F3F4F6 !important;
          color: #374151 !important;
        }
        .clear-btn:hover:not(:disabled) {
          background-color: #E5E7EB !important;
        }
        .reconnect-btn {
          background-color: #3B82F6 !important;
          color: white !important;
        }
        .reconnect-btn:hover:not(:disabled) {
          background-color: #2563EB !important;
        }
        .control-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
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
