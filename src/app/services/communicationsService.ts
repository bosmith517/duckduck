import { supabase } from '../../supabaseClient'

export interface CallLog {
  id: string
  created_at: string
  tenant_id: string
  user_id?: string
  contact_id?: string
  call_sid: string
  direction?: string
  recording_url?: string
  is_read: boolean
  status?: string
  from_number?: string
  to_number?: string
  duration?: number
  provider_id?: string
}

export interface SMSMessage {
  id: string
  tenant_id: string
  contact_id: string
  user_id?: string
  from_number: string
  to_number: string
  body: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'failed' | 'received'
  provider_id?: string
  created_at: string
}

export interface ActiveCall {
  id: string
  contact_id?: string
  contact_name?: string
  phone_number: string
  direction: 'inbound' | 'outbound'
  status: 'ringing' | 'connected' | 'on-hold'
  started_at: string
  provider_call_id?: string
}

class CommunicationsService {
  // Voice/Call Methods
  async startOutboundCall(contactId: string, phoneNumber: string): Promise<ActiveCall> {
    try {
      const { data, error } = await supabase.functions.invoke('start-outbound-call', {
        body: {
          contact_id: contactId,
          phone_number: phoneNumber
        }
      })

      if (error) {
        console.error('Error starting outbound call')
        throw error
      }

      return data?.call
    } catch (error) {
      console.error('Error in startOutboundCall')
      throw error
    }
  }

  async answerInboundCall(callId: string): Promise<void> {
    try {
      // Update call status in database
      const { error } = await supabase
        .from('calls')
        .update({ 
          status: 'connected',
          answered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (error) {
        console.error('Error answering inbound call')
        throw error
      }

      // TODO: Integrate with relay service API to actually answer the call
    } catch (error) {
      console.error('Error in answerInboundCall')
      throw error
    }
  }

  async rejectInboundCall(callId: string): Promise<void> {
    try {
      // Update call status in database
      const { error } = await supabase
        .from('calls')
        .update({ 
          status: 'rejected',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (error) {
        console.error('Error rejecting inbound call')
        throw error
      }

      // TODO: Integrate with relay service API to actually reject the call
    } catch (error) {
      console.error('Error in rejectInboundCall')
      throw error
    }
  }

  async hangupCall(callId: string): Promise<void> {
    try {
      // Get the call to calculate duration
      const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single()

      if (!call) throw new Error('Call not found')

      // Calculate duration if call was answered
      let duration = 0
      if (call.answered_at && !call.ended_at) {
        const startTime = new Date(call.answered_at).getTime()
        const endTime = new Date().getTime()
        duration = Math.floor((endTime - startTime) / 1000) // Duration in seconds
      }

      // Update call status in database
      const { error } = await supabase
        .from('calls')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration: duration,
          updated_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (error) {
        console.error('Error hanging up call')
        throw error
      }

      // TODO: Integrate with relay service API to actually end the call
    } catch (error) {
      console.error('Error in hangupCall:', error)
      throw error
    }
  }

  async muteCall(callId: string, muted: boolean): Promise<void> {
    try {
      // For now, we'll just track the mute state locally
      // In a real implementation, this would communicate with the relay service
      console.log(`Call ${callId} mute status: ${muted}`)
      
      // TODO: Integrate with relay service API to actually mute/unmute the call
      // The relay service would need to handle the WebRTC audio track muting
    } catch (error) {
      console.error('Error in muteCall:', error)
      throw error
    }
  }

  async getCallLogs(filters?: {
    contact_id?: string
    direction?: string
    date_from?: string
    date_to?: string
  }): Promise<CallLog[]> {
    try {
      // Get current user's tenant_id
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) {
        throw new Error('User not authenticated')
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', currentUser.user.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('User tenant not found')
      }

      let query = supabase
        .from('calls')
        .select(`
          *,
          contact:contacts (
            id,
            first_name,
            last_name,
            account:accounts (
              id,
              name
            )
          )
        `)
        .eq('tenant_id', userProfile.tenant_id) // Add tenant filter
        .order('created_at', { ascending: false })

      if (filters?.contact_id) {
        query = query.eq('contact_id', filters.contact_id)
      }
      if (filters?.direction) {
        query = query.eq('direction', filters.direction)
      }
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from)
      }
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching call logs:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getCallLogs:', error)
      throw error
    }
  }

  // SMS Methods
  async sendSMS(contactId: string, phoneNumber: string, message: string): Promise<SMSMessage> {
    try {
      // Get the company's SignalWire phone number (from number)
      const { data: phoneNumbers } = await supabase
        .from('tenant_phone_numbers')
        .select('phone_number')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!phoneNumbers?.phone_number) {
        throw new Error('No active phone number found for sending SMS')
      }

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: phoneNumber,
          from: phoneNumbers.phone_number,
          body: message
        }
      })

      if (error) {
        console.error('Error sending SMS:', error)
        throw error
      }

      return data?.sms_message
    } catch (error) {
      console.error('Error in sendSMS:', error)
      throw error
    }
  }

  async getSMSMessages(contactId: string): Promise<SMSMessage[]> {
    try {
      const { data, error } = await supabase
        .from('sms_messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching SMS messages:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getSMSMessages:', error)
      throw error
    }
  }

  // Real-time subscriptions
  subscribeToInboundCalls(callback: (payload: any) => void) {
    return supabase
      .channel('inbound-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: 'direction=eq.inbound'
        },
        callback
      )
      .subscribe()
  }

  subscribeToSMSMessages(contactId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`sms-messages-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_messages',
          filter: `contact_id=eq.${contactId}`
        },
        callback
      )
      .subscribe()
  }

  subscribeToCallUpdates(callId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`call-updates-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_logs',
          filter: `id=eq.${callId}`
        },
        callback
      )
      .subscribe()
  }

  // Utility methods
  formatPhoneNumber(number: string): string {
    // Format phone numbers to (XXX) XXX-XXXX
    const cleaned = number.replace(/\D/g, '')
    
    // Handle 11-digit numbers starting with 1 (remove country code)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.slice(1, 4)
      const exchange = cleaned.slice(4, 7)
      const number_part = cleaned.slice(7)
      return `(${areaCode}) ${exchange}-${number_part}`
    }
    
    // Handle 10-digit numbers
    if (cleaned.length === 10) {
      const areaCode = cleaned.slice(0, 3)
      const exchange = cleaned.slice(3, 6)
      const number_part = cleaned.slice(6)
      return `(${areaCode}) ${exchange}-${number_part}`
    }
    
    // Return original if not a valid US phone number
    return number
  }

  parsePhoneNumber(number: string): string {
    // Convert (123) 456-7890 to +11234567890
    const cleaned = number.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `+1${cleaned}`
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`
    }
    return number
  }

  async lookupContactByPhoneNumber(phoneNumber: string): Promise<any> {
    try {
      const cleanedNumber = this.parsePhoneNumber(phoneNumber)
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`phone.eq.${cleanedNumber},mobile.eq.${cleanedNumber},work_phone.eq.${cleanedNumber}`)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error looking up contact:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in lookupContactByPhoneNumber:', error)
      return null
    }
  }
}

export const communicationsService = new CommunicationsService()
