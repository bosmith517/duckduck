// src/components/SoftphoneDialer.tsx

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient' // Make sure this path is correct
import { showToast } from '../../utils/toast'      // Make sure this path is correct
import { useSoftphoneContext } from '../../contexts/SoftphoneContext' // Make sure this path is correct
import * as SignalWire from '@signalwire/js'

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

export const SoftphoneDialer: React.FC<SoftphoneDialerProps> = ({ isVisible, onClose }) => {
  const [callState, setCallState] = useState<CallState>('idle')
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [callInfo, setCallInfo] = useState<CallInfo>({ name: '-', number: '-' })
  const [timer, setTimer] = useState(0)
  const [dialedNumber, setDialedNumber] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { callInfo: contextCallInfo } = useSoftphoneContext()
  
  const clientRef = useRef<any>(null)
  const currentCallRef = useRef<any>(null)
  const webrtcClientRef = useRef<any>(null)

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

  // Effect to initialize or disconnect the client
  useEffect(() => {
    const checkUserAndInitialize = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        if (isVisible && user && connectionState === 'disconnected') {
            initializeRelayConnection(user);
        }
    }

    if(isVisible) {
        checkUserAndInitialize();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    }
  }, [isVisible])

  // Effect to auto-start a call from context
  useEffect(() => {
    if (contextCallInfo && isVisible && callState === 'idle' && connectionState === 'connected') {
      initiateCall(contextCallInfo.name, contextCallInfo.number, contextCallInfo.contactId)
    }
  }, [contextCallInfo, isVisible, callState, connectionState])


  const initializeRelayConnection = async (user: User) => {
    try {
      setConnectionState('connecting')
      showToast.loading('Connecting to phone system...')
      
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      if (!userProfile?.tenant_id) throw new Error('User tenant not found')

      // First, try to get phone numbers from local database
      let { data: phoneNumbers } = await supabase
        .from('signalwire_phone_numbers')
        .select('number')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .limit(1)
        .single()

      // If no phone numbers found locally, sync from SignalWire
      if (!phoneNumbers?.number) {
        console.log('No phone numbers found locally, syncing from SignalWire...')
        
        try {
          // Call the existing list-signalwire-phone-numbers function to sync
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('list-signalwire-phone-numbers', {
            body: { tenant_id: userProfile.tenant_id }
          })

          if (syncError) {
            console.error('Error syncing phone numbers:', syncError)
            throw new Error('Failed to sync phone numbers from SignalWire')
          }

          if (syncResult?.success && syncResult?.phoneNumbers?.length > 0) {
            // Try to get phone numbers again after sync
            const { data: syncedNumbers } = await supabase
              .from('signalwire_phone_numbers')
              .select('number')
              .eq('tenant_id', userProfile.tenant_id)
              .eq('is_active', true)
              .limit(1)
              .single()

            phoneNumbers = syncedNumbers
          }
        } catch (syncError) {
          console.error('Error during phone number sync:', syncError)
        }
      }

      if (!phoneNumbers?.number) {
        throw new Error('No active phone numbers found. Please configure a phone number in SignalWire.')
      }

      // Get SignalWire VoIP credentials
      const { data: voiceConfig, error: voiceError } = await supabase.functions.invoke('generate-signalwire-voice-token', {})

      if (voiceError || !voiceConfig?.project) {
        console.error('SignalWire config error:', voiceError)
        throw new Error('Failed to get SignalWire configuration')
      }

      console.log('SignalWire VoIP config:', voiceConfig)

      // For now, skip WebRTC initialization until we have proper SDK setup
      // Just use server-side calling which is working
      console.log('Using server-side calling (WebRTC audio coming soon)')
      setConnectionState('connected')
      showToast.dismiss()
      showToast.success('Phone system connected!')
      webrtcClientRef.current = null

      // Store user info for making calls
      clientRef.current = {
        tenantId: userProfile.tenant_id,
        userId: user.id,
        fromNumber: phoneNumbers.number
      }

      // Set up Supabase realtime subscription for call updates
      const channel = supabase.channel('calls-channel')
      
      channel
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'calls',
            filter: `tenant_id=eq.${userProfile.tenant_id}`
          },
          (payload) => {
            console.log('Call update received:', payload)
            handleCallUpdate(payload)
          }
        )
        .subscribe()

      // Store the channel for cleanup
      clientRef.current.channel = channel
      
    } catch (error: any) {
      console.error('Error initializing relay connection:', error)
      setConnectionState('error')
      showToast.dismiss()
      showToast.error(error.message || 'Failed to connect to phone system')
    }
  }

  const handleIncomingCall = (call: any) => {
    console.log('Incoming WebRTC call:', call)
    setCallInfo({ 
      name: 'Incoming Call', 
      number: call.from || 'Unknown' 
    })
    setCallState('dialing')
    currentCallRef.current = call
    setupCallEventListeners(call)
    showToast.info('Incoming call...')
  }

  const handleCallUpdate = (payload: any) => {
    const callData = payload.new || payload.old
    
    if (!callData) return

    console.log('Call status update from SignalWire:', callData.status, callData)

    // Update UI based on real call status from SignalWire
    switch (callData.status) {
      case 'dialing':
      case 'ringing':
        if (callData.direction === 'inbound') {
          setCallInfo({ 
            name: 'Incoming Call', 
            number: callData.from_number,
            contactId: callData.contact_id 
          })
          setCallState('dialing')
          currentCallRef.current = { 
            callSid: callData.call_sid,
            callRecordId: callData.id 
          }
        } else {
          // For outbound calls, keep current dialing state
          setCallState('dialing')
        }
        break
      case 'active':
        setCallState('active')
        showToast.dismiss()
        showToast.success('Call connected!')
        break
      case 'completed':
      case 'failed':
      case 'cancelled':
        setCallState('idle')
        setCallInfo({ name: '-', number: '-' })
        setDialedNumber('')
        currentCallRef.current = null
        showToast.dismiss()
        showToast.info('Call ended')
        break
    }
  }

  const setupCallEventListeners = (call: any) => {
    call.on('call.state', (params: any) => {
        console.log('WebRTC call state changed:', params);
        switch (params.call_state) {
            case 'new': 
            case 'trying':
            case 'ringing': 
                setCallState('dialing'); 
                break;
            case 'active': 
                setCallState('active'); 
                showToast.success('Call connected!'); 
                break;
            case 'hangup':
            case 'ended':
            case 'destroy':
                setCallState('idle');
                setCallInfo({ name: '-', number: '-' });
                setDialedNumber('');
                currentCallRef.current = null;
                showToast.info('Call ended');
                break;
        }
    });

    // Handle call events
    call.on('call.ended', () => {
        console.log('WebRTC call ended');
        setCallState('idle');
        setCallInfo({ name: '-', number: '-' });
        setDialedNumber('');
        currentCallRef.current = null;
        showToast.info('Call ended');
    });

    call.on('call.connected', () => {
        console.log('WebRTC call connected');
        setCallState('active');
        showToast.success('Call connected!');
    });
  }

  const initiateCall = async (name: string, phoneNumber: string, contactId?: string) => {
    if (connectionState !== 'connected') {
      showToast.error('Not connected to phone system')
      return
    }
    
    try {
      setCallState('dialing')
      setCallInfo({ name, number: phoneNumber, contactId })
      
      console.log('Initiating call to:', phoneNumber, 'from:', clientRef.current?.fromNumber)
      
      // If we have a WebRTC client, try VoIP calling
      if (webrtcClientRef.current) {
        console.log('Making VoIP call with WebRTC...')
        
        try {
          const call = await webrtcClientRef.current.call({
            to: phoneNumber,
            from: clientRef.current.fromNumber
          })

          // Store call reference and set up event listeners
          currentCallRef.current = call
          setupCallEventListeners(call)
          
          showToast.loading(`VoIP calling ${name}...`)
          console.log('VoIP call initiated:', call)
          
        } catch (voipError) {
          console.error('VoIP call failed, falling back to server-side:', voipError)
          // Fall through to server-side calling
        }
      }
      
      // Always log the call in database and make server-side call for reliability
      const { data: callResult, error: callError } = await supabase.functions.invoke('start-outbound-call', {
        body: {
          to: phoneNumber,
          from: clientRef.current.fromNumber,
          tenantId: clientRef.current.tenantId,
          userId: clientRef.current.userId,
          contactId
        }
      })

      if (callError) {
        console.error('Failed to initiate server-side call:', callError)
        showToast.error(callError.message || 'Failed to initiate call')
        setCallState('idle')
        setCallInfo({ name: '-', number: '-' })
        currentCallRef.current = null
        return
      }

      // Store the server-side call information
      if (!currentCallRef.current) {
        currentCallRef.current = {
          callSid: callResult.call_sid,
          callRecordId: callResult.call_record_id
        }
      }

      showToast.loading(`Calling ${name}...`)
      console.log('Call initiated successfully:', callResult)
      
    } catch (error: any) {
      console.error('Error initiating call:', error)
      showToast.error(error.message || 'Failed to initiate call')
      setCallState('idle')
      setCallInfo({ name: '-', number: '-' })
      currentCallRef.current = null
    }
  }

  const handleHangup = async () => {
    try {
      if (currentCallRef.current?.callSid) {
        // Try to hangup via SignalWire REST API
        const { error } = await supabase.functions.invoke('handle-call-control', {
          body: {
            action: 'hangup',
            callSid: currentCallRef.current.callSid
          }
        })
        
        if (error) {
          console.warn('Failed to hangup via API:', error)
        }
      }
      
      // Always update UI immediately
      setCallState('idle')
      setCallInfo({ name: '-', number: '-' })
      setDialedNumber('')
      currentCallRef.current = null
      showToast.info('Call ended')
      
    } catch (error: any) {
      console.error('Error ending call:', error)
      showToast.error(error.message || 'Failed to end call')
      
      // Fallback: update UI manually
      setCallState('idle')
      setCallInfo({ name: '-', number: '-' })
      setDialedNumber('')
      currentCallRef.current = null
    }
  }
  
  const handleMuteToggle = async () => {
    if (!currentCallRef.current) return
    
    try {
      // If we have a WebRTC call, use its mute functions
      if (currentCallRef.current.muteAudio && currentCallRef.current.unmuteAudio) {
        if (callState === 'active') {
          await currentCallRef.current.muteAudio()
          setCallState('muted')
          showToast.info('Call muted')
        } else if (callState === 'muted') {
          await currentCallRef.current.unmuteAudio()
          setCallState('active')
          showToast.info('Call unmuted')
        }
      } else {
        // For server-side calls, we can't mute the browser audio
        showToast.info('Mute/unmute not available for server-side calls')
      }
    } catch (error: any) {
      console.error('Mute/unmute failed:', error)
      showToast.error('Mute/unmute failed')
    }
  }

  const handleKeypadPress = (key: string) => {
    if (callState === 'idle') {
      setDialedNumber(prev => prev + key)
    } else if (currentCallRef.current?.callSid && (callState === 'active' || callState === 'muted')) {
      // Send DTMF via Supabase Edge Function
      sendDTMF(key)
    }
  }

  // Format phone number to E.164 format
  const formatPhoneNumber = (number: string): string => {
    // Remove all non-digit characters
    const digits = number.replace(/\D/g, '')
    
    // If it starts with 1 and has 11 digits, assume it's US/Canada
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    // If it has 10 digits, assume US/Canada and add +1
    if (digits.length === 10) {
      return `+1${digits}`
    }
    // If it already starts with +, return as is
    if (number.startsWith('+')) {
      return number
    }
    // For other cases, assume US/Canada and add +1
    return `+1${digits}`
  }

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard input when softphone is visible and we're in idle state
      if (!isVisible) return

      const key = event.key
      
      // Handle number keys
      if (/^[0-9*#]$/.test(key)) {
        event.preventDefault()
        handleKeypadPress(key)
      }
      // Handle Enter key to make call
      else if (key === 'Enter' && callState === 'idle' && dialedNumber && connectionState === 'connected') {
        event.preventDefault()
        handleCall()
      }
      // Handle Backspace to clear last digit
      else if (key === 'Backspace' && callState === 'idle') {
        event.preventDefault()
        setDialedNumber(prev => prev.slice(0, -1))
      }
      // Handle Escape to clear all
      else if (key === 'Escape' && callState === 'idle') {
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

  const sendDTMF = async (digits: string) => {
    try {
      if (currentCallRef.current && (callState === 'active' || callState === 'muted')) {
        // If we have a WebRTC call, use its sendDigits function
        if (currentCallRef.current.sendDigits) {
          await currentCallRef.current.sendDigits(digits)
          showToast.info(`Sent DTMF: ${digits}`)
        } else if (currentCallRef.current.callSid) {
          // For server-side calls, use the SignalWire API
          const { error } = await supabase.functions.invoke('send-dtmf', {
            body: {
              callSid: currentCallRef.current.callSid,
              digits: digits
            }
          })
          
          if (error) {
            throw new Error(error.message)
          }
          
          showToast.info(`Sent DTMF: ${digits}`)
        }
      }
    } catch (error: any) {
      console.error('Failed to send DTMF:', error)
      showToast.error('Failed to send DTMF')
    }
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

  const handleClear = () => {
    if (callState === 'idle') setDialedNumber('')
  }

  const handleReconnect = () => {
    if ((connectionState === 'error' || connectionState === 'disconnected') && currentUser) {
      initializeRelayConnection(currentUser)
    }
  }

  const statusInfo = getStatusInfo()

  if (!isVisible) return null;

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
        #tradeworks-softphone .softphone-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 1rem !important;
        }
        #tradeworks-softphone .softphone-title {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: #1F2937 !important;
          margin: 0 !important;
        }
        #tradeworks-softphone .status-indicator {
          display: flex !important;
          align-items: center !important;
          gap: 0.5rem !important;
        }
        #tradeworks-softphone .status-text {
          font-size: 0.875rem !important;
          font-weight: 500 !important;
          color: #6B7280 !important;
        }
        #tradeworks-softphone .status-dot {
          width: 0.75rem !important;
          height: 0.75rem !important;
          border-radius: 50% !important;
          transition: all 0.3s ease !important;
        }
        #tradeworks-softphone .status-dot.pulse {
          animation: softphone-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
        }
        @keyframes softphone-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        #tradeworks-softphone .close-btn {
          background: none !important;
          border: none !important;
          color: #9CA3AF !important;
          cursor: pointer !important;
          padding: 0.25rem !important;
          margin-left: 0.5rem !important;
          font-size: 1.25rem !important;
          transition: color 0.2s ease !important;
        }
        #tradeworks-softphone .close-btn:hover {
          color: #6B7280 !important;
        }
        #tradeworks-softphone .call-display {
          background: #F9FAFB !important;
          border-radius: 0.5rem !important;
          padding: 1rem !important;
          margin-bottom: 1.5rem !important;
          text-align: center !important;
        }
        #tradeworks-softphone .callee-name {
          font-weight: 600 !important;
          color: #374151 !important;
          font-size: 1.125rem !important;
          margin: 0 0 0.25rem 0 !important;
        }
        #tradeworks-softphone .callee-number {
          color: #6B7280 !important;
          margin: 0 0 0.5rem 0 !important;
          font-size: 0.875rem !important;
        }
        #tradeworks-softphone .call-timer {
          font-size: 2rem !important;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace !important;
          letter-spacing: 0.1em !important;
          color: #1F2937 !important;
          margin: 0.5rem 0 0 0 !important;
          font-weight: 400 !important;
        }
        #tradeworks-softphone .keypad {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 1rem !important;
          margin-bottom: 1.5rem !important;
        }
        #tradeworks-softphone .keypad-btn {
          background: #F3F4F6 !important;
          border: none !important;
          color: #1F2937 !important;
          font-weight: 700 !important;
          padding: 1rem !important;
          border-radius: 0.75rem !important;
          font-size: 1.5rem !important;
          transition: all 0.2s ease !important;
          cursor: pointer !important;
          min-height: 3.5rem !important;
        }
        #tradeworks-softphone .keypad-btn:hover:not(:disabled) {
          background: #E5E7EB !important;
        }
        #tradeworks-softphone .keypad-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        #tradeworks-softphone .action-buttons {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 1rem !important;
        }
        #tradeworks-softphone .control-btn {
          border: none !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
          cursor: pointer !important;
          font-size: 1.75rem !important;
        }
        #tradeworks-softphone .mute-btn {
          background: #E5E7EB !important;
          color: #6B7280 !important;
          width: 4rem !important;
          height: 4rem !important;
        }
        #tradeworks-softphone .mute-btn:hover:not(:disabled) {
          background: #D1D5DB !important;
        }
        #tradeworks-softphone .mute-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        #tradeworks-softphone .hangup-btn {
          background: #EF4444 !important;
          color: white !important;
          width: 5rem !important;
          height: 5rem !important;
        }
        #tradeworks-softphone .hangup-btn:hover:not(:disabled) {
          background: #DC2626 !important;
        }
        #tradeworks-softphone .hangup-btn:disabled {
          background: #FCA5A5 !important;
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        #tradeworks-softphone .call-btn {
          background: #10B981 !important;
          color: white !important;
          width: 4rem !important;
          height: 4rem !important;
        }
        #tradeworks-softphone .call-btn:hover:not(:disabled) {
          background: #059669 !important;
        }
        #tradeworks-softphone .call-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        #tradeworks-softphone .clear-btn {
          background: #E5E7EB !important;
          color: #6B7280 !important;
          width: 4rem !important;
          height: 4rem !important;
        }
        #tradeworks-softphone .clear-btn:hover:not(:disabled) {
          background: #D1D5DB !important;
        }
        #tradeworks-softphone .clear-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }
        #tradeworks-softphone .reconnect-btn {
          background: #3B82F6 !important;
          color: white !important;
          width: 4rem !important;
          height: 4rem !important;
        }
        #tradeworks-softphone .reconnect-btn:hover:not(:disabled) {
          background: #2563EB !important;
        }
        #tradeworks-softphone .connection-status {
          margin-bottom: 1rem !important;
          padding: 0.75rem !important;
          border-radius: 0.5rem !important;
          text-align: center !important;
          font-size: 0.875rem !important;
        }
        #tradeworks-softphone .connection-status.error {
          background: #FEE2E2 !important;
          color: #DC2626 !important;
        }
        #tradeworks-softphone .connection-status.connecting {
          background: #FEF3C7 !important;
          color: #D97706 !important;
        }
        #tradeworks-softphone .connection-status.connected {
          background: #D1FAE5 !important;
          color: #059669 !important;
        }
      `}</style>
      <div id="tradeworks-softphone">
        <div className="softphone-header">
          <h2 className="softphone-title">Softphone</h2>
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
            {connectionState === 'connecting' && 'Connecting to phone system...'}
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
            <div>Connected as user-{currentUser.id.substring(0,8)}</div>
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

// Export the component as default as well for better compatibility
export default SoftphoneDialer

export const useSoftphone = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null)

  const startCall = (name: string, number: string, contactId?: string) => {
    setCallInfo({ name, number, contactId })
    setIsVisible(true)
  }

  const hideDialer = () => {
    setIsVisible(false)
  }

  const showDialer = () => {
    setIsVisible(true)
  }

  return {
    isVisible,
    callInfo,
    startCall,
    hideDialer,
    showDialer
  }
}
