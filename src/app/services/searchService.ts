import { supabase } from '../../supabaseClient'

export interface SearchResult {
  id: string
  type: 'contact' | 'account' | 'job' | 'invoice' | 'estimate'
  title: string
  subtitle?: string
  url: string
  icon?: string
  metadata?: any
}

export interface SearchCategory {
  name: string
  count: number
  results: SearchResult[]
}

export class SearchService {
  static async performGlobalSearch(query: string, tenantId: string): Promise<SearchCategory[]> {
    if (!query || query.length < 2) {
      return []
    }

    const searchTerm = query.toLowerCase()
    const results: SearchCategory[] = []

    try {
      // Search Contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone, company, title')
        .eq('tenant_id', tenantId)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
        .limit(5)

      if (contacts && contacts.length > 0) {
        results.push({
          name: 'Contacts',
          count: contacts.length,
          results: contacts.map(contact => ({
            id: contact.id,
            type: 'contact',
            title: `${contact.first_name} ${contact.last_name}`,
            subtitle: contact.email || contact.phone || contact.company,
            url: `/contacts/${contact.id}`,
            icon: 'profile-circle',
            metadata: contact
          }))
        })
      }

      // Search Accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, type, phone, email')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.%${searchTerm}%,type.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5)

      if (accounts && accounts.length > 0) {
        results.push({
          name: 'Accounts',
          count: accounts.length,
          results: accounts.map(account => ({
            id: account.id,
            type: 'account',
            title: account.name,
            subtitle: account.type || account.email || account.phone,
            url: `/accounts/${account.id}`,
            icon: 'briefcase',
            metadata: account
          }))
        })
      }

      // Search Jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`
          id, 
          title, 
          job_number, 
          status, 
          description,
          account:accounts(name)
        `)
        .eq('tenant_id', tenantId)
        .or(`title.ilike.%${searchTerm}%,job_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(5)

      if (jobs && jobs.length > 0) {
        results.push({
          name: 'Jobs',
          count: jobs.length,
          results: jobs.map(job => ({
            id: job.id,
            type: 'job',
            title: job.title,
            subtitle: `#${job.job_number} - ${(job.account as any)?.name || 'No Account'} - ${job.status}`,
            url: `/jobs/${job.id}`,
            icon: 'abstract-26',
            metadata: job
          }))
        })
      }

      // Search Invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          project_title,
          total_amount,
          status,
          account:accounts(name)
        `)
        .eq('tenant_id', tenantId)
        .or(`invoice_number.ilike.%${searchTerm}%,project_title.ilike.%${searchTerm}%`)
        .limit(5)

      if (invoices && invoices.length > 0) {
        results.push({
          name: 'Invoices',
          count: invoices.length,
          results: invoices.map(invoice => ({
            id: invoice.id,
            type: 'invoice',
            title: invoice.project_title || `Invoice #${invoice.invoice_number}`,
            subtitle: `${(invoice.account as any)?.name || 'No Account'} - $${invoice.total_amount} - ${invoice.status}`,
            url: `/invoices/${invoice.id}`,
            icon: 'document',
            metadata: invoice
          }))
        })
      }

      // Search Estimates
      const { data: estimates } = await supabase
        .from('estimates')
        .select(`
          id,
          estimate_number,
          project_title,
          total_amount,
          status,
          account:accounts(name)
        `)
        .eq('tenant_id', tenantId)
        .or(`estimate_number.ilike.%${searchTerm}%,project_title.ilike.%${searchTerm}%`)
        .limit(5)

      if (estimates && estimates.length > 0) {
        results.push({
          name: 'Estimates',
          count: estimates.length,
          results: estimates.map(estimate => ({
            id: estimate.id,
            type: 'estimate',
            title: estimate.project_title || `Estimate #${estimate.estimate_number}`,
            subtitle: `${(estimate.account as any)?.name || 'No Account'} - $${estimate.total_amount} - ${estimate.status}`,
            url: `/estimates/${estimate.id}`,
            icon: 'calculator',
            metadata: estimate
          }))
        })
      }

    } catch (error) {
      console.error('Error performing global search:', error)
    }

    return results
  }

  static async getRecentSearches(tenantId: string): Promise<SearchResult[]> {
    // For now, return some common/recent items
    // In a real implementation, you'd track actual user searches
    try {
      const recentItems: SearchResult[] = []

      // Get recent jobs
      const { data: recentJobs } = await supabase
        .from('jobs')
        .select('id, title, job_number')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentJobs) {
        recentItems.push(...recentJobs.map(job => ({
          id: job.id,
          type: 'job' as const,
          title: job.title,
          subtitle: `#${job.job_number}`,
          url: `/jobs/${job.id}`,
          icon: 'abstract-26'
        })))
      }

      // Get recent contacts
      const { data: recentContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(2)

      if (recentContacts) {
        recentItems.push(...recentContacts.map(contact => ({
          id: contact.id,
          type: 'contact' as const,
          title: `${contact.first_name} ${contact.last_name}`,
          subtitle: contact.email,
          url: `/contacts/${contact.id}`,
          icon: 'profile-circle'
        })))
      }

      return recentItems
    } catch (error) {
      console.error('Error fetching recent searches:', error)
      return []
    }
  }
}