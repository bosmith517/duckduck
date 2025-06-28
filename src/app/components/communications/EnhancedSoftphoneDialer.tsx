import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { showToast } from '../../utils/toast';
import { User } from '@supabase/supabase-js';

interface EnhancedSoftphoneDialerProps {
  isVisible: boolean;
  onClose: () => void;
}

type CallState = 'idle' | 'connecting' | 'dialing' | 'active' | 'muted' | 'disconnected';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface CallInfo {
  name: string;
  number: string;
  contactId?: string;
}

export const EnhancedSoftphoneDialer: React.FC<EnhancedSoftphoneDialerProps> = ({
  isVisible,
  onClose,
}) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [callInfo, setCallInfo] = useState<CallInfo>({ name: '-', number: '-' });
  const [timer, setTimer] = useState(0);
  const [dialedNumber, setDialedNumber] = useState('');
  const [myPhoneNumber, setMyPhoneNumber] = useState<string>('');
  const [sipEndpoint, setSipEndpoint] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const swClientRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);

  useEffect(() => {
    if (isVisible && connectionState === 'disconnected') {
      initializeConnection();
    }

    return () => {
      if (swClientRef.current) {
        swClientRef.current.disconnect?.();
        swClientRef.current = null;
      }
    };
  }, [isVisible]);

  const initializeConnection = async () => {
    try {
      setConnectionState('connecting');
      showToast.loading('Connecting to phone system...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await connectSoftphone();
    } catch (error: any) {
      console.error('Error initializing connection:', error);
      setConnectionState('error');
      showToast.dismiss();
      showToast.error(error.message || 'Failed to connect to phone system');
    }
  };

  const connectSoftphone = async () => {
    try {
      showToast.loading('Setting up phone system...');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.tenant_id) {
        throw new Error('User tenant not found');
      }

      // Get phone numbers from local database
      let { data: phoneNumbers } = await supabase
        .from('signalwire_phone_numbers')
        .select('number')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .limit(1)
        .single();

      // If no phone numbers found locally, sync from SignalWire
      if (!phoneNumbers?.number) {
        console.log('No phone numbers found locally, syncing from SignalWire...');
        
        try {
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('list-signalwire-phone-numbers', {
            body: { tenant_id: userProfile.tenant_id }
          });

          if (syncError) {
            console.error('Error syncing phone numbers:', syncError);
            throw new Error('Failed to sync phone numbers from SignalWire');
          }

          if (syncResult?.success && syncResult?.phoneNumbers?.length > 0) {
            const { data: syncedNumbers } = await supabase
              .from('signalwire_phone_numbers')
              .select('number')
              .eq('tenant_id', userProfile.tenant_id)
              .eq('is_active', true)
              .limit(1)
              .single();

            phoneNumbers = syncedNumbers;
          }
        } catch (syncError) {
          console.error('Error during phone number sync:', syncError);
        }
      }

      if (!phoneNumbers?.number) {
        throw new Error('No active phone numbers found. Please configure a phone number in SignalWire.');
      }

      // Store user info for making calls
      swClientRef.current = {
        tenantId: userProfile.tenant_id,
        userId: user.id,
        fromNumber: phoneNumbers.number
      };

      setMyPhoneNumber(phoneNumbers.number);

      // Set up Supabase realtime subscription for call updates
      const channel = supabase.channel('enhanced-calls-channel');
      
      channel
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'calls',
            filter: `tenant_id=eq.${userProfile.tenant_id}`
          },
          (payload) => {
            console.log('Call update received:', payload);
            handleCallUpdate(payload);
          }
        )
        .subscribe();

      // Store the channel for cleanup
      swClientRef.current.channel = channel;

      setConnectionState('connected');
      showToast.dismiss();
      showToast.success('Enhanced Softphone is Ready!');
      
    } catch (error: any) {
      console.error('Error connecting softphone:', error);
      setConnectionState('error');
      showToast.dismiss();
      showToast.error(error.message || 'Failed to connect to phone system');
    }
  };

  const handleCallUpdate = (payload: any) => {
    const callData = payload.new || payload.old;
    
    if (!callData) return;

    // Update UI based on call status
    switch (callData.status) {
      case 'ringing':
        if (callData.direction === 'inbound') {
          setCallInfo({ 
            name: 'Incoming Call', 
            number: callData.from_number 
          });
          setCallState('dialing');
          activeCallRef.current = { 
            callSid: callData.call_sid,
            callRecordId: callData.id 
          };
        } else {
          setCallState('dialing');
        }
        break;
      case 'active':
        setCallState('active');
        showToast.success('Call connected!');
        break;
      case 'completed':
      case 'failed':
      case 'cancelled':
        setCallState('idle');
        setCallInfo({ name: '-', number: '-' });
        setDialedNumber('');
        activeCallRef.current = null;
        showToast.info('Call ended');
        break;
    }
  };


  const handleHangup = async () => {
    try {
      if (activeCallRef.current?.callSid) {
        // Call the Relay Service to hangup the call
        const response = await fetch(`${import.meta.env.VITE_RELAY_SERVICE_URL || 'http://localhost:3001'}/call/hangup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callSid: activeCallRef.current.callSid
          })
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Failed to hangup call');
        }
      } else {
        // Just clear the dialed number if no active call
        setDialedNumber('');
        setCallState('idle');
        setCallInfo({ name: '-', number: '-' });
      }
    } catch (error: any) {
      console.error('Error ending call:', error);
      showToast.error(error.message || 'Failed to end call');
    }
  };

  const handleMuteToggle = async () => {
    if (!activeCallRef.current?.callSid) return;
    
    try {
      const endpoint = callState === 'active' ? 'mute' : 'unmute';
      
      const response = await fetch(`${import.meta.env.VITE_RELAY_SERVICE_URL || 'http://localhost:3001'}/call/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid: activeCallRef.current.callSid
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || `Failed to ${endpoint} call`);
      }

      // Update UI state (the actual state will be updated via Supabase realtime)
      if (callState === 'active') {
        setCallState('muted');
        showToast.info('Call muted');
      } else {
        setCallState('active');
        showToast.info('Call unmuted');
      }
    } catch (error: any) {
      console.error('Mute/unmute failed:', error);
      showToast.error('Mute/unmute failed');
    }
  };

  const handleKeypadPress = (key: string) => {
    if (callState === 'idle') {
      setDialedNumber(prev => prev + key);
    } else if (activeCallRef.current?.callSid && (callState === 'active' || callState === 'muted')) {
      sendDTMF(key);
    }
  };

  const sendDTMF = async (digits: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_RELAY_SERVICE_URL || 'http://localhost:3001'}/call/dtmf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid: activeCallRef.current.callSid,
          digits
        })
      });

      const result = await response.json();
      if (result.success) {
        showToast.info(`Sent DTMF: ${digits}`);
      }
    } catch (error) {
      console.error('Failed to send DTMF:', error);
    }
  };
  
  const handleMakeCall = async (name: string, phoneNumber: string, contactId?: string) => {
    if (!swClientRef.current || connectionState !== 'connected') {
      showToast.error('Not connected to phone system');
      return;
    }

    try {
      setCallState('dialing');
      setCallInfo({ name, number: phoneNumber, contactId });
      
      // Call the Relay Service to originate the call
      const response = await fetch(`${import.meta.env.VITE_RELAY_SERVICE_URL || 'http://localhost:3001'}/call/originate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneNumber,
          from: swClientRef.current.fromNumber,
          tenantId: swClientRef.current.tenantId,
          userId: swClientRef.current.userId
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to initiate call');
      }

      // Store call info for future operations
      activeCallRef.current = {
        callSid: result.callId,
        callRecordId: result.callRecordId
      };

      showToast.loading(`Calling ${name}...`);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      showToast.error(error.message || 'Failed to initiate call');
      setCallState('idle');
      setCallInfo({ name: '-', number: '-' });
    }
  };


  const handleCall = () => {
    if (callState === 'idle' && dialedNumber && connectionState === 'connected') {
      handleMakeCall('Manual Dial', dialedNumber)
    }
  }

  const handleClear = () => {
    if (callState === 'idle') setDialedNumber('')
  }

  const handleReconnect = () => {
    if (connectionState === 'error' || connectionState === 'disconnected') {
      initializeConnection()
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

  const statusInfo = getStatusInfo()

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        /* Your extensive CSS styles are omitted for brevity but should remain unchanged */
      `}</style>
      <div id="enhanced-softphone">
        {/* Your extensive JSX for the dialer UI is omitted for brevity but should remain unchanged */}
      </div>
    </>
  )
}


export const useEnhancedSoftphone = () => {
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

export default EnhancedSoftphoneDialer
