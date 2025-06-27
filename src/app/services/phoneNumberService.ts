import { supabase } from '../../supabaseClient'

export interface TenantPhoneNumber {
  id: string
  tenant_id: string
  phone_number: string
  number: string // Alias for phone_number to match schema
  provider: string
  provider_id?: string
  signalwire_id?: string
  name?: string
  capabilities?: {
    sms?: boolean
    voice?: boolean
    mms?: boolean
    fax?: boolean
  }
  voice_enabled?: boolean
  sms_enabled?: boolean
  mms_enabled?: boolean
  fax_enabled?: boolean
  number_type?: string
  is_active: boolean
  is_primary?: boolean
  created_at: string
}

export interface AvailablePhoneNumber {
  phone_number: string
  friendly_name: string
  locality: string
  region: string
  capabilities: {
    sms: boolean
    voice: boolean
  }
  price?: string
}

class PhoneNumberService {
  async searchAvailableNumbers(criteria: {
    area_code?: string
    contains?: string
    locality?: string
    region?: string
    starts_with?: string
    ends_with?: string
    max_results?: number
    number_type?: 'local' | 'toll-free'
  }): Promise<AvailablePhoneNumber[]> {
    try {
      const { data, error } = await supabase.functions.invoke('search-available-numbers', {
        body: {
          areacode: criteria.area_code, // Fix parameter name to match Edge Function
          contains: criteria.contains,
          city: criteria.locality, // Fix parameter name to match Edge Function
          region: criteria.region,
          starts_with: criteria.starts_with,
          ends_with: criteria.ends_with,
          max_results: criteria.max_results || 10,
          number_type: criteria.number_type || 'local'
        }
      })

      if (error) {
        console.error('Error searching available numbers:', error)
        throw error
      }

      // Debug: Log the actual response structure
      console.log('SignalWire search response:', JSON.stringify(data, null, 2))
      
      // Map SignalWire response to our interface format
      const rawNumbers = data?.available_numbers || data?.data || []
      console.log('Raw numbers from response:', rawNumbers)
      
      const mappedNumbers = rawNumbers.map((num: any, index: number) => {
        console.log('Mapping number:', num)
        
        // Extract phone number with multiple fallbacks
        const phoneNumber = num.e164 || num.phone_number || num.number || num.phoneNumber || `temp-${index}`
        
        return {
          phone_number: phoneNumber,
          friendly_name: num.friendly_name || num.name || phoneNumber || 'Unknown',
          locality: num.rate_center || num.locality || num.city || num.location?.city || 'Unknown',
          region: num.region || num.state || num.location?.region || 'Unknown',
          capabilities: {
            sms: num.capabilities?.includes?.('sms') || num.capabilities?.sms || num.sms_enabled || false,
            voice: num.capabilities?.includes?.('voice') || num.capabilities?.voice || num.voice_enabled || true
          },
          price: num.price || num.monthly_rate || '$1.00/mo'
        }
      })
      
      console.log('Mapped numbers:', mappedNumbers)
      return mappedNumbers
    } catch (error) {
      console.error('Error in searchAvailableNumbers:', error)
      throw error
    }
  }

  async purchasePhoneNumber(phoneNumber: string): Promise<TenantPhoneNumber> {
    try {
      // Get current user's tenant ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('User tenant not found')
      }

      const { data, error } = await supabase.functions.invoke('purchase-phone-number', {
        body: { 
          phoneNumber: phoneNumber, // Match the Edge Function parameter name
          tenantId: userProfile.tenant_id
        }
      })

      if (error) {
        console.error('Error purchasing phone number:', error)
        throw error
      }

      // Map the response to match our interface
      const purchasedNumber = data?.phone_number || data?.data
      return {
        ...purchasedNumber,
        phone_number: purchasedNumber.number || purchasedNumber.phone_number,
        provider: 'SignalWire'
      }
    } catch (error) {
      console.error('Error in purchasePhoneNumber:', error)
      throw error
    }
  }

  async getTenantPhoneNumbers(): Promise<TenantPhoneNumber[]> {
    try {
      // TEMP DEBUG: Check what's actually in the database
      const { data: dbData, error: dbError } = await supabase
        .from('signalwire_phone_numbers')
        .select('*')
        .eq('is_active', true)
      
      console.log('Direct database query result:', { dbData, dbError })
      
      // Use the dedicated Edge Function that fetches from SignalWire and syncs with database
      const { data, error } = await supabase.functions.invoke('list-signalwire-phone-numbers', {
        body: {}
      })

      if (error) {
        console.error('Error fetching tenant phone numbers:', error)
        throw error
      }

      console.log('Phone numbers from SignalWire:', data)
      console.log('Available fields in data:', Object.keys(data || {}))
      console.log('phoneNumbers field:', data?.phoneNumbers)
      console.log('data field:', data?.data)
      console.log('Raw phone numbers array length:', (data?.phoneNumbers || data?.data || []).length)

      // Map SignalWire data to our interface
      const phoneNumbers = (data?.phoneNumbers || data?.data || []).map((phone: any) => ({
        id: phone.id,
        tenant_id: data.tenant_id,
        phone_number: phone.number,
        number: phone.number,
        provider: 'SignalWire',
        signalwire_id: phone.id,
        capabilities: {
          voice: phone.capabilities?.includes('voice') || false,
          sms: phone.capabilities?.includes('sms') || false,
          fax: phone.capabilities?.includes('fax') || false,
          mms: phone.capabilities?.includes('mms') || false
        },
        voice_enabled: phone.capabilities?.includes('voice') || false,
        sms_enabled: phone.capabilities?.includes('sms') || false,
        fax_enabled: phone.capabilities?.includes('fax') || false,
        mms_enabled: phone.capabilities?.includes('mms') || false,
        number_type: phone.number_type || 'local',
        is_active: true,
        is_primary: false,
        created_at: phone.created_at || new Date().toISOString()
      }))

      return phoneNumbers
    } catch (error) {
      console.error('Error in getTenantPhoneNumbers:', error)
      throw error
    }
  }

  async releasePhoneNumber(phoneNumberId: string): Promise<void> {
    try {
      const { error } = await supabase.functions.invoke('release-signalwire-phone-number', {
        body: { phoneNumberId: phoneNumberId }
      })

      if (error) {
        console.error('Error releasing phone number:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in releasePhoneNumber:', error)
      throw error
    }
  }

  async updatePhoneNumberSettings(phoneNumberId: string, settings: {
    capabilities?: { sms?: boolean; voice?: boolean; mms?: boolean; fax?: boolean }
    is_active?: boolean
    is_primary?: boolean
  }): Promise<TenantPhoneNumber> {
    try {
      const { data, error } = await supabase
        .from('signalwire_phone_numbers')
        .update(settings)
        .eq('id', phoneNumberId)
        .select()
        .single()

      if (error) {
        console.error('Error updating phone number settings:', error)
        throw error
      }

      // Map the response to match our interface
      return {
        ...data,
        phone_number: data.number,
        provider: 'SignalWire'
      }
    } catch (error) {
      console.error('Error in updatePhoneNumberSettings:', error)
      throw error
    }
  }
}

export const phoneNumberService = new PhoneNumberService()

// Add a utility function to format phone numbers
export const formatPhoneNumber = (number: string | null | undefined): string => {
  if (!number || number === 'N/A' || number.startsWith('temp-')) return 'N/A'
  
  // Format +1234567890 to (123) 456-7890
  const cleaned = number.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.slice(1, 4)
    const exchange = cleaned.slice(4, 7)
    const numberPart = cleaned.slice(7)
    return `(${areaCode}) ${exchange}-${numberPart}`
  }
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3)
    const exchange = cleaned.slice(3, 6)
    const numberPart = cleaned.slice(6)
    return `(${areaCode}) ${exchange}-${numberPart}`
  }
  return number
}
