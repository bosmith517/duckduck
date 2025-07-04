import { supabase } from '../../supabaseClient'

export interface SubcontractorCompany {
  id: string
  parent_tenant_id: string
  company_name: string
  contact_name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  trade_specialties: string[]
  license_number?: string
  insurance_expiry?: string
  hourly_rates: Record<string, number>
  subscription_tier: 'free' | 'basic' | 'pro' | 'enterprise'
  signup_token?: string
  signup_completed: boolean
  active: boolean
  invited_at: string
  signup_completed_at?: string
  created_at: string
  updated_at: string
}

export interface SubcontractorUser {
  id: string
  user_id: string
  subcontractor_company_id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  role: 'owner' | 'manager' | 'worker'
  trade_specialties: string[]
  hourly_rate?: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface SubcontractorJobAssignment {
  id: string
  job_id: string
  subcontractor_company_id: string
  assigned_user_id?: string
  assignment_type: 'company' | 'individual'
  trade?: string
  hourly_rate?: number
  estimated_hours?: number
  start_date?: string
  end_date?: string
  status: 'invited' | 'accepted' | 'declined' | 'in_progress' | 'completed' | 'cancelled'
  invitation_message?: string
  response_message?: string
  invited_at: string
  responded_at?: string
  created_at: string
  updated_at: string
  job?: {
    title: string
    location_address?: string
    description?: string
  }
  subcontractor_company?: SubcontractorCompany
}

export class SubcontractorService {
  static async getSubcontractors(tenantId: string): Promise<SubcontractorCompany[]> {
    try {
      const { data, error } = await supabase
        .from('subcontractor_companies')
        .select('*')
        .eq('parent_tenant_id', tenantId)
        .eq('active', true)
        .order('company_name', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
      throw error
    }
  }

  static async inviteSubcontractor(inviteData: {
    company_name: string
    contact_name: string
    email: string
    phone?: string
    trade_specialties: string[]
    estimated_hourly_rates?: Record<string, number>
    invitation_message?: string
  }): Promise<SubcontractorCompany> {
    try {
      // Get user's tenant ID
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('No tenant found for user')
      }

      // Generate unique signup token
      const signupToken = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const { data, error } = await supabase
        .from('subcontractor_companies')
        .insert({
          ...inviteData,
          parent_tenant_id: userProfile.tenant_id,
          signup_token: signupToken,
          hourly_rates: inviteData.estimated_hourly_rates || {},
          subscription_tier: 'free'
        })
        .select()
        .single()

      if (error) throw error

      // Here you would send invitation email with signup link
      // For now, we'll just log the invitation details
      console.log('Subcontractor invitation created:', {
        company: data,
        signupUrl: `${window.location.origin}/subcontractor-signup/${signupToken}`,
        message: inviteData.invitation_message
      })

      return data
    } catch (error) {
      console.error('Error inviting subcontractor:', error)
      throw error
    }
  }

  static async getJobAssignments(tenantId: string): Promise<SubcontractorJobAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('subcontractor_job_assignments')
        .select(`
          *,
          job:jobs(title, location_address, description),
          subcontractor_company:subcontractor_companies(company_name, contact_name, email)
        `)
        .eq('job_id', 
          // Get jobs for this tenant
          supabase
            .from('jobs')
            .select('id')
            .eq('tenant_id', tenantId)
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching job assignments:', error)
      throw error
    }
  }

  static async assignSubcontractorToJob(assignmentData: {
    job_id: string
    subcontractor_company_id: string
    assigned_user_id?: string
    assignment_type: 'company' | 'individual'
    trade?: string
    hourly_rate?: number
    estimated_hours?: number
    start_date?: string
    end_date?: string
    invitation_message?: string
  }): Promise<SubcontractorJobAssignment> {
    try {
      const { data, error } = await supabase
        .from('subcontractor_job_assignments')
        .insert({
          ...assignmentData,
          status: 'invited'
        })
        .select(`
          *,
          job:jobs(title, location_address, description),
          subcontractor_company:subcontractor_companies(company_name, contact_name, email)
        `)
        .single()

      if (error) throw error

      // Here you would send notification to subcontractor
      console.log('Job assignment created:', data)

      return data
    } catch (error) {
      console.error('Error assigning subcontractor to job:', error)
      throw error
    }
  }

  static async respondToJobAssignment(
    assignmentId: string,
    response: 'accepted' | 'declined',
    responseMessage?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('subcontractor_job_assignments')
        .update({
          status: response,
          response_message: responseMessage,
          responded_at: new Date().toISOString()
        })
        .eq('id', assignmentId)

      if (error) throw error
    } catch (error) {
      console.error('Error responding to job assignment:', error)
      throw error
    }
  }

  static async updateAssignmentStatus(
    assignmentId: string,
    status: 'in_progress' | 'completed' | 'cancelled'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('subcontractor_job_assignments')
        .update({ status })
        .eq('id', assignmentId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating assignment status:', error)
      throw error
    }
  }

  // Subcontractor signup methods
  static async validateSignupToken(token: string): Promise<SubcontractorCompany | null> {
    try {
      const { data, error } = await supabase
        .from('subcontractor_companies')
        .select('*')
        .eq('signup_token', token)
        .eq('signup_completed', false)
        .single()

      if (error || !data) return null
      return data
    } catch (error) {
      console.error('Error validating signup token:', error)
      return null
    }
  }

  static async completeSubcontractorSignup(
    token: string,
    signupData: {
      user_id: string
      first_name: string
      last_name: string
      phone?: string
      role: 'owner' | 'manager'
      trade_specialties: string[]
      hourly_rate?: number
    }
  ): Promise<void> {
    try {
      // Get subcontractor company by token
      const { data: company, error: companyError } = await supabase
        .from('subcontractor_companies')
        .select('*')
        .eq('signup_token', token)
        .eq('signup_completed', false)
        .single()

      if (companyError || !company) {
        throw new Error('Invalid or expired signup token')
      }

      // Create subcontractor user
      const { error: userError } = await supabase
        .from('subcontractor_users')
        .insert({
          ...signupData,
          subcontractor_company_id: company.id,
          email: company.email
        })

      if (userError) throw userError

      // Mark signup as completed
      const { error: updateError } = await supabase
        .from('subcontractor_companies')
        .update({
          signup_completed: true,
          signup_completed_at: new Date().toISOString(),
          signup_token: null // Remove token after use
        })
        .eq('id', company.id)

      if (updateError) throw updateError

    } catch (error) {
      console.error('Error completing subcontractor signup:', error)
      throw error
    }
  }

  // Free tier restrictions
  static async checkFreetierLimitations(subcontractorCompanyId: string): Promise<{
    canAddCustomers: boolean
    canUseAdvancedFeatures: boolean
    canCreateJobs: boolean
    maxUsers: number
    currentUsers: number
  }> {
    try {
      const { data: company, error: companyError } = await supabase
        .from('subcontractor_companies')
        .select('subscription_tier')
        .eq('id', subcontractorCompanyId)
        .single()

      if (companyError) throw companyError

      const { data: users, error: usersError } = await supabase
        .from('subcontractor_users')
        .select('id')
        .eq('subcontractor_company_id', subcontractorCompanyId)
        .eq('active', true)

      if (usersError) throw usersError

      const isFree = company.subscription_tier === 'free'

      return {
        canAddCustomers: !isFree,
        canUseAdvancedFeatures: !isFree,
        canCreateJobs: !isFree,
        maxUsers: isFree ? 2 : 999,
        currentUsers: users?.length || 0
      }
    } catch (error) {
      console.error('Error checking free tier limitations:', error)
      throw error
    }
  }

  static generateSignupUrl(token: string): string {
    return `${window.location.origin}/subcontractor-signup/${token}`
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }
}