import { supabase } from '../../supabaseClient'

export interface Lead {
  id: string
  tenant_id: string
  caller_name: string
  caller_type: 'business' | 'individual'
  phone_number: string
  email?: string
  lead_source: string
  initial_request: string
  status: 'new' | 'qualified' | 'unqualified' | 'converted'
  urgency: 'low' | 'medium' | 'high' | 'emergency'
  estimated_value?: number
  follow_up_date?: string
  notes?: string
  converted_contact_id?: string
  converted_to_job_id?: string
  // Address fields for property location
  street_address?: string
  city?: string
  state?: string
  zip_code?: string
  full_address?: string // Auto-generated from individual fields
  property_type?: 'residential' | 'commercial' | 'industrial' | 'other'
  property_size?: string
  lot_size?: string
  year_built?: number
  additional_property_info?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  account_id?: string // Null for individual customers, set for business contacts
  lead_id?: string // Original lead that was converted
  contact_type: 'individual' | 'business_contact'
  name: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string // For business contacts
  job_title?: string // For business contacts
  preferred_contact_method?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  created_at: string
}

export interface Account {
  id: string
  tenant_id: string
  name: string
  type?: string
  industry?: string
  phone?: string
  email?: string
  website?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  created_at: string
}

export interface LeadConversionResult {
  contact: Contact
  account?: Account
  success: boolean
  message: string
}

class CRMService {
  /**
   * Convert a lead to a contact (and account if business)
   */
  async convertLeadToContact(
    leadId: string, 
    tenantId: string,
    contactDetails: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
      company?: string
      job_title?: string
      address_line1?: string
      city?: string
      state?: string
      zip_code?: string
    }
  ): Promise<LeadConversionResult> {
    try {
      // 1. Get the lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        return { success: false, message: 'Lead not found', contact: {} as Contact }
      }

      if (lead.status === 'converted') {
        return { success: false, message: 'Lead already converted', contact: {} as Contact }
      }

      let account: Account | undefined
      let accountId: string | undefined

      // 2. If business lead, create/find account first
      if (lead.caller_type === 'business' && contactDetails.company) {
        // Check if account already exists
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('name', contactDetails.company)
          .single()

        if (existingAccount) {
          account = existingAccount
          accountId = existingAccount.id
        } else {
          // Create new account
          const { data: newAccount, error: accountError } = await supabase
            .from('accounts')
            .insert({
              tenant_id: tenantId,
              name: contactDetails.company,
              type: 'business',
              phone: contactDetails.phone,
              email: contactDetails.email,
              address_line1: contactDetails.address_line1,
              city: contactDetails.city,
              state: contactDetails.state,
              zip_code: contactDetails.zip_code
            })
            .select()
            .single()

          if (accountError) {
            return { success: false, message: 'Failed to create account', contact: {} as Contact }
          }

          account = newAccount
          accountId = newAccount.id
        }
      }

      // 3. Create contact
      const contactData = {
        tenant_id: tenantId,
        account_id: accountId,
        lead_id: leadId,
        contact_type: lead.caller_type === 'business' ? 'business_contact' : 'individual',
        name: `${contactDetails.first_name} ${contactDetails.last_name}`.trim(),
        first_name: contactDetails.first_name,
        last_name: contactDetails.last_name,
        email: contactDetails.email || lead.email,
        phone: contactDetails.phone || lead.phone_number,
        company: contactDetails.company,
        job_title: contactDetails.job_title,
        address_line1: contactDetails.address_line1,
        city: contactDetails.city,
        state: contactDetails.state,
        zip_code: contactDetails.zip_code
      }

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single()

      if (contactError) {
        return { success: false, message: 'Failed to create contact', contact: {} as Contact }
      }

      // 4. Update lead status and link to contact
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          converted_contact_id: contact.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (updateError) {
        console.error('Failed to update lead status:', updateError)
        // Don't fail the entire operation for this
      }

      return {
        success: true,
        message: `Lead converted to ${lead.caller_type === 'business' ? 'business contact' : 'customer'}`,
        contact,
        account
      }

    } catch (error) {
      console.error('Error converting lead:', error)
      return { success: false, message: 'Conversion failed', contact: {} as Contact }
    }
  }

  /**
   * Get all contacts with their associated accounts and lead info
   */
  async getContactsWithDetails(tenantId: string) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          accounts (id, name, type, industry),
          leads (id, lead_source, initial_request, created_at)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching contacts:', error)
      return []
    }
  }

  /**
   * Get business accounts with their contacts
   */
  async getAccountsWithContacts(tenantId: string) {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select(`
          *,
          contacts (id, name, first_name, last_name, email, phone, job_title)
        `)
        .eq('tenant_id', tenantId)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching accounts:', error)
      return []
    }
  }

  /**
   * Create a standalone customer contact (no account needed)
   */
  async createCustomerContact(tenantId: string, contactData: Partial<Contact>) {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contactData,
          tenant_id: tenantId,
          contact_type: 'individual',
          account_id: null // No account for individual customers
        })
        .select()
        .single()

      if (error) throw error
      return { success: true, contact: data }
    } catch (error) {
      console.error('Error creating customer:', error)
      return { success: false, message: 'Failed to create customer' }
    }
  }

  /**
   * Create a business contact (requires account)
   */
  async createBusinessContact(
    tenantId: string, 
    contactData: Partial<Contact>, 
    accountData: Partial<Account>
  ) {
    try {
      // First create or find the account
      let accountId: string

      if (accountData.id) {
        accountId = accountData.id
      } else {
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .insert({
            ...accountData,
            tenant_id: tenantId,
            type: 'business'
          })
          .select()
          .single()

        if (accountError) throw accountError
        accountId = account.id
      }

      // Then create the contact
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          ...contactData,
          tenant_id: tenantId,
          account_id: accountId,
          contact_type: 'business_contact'
        })
        .select()
        .single()

      if (contactError) throw contactError

      return { success: true, contact, accountId }
    } catch (error) {
      console.error('Error creating business contact:', error)
      return { success: false, message: 'Failed to create business contact' }
    }
  }
}

export const crmService = new CRMService()