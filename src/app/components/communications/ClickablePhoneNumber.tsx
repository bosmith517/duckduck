import React, { useState } from 'react'
import { communicationsService } from '../../services/communicationsService'
import { showToast } from '../../utils/toast'
import { useSoftphoneContext } from '../../contexts/SoftphoneContext'

interface ClickablePhoneNumberProps {
  phoneNumber: string
  contactId?: string
  contactName?: string
  className?: string
  showIcon?: boolean
  disabled?: boolean
}

export const ClickablePhoneNumber: React.FC<ClickablePhoneNumberProps> = ({
  phoneNumber,
  contactId,
  contactName,
  className = '',
  showIcon = true,
  disabled = false
}) => {
  const [calling, setCalling] = useState(false)
  const { startCall } = useSoftphoneContext()

  const handleCall = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (disabled || calling || !phoneNumber) return

    // Show the softphone dialer with the contact information
    startCall(contactName || 'Unknown Contact', phoneNumber, contactId)
  }

  const formatPhoneNumber = (number: string) => {
    return communicationsService.formatPhoneNumber(number)
  }

  if (!phoneNumber) {
    return <span className={className}>-</span>
  }

  return (
    <button
      type='button'
      className={`btn btn-link p-0 text-start ${className} ${disabled ? 'disabled' : ''}`}
      onClick={handleCall}
      disabled={disabled || calling}
      title={`Call ${contactName || phoneNumber}`}
      style={{ 
        textDecoration: 'none',
        color: disabled ? '#6c757d' : '#009ef7',
        cursor: disabled ? 'default' : 'pointer'
      }}
    >
      {showIcon && (
        <i 
          className={`ki-duotone ${calling ? 'ki-loading' : 'ki-phone'} fs-6 me-2 ${calling ? 'spinner-border spinner-border-sm' : ''}`}
          style={{ color: disabled ? '#6c757d' : '#009ef7' }}
        >
          {!calling && (
            <>
              <span className='path1'></span>
              <span className='path2'></span>
            </>
          )}
        </i>
      )}
      <span className={disabled ? 'text-muted' : 'text-primary'}>
        {formatPhoneNumber(phoneNumber)}
      </span>
    </button>
  )
}

interface PhoneNumberDisplayProps {
  phoneNumber: string
  contactId?: string
  contactName?: string
  label?: string
  className?: string
  showCallButton?: boolean
  disabled?: boolean
}

export const PhoneNumberDisplay: React.FC<PhoneNumberDisplayProps> = ({
  phoneNumber,
  contactId,
  contactName,
  label,
  className = '',
  showCallButton = true,
  disabled = false
}) => {
  if (!phoneNumber) {
    return (
      <div className={className}>
        {label && <span className='text-muted fw-semibold fs-7'>{label}</span>}
        <div className='text-muted'>-</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && <span className='text-muted fw-semibold fs-7 d-block'>{label}</span>}
      <div className='d-flex align-items-center'>
        {showCallButton ? (
          <ClickablePhoneNumber
            phoneNumber={phoneNumber}
            contactId={contactId}
            contactName={contactName}
            disabled={disabled}
            className='fw-bold fs-6'
          />
        ) : (
          <span className='text-dark fw-bold fs-6'>
            {communicationsService.formatPhoneNumber(phoneNumber)}
          </span>
        )}
      </div>
    </div>
  )
}

// Hook for managing active calls
export const useActiveCall = () => {
  const [activeCall, setActiveCall] = useState<any>(null)
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected' | 'ended'>('idle')

  const startCall = async (contactId: string, phoneNumber: string, contactName?: string) => {
    try {
      setCallStatus('calling')
      const call = await communicationsService.startOutboundCall(contactId, phoneNumber)
      setActiveCall({
        ...call,
        contact_name: contactName
      })
      setCallStatus('connected')
      return call
    } catch (error) {
      setCallStatus('idle')
      throw error
    }
  }

  const endCall = async () => {
    if (activeCall) {
      try {
        await communicationsService.hangupCall(activeCall.id)
        setActiveCall(null)
        setCallStatus('ended')
        
        // Reset to idle after a brief delay
        setTimeout(() => setCallStatus('idle'), 2000)
      } catch (error) {
        console.error('Error ending call:', error)
        showToast.error('Failed to end call')
      }
    }
  }

  const muteCall = async (muted: boolean) => {
    if (activeCall) {
      try {
        await communicationsService.muteCall(activeCall.id, muted)
        setActiveCall((prev: any) => ({ ...prev, muted }))
      } catch (error) {
        console.error('Error muting call:', error)
        showToast.error('Failed to mute call')
      }
    }
  }

  return {
    activeCall,
    callStatus,
    startCall,
    endCall,
    muteCall
  }
}
