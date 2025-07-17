import { supabase } from '../../supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import { attomDataService } from './attomDataService'

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
          account:accounts!account_id(id, name, phone, email),
          contact:contacts!contact_id(id, first_name, last_name, phone, email)
        `)
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        console.error('Job not found for portal generation:', jobError)
        return false
      }

      // Determine customer ID and details (prefer contact over account)
      const customerId = job.contact_id || job.account_id
      const customerName = job.contact?.first_name 
        ? `${job.contact.first_name} ${job.contact.last_name || ''}`.trim()
        : job.account?.name || 'Valued Customer'
      
      const customerPhone = job.contact?.phone || job.account?.phone
      const customerEmail = job.contact?.email || job.account?.email

      if (!customerId || !customerPhone) {
        console.error('Missing customer information for portal generation:', {
          customerId,
          customerPhone,
          hasContact: !!job.contact,
          hasAccount: !!job.account,
          contactPhone: job.contact?.phone,
          accountPhone: job.account?.phone
        })
        return false
      }

      // Check if portal token already exists for this job
      const { data: existingToken, error: existingError } = await supabase
        .from('client_portal_tokens')
        .select('id, token')
        .eq('job_id', jobId)
        .eq('is_active', true)
        .maybeSingle()
      
      if (existingError) {
        console.warn('Error checking existing tokens:', existingError)
      }

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

      // 🏠 AUTOMATICALLY FETCH PROPERTY DATA when portal is created
      if (job.location_address && job.tenant_id) {
        try {
          console.log('🏠 Auto-fetching property data for portal creation:', job.location_address)
          
          // Fetch property data in the background (don't wait for it to complete)
          attomDataService.getPropertyDataWithCache(
            job.location_address,
            job.location_city,
            job.location_state,
            job.tenant_id
          ).then(() => {
            console.log('✅ Property data fetched and cached for job:', jobId)
          }).catch((error) => {
            console.warn('⚠️ Property data fetch failed (non-critical):', error.message)
          })
        } catch (error) {
          console.warn('⚠️ Failed to initiate property data fetch:', error)
        }
      } else {
        console.log('ℹ️ No property address available for Attom data fetch')
      }

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
      if (portalToken?.id && job.tenant_id) {
        await this.logPortalActivity(portalToken.id, 'login', job.tenant_id, {
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
      // First, use the RPC function to validate the token (bypasses RLS)
      const { data: tokenData, error: rpcError } = await supabase
        .rpc('validate_portal_token', { token_string: token })
        .single() as { data: {
          token_id: string;
          job_id: string;
          customer_id: string;
          tenant_id: string;
          is_valid: boolean;
        } | null; error: any }

      if (rpcError || !tokenData || !tokenData.is_valid) {
        console.error('Portal token validation failed:', rpcError)
        return null
      }

      // Now fetch the job data using the validated job_id
      // This should work because we have a valid token
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          accounts:account_id(name, phone, email),
          contacts:contact_id(first_name, last_name, phone, email)
        `)
        .eq('id', tokenData.job_id)
        .single()

      if (jobError || !jobData) {
        console.error('Failed to fetch job data:', jobError)
        return null
      }

      // Log portal access - pass tenant_id directly since we already have it
      await this.logPortalActivity(tokenData.token_id, 'login', tokenData.tenant_id, {
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      })

      // Return the complete portal data
      return {
        token_id: tokenData.token_id,
        customer_id: tokenData.customer_id,
        tenant_id: tokenData.tenant_id,
        jobs: jobData
      }
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
    tenantId: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      console.log('🔍 logPortalActivity called with:', {
        portalTokenId,
        activityType,
        tenantId,
        metadata
      })
      
      const insertData = {
        portal_token_id: portalTokenId,
        tenant_id: tenantId,
        activity_type: activityType,
        page_visited: typeof window !== 'undefined' ? window.location.pathname : undefined,
        ip_address: this.getClientIP(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        metadata: metadata,
        created_at: new Date().toISOString()
      }
      
      console.log('🔍 Inserting portal activity:', insertData)
      
      const { data, error } = await supabase
        .from('portal_activity_log')
        .insert(insertData)
        .select()
        
      if (error) {
        console.error('❌ Portal activity insert error:', error)
      } else {
        console.log('✅ Portal activity inserted:', data)
      }
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
    // Return a valid IP address format for the inet column type
    return '0.0.0.0'
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

      if (!error && job.tenant_id) {
        await this.logPortalActivity(analytics.token.id, 'message_sent', job.tenant_id, {
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