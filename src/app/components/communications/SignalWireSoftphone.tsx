import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import { useSoftphoneContext } from '../../contexts/SoftphoneContext'
import SignalWire from '@signalwire/js'
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

export const SignalWireSoftphone: React.FC<SoftphoneDialerProps> = ({ isVisible, onClose }) => {
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

  // Initialize SignalWire client when visible
  useEffect(() => {
    if (isVisible && connectionState === 'disconnected') {
      initializeSignalWire()
    }
    
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
    }
  }, [isVisible])

  // Watch for external call requests
  useEffect(() => {
    if (contextCallInfo && isVisible && connectionState === 'connected') {
      setDialedNumber(contextCallInfo.number)
      // Auto-dial if we have a number
      if (contextCallInfo.number) {
        makeCall()
      }
    }
  }, [contextCallInfo, isVisible, connectionState])

  const initializeSignalWire = async () => {
    try {
      setConnectionState('connecting')
      showToast.loading('Connecting to phone system...')

      // Get user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      setCurrentUser(user)

      // Get SignalWire credentials from edge function
      const { data: credentials, error } = await supabase.functions.invoke('generate-signalwire-voice-token', {})
      
      if (error || !credentials) {
        throw new Error('Failed to get phone credentials')
      }

      console.log('SignalWire credentials received:', credentials)

      // Initialize SignalWire client with proper configuration
      const deviceConfig = {
        project: credentials.project,
        token: credentials.token
      }

      console.log('Initializing SignalWire Device with:', deviceConfig)
      
      const client = new (SignalWire as any).Device(deviceConfig)

      clientRef.current = client

      // Set up event handlers
      client.on('call.created', (call: any) => {
        console.log('Call created:', call)
        currentCallRef.current = call
        setupCallHandlers(call)
      })

      client.on('call.received', (call: any) => {
        console.log('Incoming call:', call)
        handleIncomingCall(call)
      })

      // Connect the client
      await client.connect()
      
      setConnectionState('connected')
      showToast.dismiss()
      showToast.success('Phone connected!')

    } catch (error: any) {
      console.error('SignalWire initialization error:', error)
      setConnectionState('error')
      showToast.dismiss()
      showToast.error(error.message || 'Failed to connect phone system')
    }
  }

  const setupCallHandlers = (call: any) => {
    call.on('state', (state: string) => {
      console.log('Call state changed:', state)
      
      switch (state) {
        case 'new':
          setCallState('connecting')
          break
        case 'trying':
        case 'requesting':
          setCallState('dialing')
          break
        case 'active':
          setCallState('active')
          showToast.success('Call connected!')
          break
        case 'ending':
        case 'ended':
          setCallState('idle')
          currentCallRef.current = null
          showToast.info('Call ended')
          break
      }
    })

    call.on('error', (error: any) => {
      console.error('Call error:', error)
      showToast.error('Call failed: ' + error.message)
      setCallState('idle')
    })
  }

  const handleIncomingCall = async (call: any) => {
    const answer = window.confirm(`Incoming call from ${call.from}. Answer?`)
    
    if (answer) {
      await call.answer()
      currentCallRef.current = call
      setupCallHandlers(call)
      setCallInfo({
        name: 'Incoming Call',
        number: call.from
      })
      setCallState('active')
    } else {
      await call.reject()
    }
  }

  const makeCall = async () => {
    if (!clientRef.current || !dialedNumber) {
      showToast.error('Please enter a number to dial')
      return
    }

    try {
      setCallState('connecting')
      
      // Clean up the number
      const cleanNumber = dialedNumber.replace(/[^\d+]/g, '')
      
      // Make the call
      const call = await clientRef.current.makeCall({
        to: cleanNumber,
        nodeId: undefined
      })

      if (call) {
        currentCallRef.current = call
        setupCallHandlers(call)
        
        setCallInfo({
          name: contextCallInfo?.name || 'Unknown',
          number: cleanNumber,
          contactId: contextCallInfo?.contactId
        })
      }

    } catch (error: any) {
      console.error('Call error:', error)
      showToast.error(error.message || 'Failed to make call')
      setCallState('idle')
    }
  }

  const endCall = async () => {
    if (currentCallRef.current) {
      try {
        await currentCallRef.current.hangup()
      } catch (error) {
        console.error('Error ending call:', error)
      }
    }
    setCallState('idle')
  }

  const toggleMute = () => {
    if (currentCallRef.current && (callState === 'active' || callState === 'muted')) {
      // Toggle mute on the call
      if (callState === 'muted') {
        currentCallRef.current.unmute()
        setCallState('active')
      } else {
        currentCallRef.current.mute()
        setCallState('muted')
      }
    }
  }

  const handleKeyPress = (digit: string) => {
    setDialedNumber(prev => prev + digit)
    
    // Send DTMF if in active call
    if (currentCallRef.current && (callState === 'active' || callState === 'muted')) {
      currentCallRef.current.sendDigit(digit)
    }
  }

  const handleBackspace = () => {
    setDialedNumber(prev => prev.slice(0, -1))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!isVisible) return null

  return (
    <div className="softphone-overlay">
      <div className="softphone-container">
        {/* Header */}
        <div className="softphone-header">
          <h5 className="mb-0">TradeWorks Phone</h5>
          <button onClick={onClose} className="btn btn-sm btn-icon">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Connection Status */}
        <div className={`connection-status connection-${connectionState}`}>
          <i className={`bi bi-circle-fill me-2`}></i>
          {connectionState === 'connected' ? 'Connected' : 
           connectionState === 'connecting' ? 'Connecting...' : 
           connectionState === 'error' ? 'Connection Error' : 'Disconnected'}
        </div>

        {/* Call Info */}
        {(callState !== 'idle') && (
          <div className="call-info">
            <div className="caller-name">{callInfo.name}</div>
            <div className="caller-number">{callInfo.number}</div>
            <div className="call-timer">{formatTime(timer)}</div>
            <div className={`call-status status-${callState}`}>
              {callState === 'connecting' ? 'Connecting...' :
               callState === 'dialing' ? 'Dialing...' :
               callState === 'active' ? 'In Call' :
               callState === 'muted' ? 'Muted' : ''}
            </div>
          </div>
        )}

        {/* Number Display */}
        {callState === 'idle' && (
          <div className="number-display">
            <input 
              type="text"
              value={dialedNumber}
              onChange={(e) => setDialedNumber(e.target.value)}
              placeholder="Enter number..."
              className="form-control form-control-lg text-center"
              disabled={connectionState !== 'connected'}
            />
          </div>
        )}

        {/* Keypad */}
        {callState === 'idle' && (
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
              <button 
                key={digit}
                onClick={() => handleKeyPress(digit)}
                className="keypad-btn"
                disabled={connectionState !== 'connected'}
              >
                {digit}
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          {callState === 'idle' ? (
            <>
              <button 
                onClick={makeCall}
                className="btn btn-success btn-lg call-btn"
                disabled={!dialedNumber || connectionState !== 'connected'}
              >
                <i className="bi bi-telephone-fill"></i>
                Call
              </button>
              {dialedNumber && (
                <button 
                  onClick={handleBackspace}
                  className="btn btn-secondary btn-lg ms-2"
                >
                  <i className="bi bi-backspace"></i>
                </button>
              )}
            </>
          ) : (
            <>
              <button 
                onClick={toggleMute}
                className={`btn btn-lg ${callState === 'muted' ? 'btn-warning' : 'btn-secondary'}`}
              >
                <i className={`bi ${callState === 'muted' ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`}></i>
              </button>
              <button 
                onClick={endCall}
                className="btn btn-danger btn-lg ms-2 end-call-btn"
              >
                <i className="bi bi-telephone-x-fill"></i>
                End
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .softphone-overlay {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .softphone-container {
          background: white;
          border-radius: 12px;
          width: 360px;
          max-width: 90vw;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .softphone-header {
          background: var(--bs-primary);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 12px 12px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .connection-status {
          padding: 0.5rem 1.5rem;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
        }

        .connection-connected { color: var(--bs-success); }
        .connection-connecting { color: var(--bs-warning); }
        .connection-error { color: var(--bs-danger); }
        .connection-disconnected { color: var(--bs-secondary); }

        .call-info {
          padding: 1.5rem;
          text-align: center;
          border-bottom: 1px solid var(--bs-border-color);
        }

        .caller-name {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .caller-number {
          color: var(--bs-secondary);
          margin-bottom: 0.5rem;
        }

        .call-timer {
          font-size: 2rem;
          font-weight: 300;
          font-family: monospace;
        }

        .call-status {
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .number-display {
          padding: 1.5rem;
        }

        .keypad {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          padding: 0 1.5rem;
        }

        .keypad-btn {
          background: var(--bs-light);
          border: none;
          border-radius: 8px;
          padding: 1rem;
          font-size: 1.5rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .keypad-btn:hover:not(:disabled) {
          background: var(--bs-primary);
          color: white;
        }

        .keypad-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-buttons {
          padding: 1.5rem;
          display: flex;
          justify-content: center;
        }

        .call-btn, .end-call-btn {
          min-width: 120px;
        }
      `}</style>
    </div>
  )
}
