import { supabase } from '../../supabaseClient'
import { v4 as uuidv4 } from 'uuid'

interface PortalToken {
  id: string
  job_id: string
  customer_id: string
  token: string
  expires_at: string
  created_at: string
  last_accessed: string | null
  access_count: number
  is_active: boolean
}

interface PortalActivity {
  id: string
  portal_token_id: string
  activity_type: 'login' | 'view_job' | 'view_estimate' | 'view_invoice' | 'payment_attempt' | 'document_download' | 'message_sent'
  page_visited?: string
  duration_seconds?: number
  ip_address?: string
  user_agent?: string
  metadata?: any
  created_at: string
}

export class ClientPortalService {
  
  /**
   * Generate a secure portal token for a job
   */
  static async generatePortalToken(jobId: string, customerId: string, tenantId: string): Promise<PortalToken | null> {
    try {
      // Generate a cryptographically secure token
      const token = uuidv4() + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9)
      
      // Set expiration to 90 days from now
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 90)

      const { data, error } = await supabase
        .from('client_portal_tokens')
        .insert({
          job_id: jobId,
          customer_id: customerId,
          contact_id: customerId, // Also set contact_id for backward compatibility
          tenant_id: tenantId,
          token: token,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          access_count: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error generating portal token:', error)
      return null
    }
  }

  /**
   * Auto-generate portal token when job is created and send welcome SMS
   */
  static async autoGeneratePortalForJob(jobId: string): Promise<boolean> {
    try {
      // Get job details with customer information
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          accounts:account_id(name, phone, email),
          contacts:contact_id(first_name, last_name, phone, email)
        `)
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        console.error('Job not found for portal generation:', jobError)
        return false
      }

      // Determine customer ID (contact or account)
      const customerId = job.contact_id || job.account_id
      const customerName = job.contacts?.first_name 
        ? `${job.contacts.first_name} ${job.contacts.last_name || ''}`.trim()
        : job.accounts?.name || 'Valued Customer'
      
      const customerPhone = job.contacts?.phone || job.accounts?.phone
      const customerEmail = job.contacts?.email || job.accounts?.email

      if (!customerId || !customerPhone) {
        console.error('Missing customer information for portal generation')
        return false
      }

      // Check if portal token already exists for this job
      const { data: existingToken } = await supabase
        .from('client_portal_tokens')
        .select('id, token')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .single()

      let portalToken = existingToken

      // Generate new token if none exists
      if (!existingToken) {
        portalToken = await this.generatePortalToken(jobId, customerId, job.tenant_id)
        if (!portalToken) return false
      }

      // Generate portal URL 
      const baseUrl = window.location.origin
      const portalUrl = `${baseUrl}/portal/${portalToken?.token}`
      const companyName = job.accounts?.name || 'TradeWorks Pro'

      // Send welcome SMS with portal link
      const smsMessage = `Hi ${customerName}! Here is your private portal for your ${job.service_type || 'service'} with ${companyName}: ${portalUrl}. Track progress, view invoices, and communicate with us securely. Questions? Call (312) 680-5945 or visit tradeworkspro.com`

      const { error: smsError } = await supabase.functions.invoke('send-sms', {
        body: {
          to: customerPhone,
          body: smsMessage,
          tenant_id: job.tenant_id
        }
      })

      if (smsError) {
        console.error('Error sending portal SMS:', smsError)
        // Don't fail the entire process if SMS fails
      }

      // Send welcome email if email available
      if (customerEmail) {
        const emailSubject = `Your Private Portal - ${companyName}`
        const emailBody = `
          <h2>Welcome to Your Private Customer Portal</h2>
          <p>Hi ${customerName},</p>
          <p>We've created a secure portal where you can:</p>
          <ul>
            <li>Track real-time progress on your ${job.service_type || 'service'}</li>
            <li>View and approve estimates</li>
            <li>See invoices and make payments</li>
            <li>Communicate directly with our team</li>
            <li>Access all project documents</li>
          </ul>
          <p><a href="${portalUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Your Portal</a></p>
          <p>Your portal link: <a href="${portalUrl}">${portalUrl}</a></p>
          <p>Questions? Call us at (312) 680-5945 or visit <a href="https://tradeworkspro.com">tradeworkspro.com</a></p>
          <p>Best regards,<br>${companyName}</p>
        `

        await supabase.functions.invoke('send-email', {
          body: {
            to: customerEmail,
            subject: emailSubject,
            html: emailBody,
            tenant_id: job.tenant_id
          }
        })
      }

      // Log the portal creation activity
      if (portalToken?.id) {
        await this.logPortalActivity(portalToken.id, 'login', {
          activity_description: 'Portal token generated and welcome message sent',
          customer_name: customerName,
          job_id: jobId
        })
      }

      return true
    } catch (error) {
      console.error('Error in auto-generating portal:', error)
      return false
    }
  }

  /**
   * Validate portal token and return job access
   */
  static async validatePortalAccess(token: string): Promise<any | null> {
    try {
      const { data: portalToken, error } = await supabase
        .from('client_portal_tokens')
        .select(`
          *,
          jobs:job_id(
            *,
            accounts:account_id(name, phone, email),
            contacts:contact_id(first_name, last_name, phone, email)
          )
        `)
        .eq('token', token)
        .eq('is_active', true)
        .single()

      if (error || !portalToken) {
        return null
      }

      // Check if token is expired
      if (new Date(portalToken.expires_at) < new Date()) {
        return null
      }

      // Update access count and last accessed
      await supabase
        .from('client_portal_tokens')
        .update({
          access_count: portalToken.access_count + 1,
          last_accessed: new Date().toISOString()
        })
        .eq('id', portalToken.id)

      // Log portal access
      await this.logPortalActivity(portalToken.id, 'login', {
        ip_address: this.getClientIP(),
        user_agent: navigator.userAgent
      })

      return portalToken
    } catch (error) {
      console.error('Error validating portal access:', error)
      return null
    }
  }

  /**
   * Log customer portal activity
   */
  static async logPortalActivity(
    portalTokenId: string, 
    activityType: PortalActivity['activity_type'], 
    metadata: any = {}
  ): Promise<void> {
    try {
      // Get the tenant_id from the portal token
      const { data: tokenData } = await supabase
        .from('client_portal_tokens')
        .select('tenant_id')
        .eq('id', portalTokenId)
        .single()

      if (!tokenData?.tenant_id) {
        console.warn('Could not get tenant_id for portal activity logging')
        return
      }

      await supabase
        .from('portal_activity_log')
        .insert({
          portal_token_id: portalTokenId,
          tenant_id: tokenData.tenant_id,
          activity_type: activityType,
          page_visited: typeof window !== 'undefined' ? window.location.pathname : undefined,
          ip_address: this.getClientIP(),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging portal activity:', error)
    }
  }

  /**
   * Get portal analytics for a job
   */
  static async getPortalAnalytics(jobId: string): Promise<any> {
    try {
      // Get portal token info
      const { data: token } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('job_id', jobId)
        .single()

      if (!token) return null

      // Get activity summary
      const { data: activities } = await supabase
        .from('portal_activity_log')
        .select('*')
        .eq('portal_token_id', token.id)
        .order('created_at', { ascending: false })

      // Calculate engagement metrics
      const totalVisits = activities?.length || 0
      const uniqueDays = new Set(activities?.map(a => a.created_at.split('T')[0])).size
      const lastAccess = token.last_accessed ? new Date(token.last_accessed) : null
      const isActive = lastAccess && (Date.now() - lastAccess.getTime()) < (7 * 24 * 60 * 60 * 1000) // Active if accessed in last 7 days

      const activityBreakdown = activities?.reduce((acc, activity) => {
        acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return {
        token,
        totalVisits,
        uniqueDays,
        lastAccess,
        isActive,
        activityBreakdown,
        recentActivities: activities?.slice(0, 10) || []
      }
    } catch (error) {
      console.error('Error getting portal analytics:', error)
      return null
    }
  }

  /**
   * Deactivate portal token
   */
  static async deactivatePortalToken(tokenId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('client_portal_tokens')
        .update({ is_active: false })
        .eq('id', tokenId)

      return !error
    } catch (error) {
      console.error('Error deactivating portal token:', error)
      return false
    }
  }

  /**
   * Get client IP address (best effort)
   */
  private static getClientIP(): string {
    // This is a simplified approach - in production you might use a service
    return 'unknown'
  }

  /**
   * Generate branded portal URL with custom subdomain
   */
  static generateBrandedPortalUrl(token: string, companySlug?: string): string {
    const baseUrl = window.location.origin
    
    if (companySlug && process.env.NODE_ENV === 'production') {
      // In production, could use subdomains like: https://portal.mikesplumbing.com/123-abc-def
      return `https://portal.${companySlug}.tradeworkspro.com/${token}`
    }
    
    // Development/fallback URL
    return `${baseUrl}/portal/${token}`
  }

  /**
   * Send portal reminder if customer hasn't accessed recently
   */
  static async sendPortalReminder(jobId: string): Promise<boolean> {
    try {
      const analytics = await this.getPortalAnalytics(jobId)
      
      if (!analytics || analytics.isActive) {
        return false // Already active, no reminder needed
      }

      // Get job details for messaging
      const { data: job } = await supabase
        .from('jobs')
        .select(`
          *,
          contacts:contact_id(first_name, last_name, phone),
          accounts:account_id(name)
        `)
        .eq('id', jobId)
        .single()

      if (!job?.contacts?.phone) return false

      const customerName = `${job.contacts.first_name} ${job.contacts.last_name || ''}`.trim()
      const portalUrl = this.generateBrandedPortalUrl(analytics.token.token)
      const companyName = job.accounts?.name || 'TradeWorks Pro'

      const reminderMessage = `Hi ${customerName}! Don't forget to check your project portal for updates on your ${job.service_type}: ${portalUrl} - ${companyName}`

      const { error } = await supabase.functions.invoke('send-sms', {
        body: {
          to: job.contacts.phone,
          body: reminderMessage
        }
      })

      if (!error) {
        await this.logPortalActivity(analytics.token.id, 'message_sent', {
          message_type: 'reminder',
          reminder_reason: 'inactive_portal'
        })
      }

      return !error
    } catch (error) {
      console.error('Error sending portal reminder:', error)
      return false
    }
  }
}

export default ClientPortalService