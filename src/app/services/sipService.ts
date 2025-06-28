import { supabase } from '../../supabaseClient';
import { showToast } from '../utils/toast';

export interface SipConfiguration {
  id: string;
  tenant_id: string;
  sip_username: string;
  sip_password_encrypted: string;
  sip_domain: string;
  sip_proxy: string;
  display_name?: string;
  is_active: boolean;
  service_plan: 'basic' | 'professional' | 'enterprise';
  primary_phone_number?: string;
  monthly_rate: number;
  per_minute_rate: number;
  included_minutes: number;
  created_at: string;
  activated_at?: string;
}

export interface SipPhoneNumber {
  id: string;
  sip_config_id: string;
  tenant_id: string;
  phone_number: string;
  country_code: string;
  area_code?: string;
  number_type: 'local' | 'toll-free' | 'international';
  is_primary: boolean;
  is_active: boolean;
  sms_enabled: boolean;
  voice_enabled: boolean;
  fax_enabled: boolean;
  created_at: string;
  signalwire_number_id?: string;
}

export interface SipCallLog {
  id: string;
  call_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  call_status: 'ringing' | 'answered' | 'busy' | 'failed' | 'no-answer' | 'cancelled';
  start_time: string;
  answer_time?: string;
  end_time?: string;
  duration_seconds: number;
  total_cost: number;
  caller_name?: string;
}

export interface SipUsageStats {
  total_calls: number;
  total_minutes: number;
  total_cost: number;
  inbound_calls: number;
  outbound_calls: number;
  inbound_minutes: number;
  outbound_minutes: number;
}

class SipService {
  // Create SIP configuration for a tenant
  async createSipConfiguration(tenantId: string, sipUsername: string, displayName?: string): Promise<SipConfiguration | null> {
    try {
      showToast.loading('Setting up phone service...');

      // Call Supabase function to create SIP trunk with SignalWire
      const { data: sipData, error: sipError } = await supabase.functions.invoke('create-sip-trunk', {
        body: {
          tenantId,
          sipUsername,
          displayName
        }
      });

      if (sipError) throw sipError;
      if (!sipData?.success) throw new Error(sipData?.error || 'Failed to create SIP trunk');

      const { sipConfig } = sipData;

      // Store SIP configuration in database
      const { data, error } = await supabase
        .from('sip_configurations')
        .insert({
          tenant_id: tenantId,
          sip_username: sipConfig.username,
          sip_password_encrypted: btoa(sipConfig.password), // Basic encoding (should use proper encryption in production)
          sip_domain: sipConfig.domain,
          sip_proxy: sipConfig.proxy,
          display_name: sipConfig.displayName,
          signalwire_endpoint_id: sipConfig.endpoint_id,
          signalwire_project_id: sipData.project,
          activated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      showToast.dismiss();
      showToast.success('Phone service activated successfully!');
      return data;
    } catch (error: any) {
      console.error('Error creating SIP configuration:', error);
      showToast.dismiss();
      showToast.error(error.message || 'Failed to set up phone service');
      return null;
    }
  }

  // Get SIP configuration for current tenant
  async getSipConfiguration(): Promise<SipConfiguration | null> {
    try {
      const { data, error } = await supabase
        .from('sip_configurations')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    } catch (error: any) {
      console.error('Error fetching SIP configuration:', error);
      return null;
    }
  }

  // Get decrypted SIP credentials for softphone connection
  async getSipCredentials(): Promise<{ username: string; password: string; domain: string; proxy: string } | null> {
    try {
      const config = await this.getSipConfiguration();
      if (!config) return null;

      return {
        username: config.sip_username,
        password: atob(config.sip_password_encrypted), // Basic decoding (should use proper decryption in production)
        domain: config.sip_domain,
        proxy: config.sip_proxy
      };
    } catch (error: any) {
      console.error('Error getting SIP credentials:', error);
      return null;
    }
  }

  // Search available phone numbers using existing SignalWire function
  async searchAvailableNumbers(searchParams: {
    areaCode?: string;
    contains?: string;
    numberType?: 'local' | 'toll-free';
    countryCode?: string;
  }): Promise<any[]> {
    try {
      const { data, error } = await supabase.functions.invoke('search-available-numbers', {
        body: {
          countryCode: searchParams.countryCode || 'US',
          areaCode: searchParams.areaCode,
          contains: searchParams.contains,
          numberType: searchParams.numberType || 'local'
        }
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error searching available numbers:', error);
      return [];
    }
  }

  // Purchase a phone number using existing SignalWire function
  async purchasePhoneNumber(phoneNumber: string, tenantId?: string): Promise<SipPhoneNumber | null> {
    try {
      showToast.loading('Purchasing phone number...');

      // Get tenant ID if not provided
      if (!tenantId) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('tenant_id')
          .eq('id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        
        if (!userProfile?.tenant_id) throw new Error('User tenant not found');
        tenantId = userProfile.tenant_id;
      }

      // Purchase the number via SignalWire using existing function
      const { data: purchaseData, error: purchaseError } = await supabase.functions.invoke('purchase-phone-number', {
        body: {
          phoneNumber: phoneNumber,
          tenantId: tenantId
        }
      });

      if (purchaseError) throw purchaseError;
      if (!purchaseData) throw new Error('Failed to purchase phone number');

      // Get SIP configuration for this tenant
      const sipConfig = await this.getSipConfiguration();
      if (!sipConfig) throw new Error('SIP configuration not found for tenant');

      // Store the purchased number in our SIP phone numbers table
      const { data, error } = await supabase
        .from('sip_phone_numbers')
        .insert({
          sip_config_id: sipConfig.id,
          tenant_id: tenantId,
          phone_number: purchaseData.phone_number,
          signalwire_number_id: purchaseData.provider_id,
          country_code: '+1',
          area_code: purchaseData.phone_number.substring(2, 5), // Extract area code from +1AAANNNNNNN
          number_type: 'local',
          is_primary: false, // Will be set manually if needed
          voice_enabled: purchaseData.capabilities?.voice || true,
          sms_enabled: purchaseData.capabilities?.SMS || true,
          fax_enabled: purchaseData.capabilities?.fax || false
        })
        .select()
        .single();

      if (error) throw error;

      showToast.dismiss();
      showToast.success(`Phone number ${phoneNumber} purchased successfully!`);
      return data;
    } catch (error: any) {
      console.error('Error purchasing phone number:', error);
      showToast.dismiss();
      showToast.error(error.message || 'Failed to purchase phone number');
      return null;
    }
  }

  // Get phone numbers for current tenant
  async getPhoneNumbers(): Promise<SipPhoneNumber[]> {
    try {
      const { data, error } = await supabase
        .from('sip_phone_numbers')
        .select('*')
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching phone numbers:', error);
      return [];
    }
  }

  // Set a phone number as primary
  async setPrimaryPhoneNumber(phoneNumberId: string): Promise<boolean> {
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error('User tenant not found');

      // First, unset all primary flags for this tenant
      await supabase
        .from('sip_phone_numbers')
        .update({ is_primary: false })
        .eq('tenant_id', userProfile.tenant_id);

      // Then set the selected number as primary
      const { error } = await supabase
        .from('sip_phone_numbers')
        .update({ is_primary: true })
        .eq('id', phoneNumberId)
        .eq('tenant_id', userProfile.tenant_id);

      if (error) throw error;

      // Update the SIP configuration with the primary number
      const { data: phoneNumber } = await supabase
        .from('sip_phone_numbers')
        .select('phone_number')
        .eq('id', phoneNumberId)
        .single();

      if (phoneNumber) {
        await supabase
          .from('sip_configurations')
          .update({ primary_phone_number: phoneNumber.phone_number })
          .eq('tenant_id', userProfile.tenant_id);
      }

      showToast.success('Primary phone number updated');
      return true;
    } catch (error: any) {
      console.error('Error setting primary phone number:', error);
      showToast.error('Failed to update primary phone number');
      return false;
    }
  }

  // Get call logs for current tenant
  async getCallLogs(limit: number = 50, offset: number = 0): Promise<SipCallLog[]> {
    try {
      const { data, error } = await supabase
        .from('sip_call_logs')
        .select('*')
        .order('start_time', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching call logs:', error);
      return [];
    }
  }

  // Get usage statistics for current billing period
  async getUsageStats(startDate?: string, endDate?: string): Promise<SipUsageStats | null> {
    try {
      const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error('User tenant not found');

      const { data, error } = await supabase
        .rpc('calculate_sip_usage', {
          tenant_uuid: userProfile.tenant_id,
          period_start: start,
          period_end: end
        });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error: any) {
      console.error('Error fetching usage stats:', error);
      return null;
    }
  }

  // Log a call (typically called by webhook or real-time events)
  async logCall(callData: {
    call_id: string;
    direction: 'inbound' | 'outbound';
    from_number: string;
    to_number: string;
    call_status: string;
    start_time: string;
    answer_time?: string;
    end_time?: string;
    duration_seconds?: number;
    cost_per_minute?: number;
    total_cost?: number;
    caller_name?: string;
  }): Promise<boolean> {
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error('User tenant not found');

      const { data: sipConfig } = await supabase
        .from('sip_configurations')
        .select('id')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .single();

      if (!sipConfig) throw new Error('SIP configuration not found');

      const { error } = await supabase
        .from('sip_call_logs')
        .insert({
          sip_config_id: sipConfig.id,
          tenant_id: userProfile.tenant_id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          ...callData
        });

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error logging call:', error);
      return false;
    }
  }

  // Check if tenant has SIP service enabled
  async hasSipService(): Promise<boolean> {
    const config = await this.getSipConfiguration();
    return config?.is_active || false;
  }

  // Get service plans and pricing
  getServicePlans() {
    return [
      {
        id: 'basic',
        name: 'Basic Phone Service',
        monthlyRate: 29.99,
        includedMinutes: 1000,
        perMinuteRate: 0.02,
        features: [
          'Unlimited local calls',
          '1,000 included minutes',
          'Basic call management',
          'SMS messaging',
          'Call logs and reporting'
        ]
      },
      {
        id: 'professional',
        name: 'Professional Phone Service',
        monthlyRate: 59.99,
        includedMinutes: 3000,
        perMinuteRate: 0.015,
        features: [
          'Everything in Basic',
          '3,000 included minutes',
          'Advanced call routing',
          'Call recording',
          'Voicemail transcription',
          'Multiple phone numbers'
        ]
      },
      {
        id: 'enterprise',
        name: 'Enterprise Phone Service',
        monthlyRate: 99.99,
        includedMinutes: 10000,
        perMinuteRate: 0.01,
        features: [
          'Everything in Professional',
          '10,000 included minutes',
          'Priority support',
          'Custom integrations',
          'Advanced analytics',
          'Dedicated account manager'
        ]
      }
    ];
  }

  // Release/delete a phone number
  async releasePhoneNumber(phoneNumberId: string): Promise<boolean> {
    try {
      showToast.loading('Releasing phone number...');

      const { data: phoneNumber } = await supabase
        .from('sip_phone_numbers')
        .select('phone_number, signalwire_number_id')
        .eq('id', phoneNumberId)
        .single();

      if (!phoneNumber) throw new Error('Phone number not found');

      // TODO: Call SignalWire API to release the number
      // This would require a new Supabase function to handle number release

      // Mark as inactive in our database
      const { error } = await supabase
        .from('sip_phone_numbers')
        .update({ 
          is_active: false, 
          released_at: new Date().toISOString() 
        })
        .eq('id', phoneNumberId);

      if (error) throw error;

      showToast.dismiss();
      showToast.success('Phone number released successfully');
      return true;
    } catch (error: any) {
      console.error('Error releasing phone number:', error);
      showToast.dismiss();
      showToast.error('Failed to release phone number');
      return false;
    }
  }

  // Update SIP configuration settings
  async updateSipConfiguration(configId: string, updates: Partial<SipConfiguration>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('sip_configurations')
        .update(updates)
        .eq('id', configId);

      if (error) throw error;
      
      showToast.success('SIP configuration updated');
      return true;
    } catch (error: any) {
      console.error('Error updating SIP configuration:', error);
      showToast.error('Failed to update SIP configuration');
      return false;
    }
  }

  // Get all SignalWire phone numbers for a tenant (from existing tenant_phone_numbers table)
  async getSignalWirePhoneNumbers(): Promise<any[]> {
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error('User tenant not found');

      const { data, error } = await supabase
        .from('tenant_phone_numbers')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching SignalWire phone numbers:', error);
      return [];
    }
  }

  // Send SMS using existing function
  async sendSMS(to: string, message: string, from?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: {
          to,
          message,
          from
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send SMS');

      showToast.success('SMS sent successfully');
      return true;
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      showToast.error('Failed to send SMS');
      return false;
    }
  }

  // Start outbound call using existing function
  async startOutboundCall(to: string, from?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('start-outbound-call', {
        body: {
          to,
          from
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to start call');

      showToast.success('Call initiated');
      return true;
    } catch (error: any) {
      console.error('Error starting outbound call:', error);
      showToast.error('Failed to start call');
      return false;
    }
  }
}

export const sipService = new SipService();
