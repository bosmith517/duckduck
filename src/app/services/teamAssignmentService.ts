import { supabase } from '../../supabaseClient'
import { WorkflowAutomationService } from './workflowAutomationService'

export interface JobTeamAssignment {
  id: string
  job_id: string
  tenant_id: string
  user_id?: string
  role: string
  trade?: string
  assignment_type: 'internal' | 'subcontractor'
  hourly_rate?: number
  status: 'assigned' | 'active' | 'completed' | 'removed'
  start_date?: string
  end_date?: string
  contractor_name?: string
  contractor_contact?: string
  contractor_license?: string
  created_at: string
  updated_at: string
  user_profile?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  job?: {
    id: string
    title: string
  }
}

export interface JobMaterialOrder {
  id: string
  job_id: string
  tenant_id: string
  order_number?: string
  vendor_name: string
  vendor_contact?: string
  status: 'pending' | 'ordered' | 'partial' | 'delivered' | 'cancelled'
  order_date?: string
  expected_delivery?: string
  actual_delivery?: string
  order_total?: number
  tax_amount?: number
  delivery_fee?: number
  items: MaterialOrderItem[]
  purchase_order_url?: string
  delivery_receipt_url?: string
  notes?: string
  created_at: string
  updated_at: string
  job?: {
    id: string
    title: string
  }
}

export interface MaterialOrderItem {
  id?: string
  item_name: string
  description?: string
  quantity: number
  unit_price: number
  total_price: number
  vendor_sku?: string
  category?: string
  delivery_status?: 'pending' | 'delivered' | 'backordered'
}

export interface TeamRole {
  role: string
  trade?: string
  description: string
  required_skills?: string[]
  typical_hourly_rate?: number
}

export class TeamAssignmentService {
  // Standard team roles for different trades
  private static TEAM_ROLES: TeamRole[] = [
    {
      role: 'project_manager',
      description: 'Overall project coordination and management',
      required_skills: ['project_management', 'communication', 'scheduling'],
      typical_hourly_rate: 75
    },
    {
      role: 'lead_tech',
      description: 'Lead technician and crew supervisor',
      required_skills: ['leadership', 'technical_expertise', 'troubleshooting'],
      typical_hourly_rate: 65
    },
    {
      role: 'electrician',
      trade: 'electrical',
      description: 'Licensed electrician for electrical work',
      required_skills: ['electrical_license', 'wiring', 'troubleshooting'],
      typical_hourly_rate: 55
    },
    {
      role: 'plumber',
      trade: 'plumbing',
      description: 'Licensed plumber for plumbing work',
      required_skills: ['plumbing_license', 'pipe_fitting', 'water_systems'],
      typical_hourly_rate: 55
    },
    {
      role: 'hvac_tech',
      trade: 'hvac',
      description: 'HVAC technician for heating and cooling systems',
      required_skills: ['hvac_certification', 'refrigeration', 'ductwork'],
      typical_hourly_rate: 50
    },
    {
      role: 'helper',
      description: 'General helper and apprentice',
      required_skills: ['physical_labor', 'tool_handling', 'safety'],
      typical_hourly_rate: 25
    },
    {
      role: 'apprentice',
      description: 'Apprentice learning the trade',
      required_skills: ['willingness_to_learn', 'basic_tools', 'safety'],
      typical_hourly_rate: 20
    }
  ]

  static async getTeamAssignmentsForJob(jobId: string): Promise<JobTeamAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('job_team_assignments')
        .select(`
          *,
          user_profile:user_profiles(id, first_name, last_name, email)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching team assignments:', error)
      throw error
    }
  }

  static async getAllTeamAssignments(tenantId: string): Promise<JobTeamAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('job_team_assignments')
        .select(`
          *,
          user_profile:user_profiles(id, first_name, last_name, email),
          job:jobs(title)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching all team assignments:', error)
      throw error
    }
  }

  static async assignTeamMember(assignmentData: {
    job_id: string
    user_id?: string
    role: string
    trade?: string
    assignment_type: 'internal' | 'subcontractor'
    hourly_rate?: number
    start_date?: string
    contractor_name?: string
    contractor_contact?: string
    contractor_license?: string
  }): Promise<JobTeamAssignment> {
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

      const { data, error } = await supabase
        .from('job_team_assignments')
        .insert({
          ...assignmentData,
          tenant_id: userProfile.tenant_id,
          status: 'assigned'
        })
        .select(`
          *,
          user_profile:user_profiles(id, first_name, last_name, email)
        `)
        .single()

      if (error) throw error

      // Trigger workflow automation for new team assignments
      try {
        await WorkflowAutomationService.triggerWorkflow(
          'team_assignment',
          data.id,
          'created',
          {
            job_id: assignmentData.job_id,
            user_id: assignmentData.user_id,
            role: assignmentData.role,
            trade: assignmentData.trade,
            assignment_type: assignmentData.assignment_type,
            start_date: assignmentData.start_date,
            contractor_name: assignmentData.contractor_name,
            assigned_at: new Date().toISOString()
          }
        )
      } catch (workflowError) {
        console.warn('Workflow automation trigger failed:', workflowError)
        // Don't fail the assignment if workflow automation fails
      }

      return data
    } catch (error) {
      console.error('Error assigning team member:', error)
      throw error
    }
  }

  static async updateAssignmentStatus(
    assignmentId: string,
    status: 'assigned' | 'active' | 'completed' | 'removed',
    endDate?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (endDate) {
        updateData.end_date = endDate
      }

      const { error } = await supabase
        .from('job_team_assignments')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating assignment status:', error)
      throw error
    }
  }

  static async getAvailableTeamMembers(tenantId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, email, role_name')
        .eq('tenant_id', tenantId)
        .in('role_name', ['technician', 'admin', 'owner'])
        .order('first_name', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching team members:', error)
      throw error
    }
  }

  static async getActiveAssignments(tenantId: string): Promise<JobTeamAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('job_team_assignments')
        .select(`
          *,
          user_profile:user_profiles(id, first_name, last_name, email),
          jobs:job_id(id, title, status, location_address)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['assigned', 'active'])
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching active assignments:', error)
      throw error
    }
  }

  static getAvailableRoles(): TeamRole[] {
    return this.TEAM_ROLES
  }

  static getRolesByTrade(trade: string): TeamRole[] {
    return this.TEAM_ROLES.filter(role => !role.trade || role.trade === trade)
  }
}

export class MaterialOrderService {
  static async getMaterialOrdersForJob(jobId: string): Promise<JobMaterialOrder[]> {
    try {
      const { data, error } = await supabase
        .from('job_material_orders')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching material orders:', error)
      throw error
    }
  }

  static async getAllMaterialOrders(tenantId: string): Promise<JobMaterialOrder[]> {
    try {
      const { data, error } = await supabase
        .from('job_material_orders')
        .select(`
          *,
          job:jobs(title)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching all material orders:', error)
      throw error
    }
  }

  static async createMaterialOrder(orderData: {
    job_id: string
    vendor_name: string
    vendor_contact?: string
    expected_delivery?: string
    items: MaterialOrderItem[]
    notes?: string
  }): Promise<JobMaterialOrder> {
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

      // Calculate totals
      const orderTotal = orderData.items.reduce((sum, item) => sum + item.total_price, 0)
      
      // Generate order number
      const orderNumber = `PO-${Date.now()}`

      const { data, error } = await supabase
        .from('job_material_orders')
        .insert({
          ...orderData,
          tenant_id: userProfile.tenant_id,
          order_number: orderNumber,
          order_total: orderTotal,
          status: 'pending',
          order_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error creating material order:', error)
      throw error
    }
  }

  static async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'ordered' | 'partial' | 'delivered' | 'cancelled',
    actualDelivery?: string,
    notes?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      if (actualDelivery) {
        updateData.actual_delivery = actualDelivery
      }

      if (notes) {
        updateData.notes = notes
      }

      const { error } = await supabase
        .from('job_material_orders')
        .update(updateData)
        .eq('id', orderId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating order status:', error)
      throw error
    }
  }

  static async getOrdersByStatus(
    tenantId: string,
    status: string
  ): Promise<JobMaterialOrder[]> {
    try {
      const { data, error } = await supabase
        .from('job_material_orders')
        .select(`
          *,
          jobs:job_id(id, title, location_address)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', status)
        .order('order_date', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching orders by status:', error)
      throw error
    }
  }

  static async getPendingDeliveries(tenantId: string): Promise<JobMaterialOrder[]> {
    try {
      const { data, error } = await supabase
        .from('job_material_orders')
        .select(`
          *,
          jobs:job_id(id, title, location_address)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['ordered', 'partial'])
        .order('expected_delivery', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching pending deliveries:', error)
      throw error
    }
  }

  static async getOverdueDeliveries(tenantId: string): Promise<JobMaterialOrder[]> {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('job_material_orders')
        .select(`
          *,
          jobs:job_id(id, title, location_address)
        `)
        .eq('tenant_id', tenantId)
        .in('status', ['ordered', 'partial'])
        .lt('expected_delivery', today)
        .order('expected_delivery', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching overdue deliveries:', error)
      throw error
    }
  }

  static calculateOrderTotal(items: MaterialOrderItem[]): number {
    return items.reduce((sum, item) => sum + item.total_price, 0)
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }
}