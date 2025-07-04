import { supabase } from '../../supabaseClient'

// SendGrid-specific types
export interface SendGridPersonalization {
  to: Array<{ email: string; name?: string }>
  cc?: Array<{ email: string; name?: string }>
  bcc?: Array<{ email: string; name?: string }>
  subject?: string
  substitutions?: Record<string, string>
  dynamic_template_data?: Record<string, any>
}

export interface SendGridContent {
  type: 'text/plain' | 'text/html'
  value: string
}

// Types for email operations
export interface SendEmailRequest {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html?: string
  text?: string
  template_id?: string
  template_variables?: Record<string, any>
  priority?: number
  scheduled_at?: string
  tags?: Record<string, any>
  // SendGrid specific
  sendgrid_template_id?: string
  personalizations?: SendGridPersonalization[]
  categories?: string[]
  custom_args?: Record<string, any>
  send_at?: number // Unix timestamp
}

export interface EmailDomain {
  id: string
  domain_name: string
  status: 'pending' | 'verified' | 'failed'
  dns_records: Array<{
    record: string
    name: string
    value: string
    type: string
  }>
  default_from_name: string
  default_from_email: string
  reply_to_email?: string
  is_default: boolean
  is_active: boolean
  created_at: string
  verified_at?: string
  last_checked_at?: string
}

export interface CreateDomainRequest {
  domain_name: string
  default_from_name: string
  default_from_email: string
  reply_to_email?: string
  region?: string
}

export interface EmailTemplate {
  id: string
  tenant_id: string
  template_name: string
  version: number
  subject_template: string
  html_template?: string
  text_template?: string
  variables: string[]
  description?: string
  is_active: boolean
  created_at: string
}

export interface EmailSystemHealth {
  metric: string
  value: number
  status: 'ok' | 'warning' | 'critical'
  description: string
}

export interface EmailUsage {
  month_year: string
  emails_sent: number
  emails_delivered: number
  emails_bounced: number
  emails_complained: number
  emails_opened: number
  emails_clicked: number
  monthly_limit: number
  daily_limit: number
  daily_usage: Record<string, number>
}

class EmailService {
  private async callFunction(functionName: string, data?: any, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('Authentication required')
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`
    console.log('🔗 Calling Edge Function:', url)
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    }

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }

  // Email sending operations
  async sendEmail(emailRequest: SendEmailRequest): Promise<{ success: boolean; message_id?: string; queue_id?: string; status: string }> {
    return await this.callFunction('sendgrid-send-email', emailRequest, 'POST')
  }

  async scheduleEmail(
    to: string,
    subject: string,
    content: { html?: string; text?: string } | { template_id: string; template_variables?: Record<string, any> },
    scheduledAt: Date,
    options?: { priority?: number; tags?: Record<string, any> }
  ): Promise<{ success: boolean; message_id?: string; queue_id?: string; status: string }> {
    const emailRequest: SendEmailRequest = {
      to,
      subject,
      scheduled_at: scheduledAt.toISOString(),
      priority: options?.priority || 5,
      tags: options?.tags,
      ...content
    }

    return await this.sendEmail(emailRequest)
  }

  // Domain management operations
  async getDomains(): Promise<{ success: boolean; domains: EmailDomain[] }> {
    return await this.callFunction('manage-email-domain', undefined, 'GET')
  }

  async createDomain(domainRequest: CreateDomainRequest): Promise<{ success: boolean; domain: EmailDomain; resend_domain_id: string }> {
    return await this.callFunction('manage-email-domain', domainRequest, 'POST')
  }

  async updateDomain(domainId: string, updates: Partial<Pick<EmailDomain, 'default_from_name' | 'default_from_email' | 'reply_to_email' | 'is_default'>>): Promise<{ success: boolean; domain: EmailDomain }> {
    return await this.callFunction('manage-email-domain', { domain_id: domainId, ...updates }, 'PUT')
  }

  async deleteDomain(domainId: string): Promise<{ success: boolean; message: string }> {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-email-domain?domain_id=${domainId}`
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Authentication required')
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  }

  async verifyDomain(domainId: string): Promise<{ success: boolean; domain: EmailDomain }> {
    return await this.callFunction('manage-email-domain', { 
      domain_id: domainId, 
      action: 'verify' 
    }, 'POST')
  }

  async setDefaultDomain(domainId: string): Promise<{ success: boolean; domain: EmailDomain }> {
    return await this.callFunction('manage-email-domain', { 
      domain_id: domainId,
      is_default: true
    }, 'PUT')
  }

  // Template management operations
  async getTemplates(): Promise<{ success: boolean; templates: EmailTemplate[] }> {
    const { data, error } = await supabase
      .from('email_template_versions')
      .select('*')
      .eq('is_active', true)
      .order('template_name')

    if (error) {
      throw new Error(`Failed to fetch templates: ${error.message}`)
    }

    return { success: true, templates: data || [] }
  }

  async createTemplate(template: Omit<EmailTemplate, 'id' | 'tenant_id' | 'created_at'>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_template_versions')
      .insert({
        ...template,
        version: 1
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`)
    }

    return data
  }

  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const { data, error } = await supabase
      .from('email_template_versions')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`)
    }

    return data
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('email_template_versions')
      .update({ is_active: false })
      .eq('id', templateId)

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`)
    }
  }

  // Email usage and analytics
  async getEmailUsage(): Promise<EmailUsage[]> {
    const { data, error } = await supabase
      .from('tenant_email_usage')
      .select('*')
      .order('month_year', { ascending: false })
      .limit(12) // Last 12 months

    if (error) {
      throw new Error(`Failed to fetch email usage: ${error.message}`)
    }

    return data || []
  }

  async getCurrentMonthUsage(): Promise<EmailUsage | null> {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

    const { data, error } = await supabase
      .from('tenant_email_usage')
      .select('*')
      .eq('month_year', currentMonth)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to fetch current usage: ${error.message}`)
    }

    return data || null
  }

  async getSystemHealth(): Promise<EmailSystemHealth[]> {
    const { data, error } = await supabase
      .rpc('get_email_system_health')

    if (error) {
      throw new Error(`Failed to fetch system health: ${error.message}`)
    }

    return data || []
  }

  // Email suppression management
  async suppressEmail(email: string, reason: string): Promise<void> {
    const { error } = await supabase
      .rpc('suppress_email', {
        p_email: email,
        p_reason: reason,
        p_source: 'manual'
      })

    if (error) {
      throw new Error(`Failed to suppress email: ${error.message}`)
    }
  }

  async isEmailSuppressed(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('is_email_suppressed', {
        p_email: email
      })

    if (error) {
      throw new Error(`Failed to check suppression: ${error.message}`)
    }

    return data || false
  }

  async getSuppressionList(): Promise<Array<{ email_address: string; reason: string; created_at: string }>> {
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email_address, reason, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch suppression list: ${error.message}`)
    }

    return data || []
  }

  // Email queue management
  async getEmailQueue(status?: 'pending' | 'processing' | 'sent' | 'failed', limit: number = 100): Promise<any[]> {
    let query = supabase
      .from('email_queue')
      .select(`
        id,
        to_email,
        subject,
        status,
        priority,
        retry_count,
        scheduled_at,
        created_at,
        sent_at,
        error_message
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch email queue: ${error.message}`)
    }

    return data || []
  }

  async retryFailedEmail(queueId: string): Promise<void> {
    const { error } = await supabase
      .from('email_queue')
      .update({
        status: 'pending',
        retry_count: 0,
        next_retry_at: null,
        error_message: null,
        scheduled_at: new Date().toISOString()
      })
      .eq('id', queueId)

    if (error) {
      throw new Error(`Failed to retry email: ${error.message}`)
    }
  }

  async cancelScheduledEmail(queueId: string): Promise<void> {
    const { error } = await supabase
      .from('email_queue')
      .update({
        status: 'cancelled'
      })
      .eq('id', queueId)
      .eq('status', 'pending') // Only cancel pending emails

    if (error) {
      throw new Error(`Failed to cancel email: ${error.message}`)
    }
  }

  // Utility methods
  async processEmailQueue(batchSize: number = 10): Promise<{ success: boolean; processed_count: number }> {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-email-queue?batch_size=${batchSize}`
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error('Authentication required')
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to process email queue: ${response.statusText}`)
    }

    return await response.json()
  }

  // Template rendering utility
  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<{ subject: string; html: string; text: string }> {
    const { data: template, error } = await supabase
      .from('email_template_versions')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single()

    if (error) {
      throw new Error(`Failed to fetch template: ${error.message}`)
    }

    if (!template) {
      throw new Error('Template not found')
    }

    let subject = template.subject_template
    let html = template.html_template || ''
    let text = template.text_template || ''

    // Simple variable replacement
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      const stringValue = String(value)
      
      subject = subject.replace(regex, stringValue)
      html = html.replace(regex, stringValue)
      text = text.replace(regex, stringValue)
    })

    return { subject, html, text }
  }
}

// Export singleton instance
export const emailService = new EmailService()
export default emailService