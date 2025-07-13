import { supabase } from '../../supabaseClient'

export interface UnifiedClient {
  id: string
  name: string
  type: 'business' | 'individual'
  email?: string
  phone?: string
  address?: string
  // Original IDs for reference
  accountId?: string
  contactId?: string
}

export const clientService = {
  /**
   * Get all clients (both business accounts and individual contacts) for the current tenant
   * This provides a unified view of all possible clients for selection in forms
   */
  async getAllClients(tenantId: string): Promise<UnifiedClient[]> {
    try {
      // Fetch business accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, name, email, phone')
        .eq('tenant_id', tenantId)
        .order('name')

      if (accountsError) throw accountsError

      // Fetch individual contacts (those not associated with a business account)
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, name, first_name, last_name, email, phone, account_id')
        .eq('tenant_id', tenantId)
        .is('account_id', null) // Only get standalone contacts, not business contacts
        .order('name')

      if (contactsError) throw contactsError

      // Transform to unified format
      const unifiedClients: UnifiedClient[] = []

      // Add business accounts
      if (accounts) {
        accounts.forEach(account => {
          unifiedClients.push({
            id: `account_${account.id}`,
            name: account.name,
            type: 'business',
            email: account.email || undefined,
            phone: account.phone || undefined,
            accountId: account.id
          })
        })
      }

      // Add individual contacts
      if (contacts) {
        contacts.forEach(contact => {
          const displayName = contact.name || 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 
            contact.email || 
            'Unnamed Contact'
            
          unifiedClients.push({
            id: `contact_${contact.id}`,
            name: displayName,
            type: 'individual',
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            contactId: contact.id
          })
        })
      }

      return unifiedClients
    } catch (error) {
      console.error('Error fetching clients:', error)
      throw error
    }
  },

  /**
   * Parse a unified client ID back to account_id or contact_id
   */
  parseUnifiedId(unifiedId: string): { accountId?: string; contactId?: string } {
    if (unifiedId.startsWith('account_')) {
      return { accountId: unifiedId.replace('account_', '') }
    } else if (unifiedId.startsWith('contact_')) {
      return { contactId: unifiedId.replace('contact_', '') }
    }
    // Fallback for legacy IDs - try to determine type
    return { accountId: unifiedId } // Default to account for backward compatibility
  },

  /**
   * Get a single client by unified ID
   */
  async getClientById(unifiedId: string, tenantId: string): Promise<UnifiedClient | null> {
    const { accountId, contactId } = this.parseUnifiedId(unifiedId)

    try {
      if (accountId) {
        const { data, error } = await supabase
          .from('accounts')
          .select('id, name, email, phone')
          .eq('id', accountId)
          .eq('tenant_id', tenantId)
          .single()

        if (error || !data) return null

        return {
          id: `account_${data.id}`,
          name: data.name,
          type: 'business',
          email: data.email || undefined,
          phone: data.phone || undefined,
          accountId: data.id
        }
      } else if (contactId) {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, first_name, last_name, email, phone')
          .eq('id', contactId)
          .eq('tenant_id', tenantId)
          .single()

        if (error || !data) return null

        const displayName = data.name || 
          `${data.first_name || ''} ${data.last_name || ''}`.trim() || 
          data.email || 
          'Unnamed Contact'

        return {
          id: `contact_${data.id}`,
          name: displayName,
          type: 'individual',
          email: data.email || undefined,
          phone: data.phone || undefined,
          contactId: data.id
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching client by ID:', error)
      return null
    }
  },

  /**
   * Search clients by name, email, or phone
   */
  async searchClients(query: string, tenantId: string): Promise<UnifiedClient[]> {
    if (!query || query.length < 2) return []

    const searchTerm = `%${query}%`

    try {
      // Search accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, email, phone, address_line1, city, state, zip_code')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(10)

      // Search contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, first_name, last_name, email, phone, address_line1, city, state, zip_code, account_id')
        .eq('tenant_id', tenantId)
        .is('account_id', null)
        .or(`name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
        .limit(10)

      const results: UnifiedClient[] = []

      // Add accounts to results
      if (accounts) {
        accounts.forEach(account => {
          results.push({
            id: `account_${account.id}`,
            name: account.name,
            type: 'business',
            email: account.email || undefined,
            phone: account.phone || undefined,
            address: [
              account.address_line1,
              account.city,
              account.state,
              account.zip_code
            ].filter(Boolean).join(', ') || undefined,
            accountId: account.id
          })
        })
      }

      // Add contacts to results
      if (contacts) {
        contacts.forEach(contact => {
          const displayName = contact.name || 
            `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 
            contact.email || 
            'Unnamed Contact'
            
          results.push({
            id: `contact_${contact.id}`,
            name: displayName,
            type: 'individual',
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            address: [
              contact.address_line1,
              contact.city,
              contact.state,
              contact.zip_code
            ].filter(Boolean).join(', ') || undefined,
            contactId: contact.id
          })
        })
      }

      return results
    } catch (error) {
      console.error('Error searching clients:', error)
      return []
    }
  }
}