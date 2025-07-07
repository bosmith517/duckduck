import { supabase } from '../../supabaseClient';

export interface TeamMember {
  id?: string;
  tenant_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  role: 'admin' | 'agent' | 'viewer' | 'manager' | 'supervisor' | 'technician' | 'subcontractor' | 'field_worker' | 'dispatcher' | 'estimator' | 'sales' | 'customer_service' | 'accounting' | 'marketing';
  department?: string;
  avatar_url?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMemberInvite {
  email: string;
  role: 'admin' | 'agent' | 'viewer' | 'manager' | 'supervisor' | 'technician' | 'subcontractor' | 'field_worker' | 'dispatcher' | 'estimator' | 'sales' | 'customer_service' | 'accounting' | 'marketing';
  full_name: string;
  phone?: string;
  department?: string;
}

class TeamMemberService {
  /**
   * Get all team members for the current tenant
   */
  async getTeamMembers(): Promise<{ data: TeamMember[] | null; error: any }> {
    try {
      console.log('TeamMemberService: Getting team members...');
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);
      if (!user) throw new Error('Not authenticated');

      // Get the current user's tenant_id
      const { data: currentUserProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      console.log('Current user profile:', { currentUserProfile, profileError });

      if (!currentUserProfile?.tenant_id) {
        throw new Error('No tenant found for current user');
      }

      // First, let's check if the view exists and is accessible
      console.log('Fetching from v_team_members for tenant:', currentUserProfile.tenant_id);
      
      // Try the view first
      let { data, error } = await supabase
        .from('v_team_members')
        .select('*')
        .eq('tenant_id', currentUserProfile.tenant_id)
        .order('created_at', { ascending: false });

      console.log('v_team_members result:', { data, error });

      // If view fails, try direct table access
      if (error) {
        console.log('View failed, trying direct user_profiles table...');
        const result = await supabase
          .from('user_profiles')
          .select('*')
          .eq('tenant_id', currentUserProfile.tenant_id)
          .order('created_at', { ascending: false });
        
        data = result.data;
        error = result.error;
        console.log('user_profiles result:', { data, error });
      }

      return { data, error };
    } catch (error) {
      console.error('TeamMemberService error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get a single team member by ID
   */
  async getTeamMember(id: string): Promise<{ data: TeamMember | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Check if an email can be added to the current tenant
   */
  async canAddEmailToTenant(email: string): Promise<{ canAdd: boolean; reason: string; existingUser?: any; existingTenant?: string }> {
    try {
      const { data, error } = await supabase.rpc('can_add_email_to_tenant', {
        p_email: email
      });

      if (error) throw error;

      return {
        canAdd: data.can_add,
        reason: data.reason,
        existingUser: data.existing_user,
        existingTenant: data.existing_tenant
      };
    } catch (error) {
      console.error('Error checking email availability:', error);
      return {
        canAdd: false,
        reason: 'Error checking email availability'
      };
    }
  }

  /**
   * Create a new team member
   * This creates a user profile record without creating an auth user (to avoid rate limits)
   * The user will need to be invited separately via email to create their auth account
   */
  async createTeamMember(member: TeamMemberInvite): Promise<{ data: TeamMember | null; error: any }> {
    try {
      // First check if the email can be added to this tenant
      const emailCheck = await this.canAddEmailToTenant(member.email);
      if (!emailCheck.canAdd) {
        throw new Error(emailCheck.reason);
      }

      // Split full_name into first_name and last_name for compatibility
      const nameParts = member.full_name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Use the database function to create team member with proper tenant association
      const { data, error } = await supabase.rpc('create_team_member', {
        p_email: member.email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_role: member.role,
        p_phone: member.phone || null,
        p_department: member.department || null,
        p_employee_id: null,
        p_hourly_rate: null,
        p_salary: null
      });

      if (error) throw error;

      // Get the created profile to return
      const { data: profileData, error: fetchError } = await supabase
        .from('v_team_members')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        // Fallback to regular user_profiles table
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data)
          .single();
        
        if (fallbackError) throw fallbackError;
        return { data: fallbackData, error: null };
      }

      console.log('Team member created successfully:', profileData);
      
      return { data: profileData, error: null };
    } catch (error) {
      console.error('Error creating team member:', error);
      return { data: null, error };
    }
  }

  /**
   * Send invitation to a team member to complete their account setup
   */
  async inviteTeamMember(profileId: string, message?: string): Promise<{ data: any; error: any }> {
    try {
      const { data, error } = await supabase.rpc('invite_team_member', {
        p_profile_id: profileId,
        p_invitation_message: message || 'You have been invited to join our team!'
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Error sending team member invitation:', error);
      return { data: null, error };
    }
  }

  /**
   * Update an existing team member
   */
  async updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<{ data: TeamMember | null; error: any }> {
    try {
      // Remove fields that shouldn't be updated
      const { id: _, tenant_id, created_at, full_name, ...updateData } = updates;

      // If full_name is provided, split it into first_name and last_name
      let finalUpdateData: any = { ...updateData };
      if (full_name) {
        const nameParts = full_name.trim().split(' ');
        finalUpdateData.first_name = nameParts[0] || '';
        finalUpdateData.last_name = nameParts.slice(1).join(' ') || '';
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          ...finalUpdateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Deactivate a team member (soft delete)
   */
  async deactivateTeamMember(id: string): Promise<{ data: TeamMember | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      // TODO: Also disable auth user

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Reactivate a team member
   */
  async reactivateTeamMember(id: string): Promise<{ data: TeamMember | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      // TODO: Also re-enable auth user

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update team member role
   */
  async updateTeamMemberRole(id: string, role: 'admin' | 'agent' | 'viewer' | 'manager' | 'supervisor' | 'technician' | 'subcontractor' | 'field_worker' | 'dispatcher' | 'estimator' | 'sales' | 'customer_service' | 'accounting' | 'marketing'): Promise<{ data: TeamMember | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      // TODO: Update auth metadata as well

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Generate a temporary password for new users
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Search team members by name or email
   */
  async searchTeamMembers(query: string): Promise<{ data: TeamMember[] | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the current user's tenant_id
      const { data: currentUserProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!currentUserProfile?.tenant_id) {
        throw new Error('No tenant found for current user');
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', currentUserProfile.tenant_id)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('first_name, last_name');

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export const teamMemberService = new TeamMemberService();