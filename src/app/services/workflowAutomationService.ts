import { supabase } from '../../supabaseClient'

export interface WorkflowRule {
  id: string
  tenant_id: string
  rule_name: string
  description?: string
  entity_type: 'lead' | 'job' | 'inspection' | 'milestone' | 'team_assignment' | 'material_order' | 'quote_request'
  trigger_event: 'status_change' | 'date_reached' | 'field_updated' | 'created' | 'overdue' | 'completed'
  trigger_conditions: Record<string, any>
  actions: WorkflowAction[]
  active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkflowAction {
  type: 'send_notification' | 'update_status' | 'create_reminder' | 'assign_team' | 'create_invoice' | 'send_email' | 'webhook'
  target: string
  parameters: Record<string, any>
}

export interface WorkflowExecution {
  id: string
  tenant_id: string
  workflow_rule_id: string
  entity_id: string
  entity_type: string
  trigger_data: Record<string, any>
  actions_executed: any[]
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
  error_message?: string
  started_at: string
  completed_at?: string
  created_at: string
}

export interface NotificationTemplate {
  id: string
  tenant_id: string
  template_name: string
  template_type: 'email' | 'sms' | 'in_app' | 'webhook'
  category: 'job_status' | 'milestone' | 'assignment' | 'reminder' | 'alert' | 'invoice' | 'quote'
  subject?: string
  message_template: string
  variables: string[]
  default_template: boolean
  active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  tenant_id: string
  recipient_type: 'user' | 'contact' | 'vendor' | 'subcontractor' | 'external'
  recipient_id?: string
  recipient_email?: string
  recipient_phone?: string
  notification_type: 'email' | 'sms' | 'in_app' | 'webhook'
  category: string
  title: string
  message: string
  data: Record<string, any>
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  delivery_attempts: number
  last_attempt_at?: string
  delivered_at?: string
  read_at?: string
  error_message?: string
  workflow_execution_id?: string
  entity_id?: string
  entity_type?: string
  created_at: string
  updated_at: string
}

export class WorkflowAutomationService {
  // Workflow Rules Management
  static async getWorkflowRules(tenantId: string): Promise<WorkflowRule[]> {
    try {
      const { data, error } = await supabase
        .from('workflow_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching workflow rules:', error)
      throw error
    }
  }

  static async createWorkflowRule(ruleData: Partial<WorkflowRule>): Promise<WorkflowRule> {
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('No tenant found for user')
      }

      const { data, error } = await supabase
        .from('workflow_rules')
        .insert({
          ...ruleData,
          tenant_id: userProfile.tenant_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating workflow rule:', error)
      throw error
    }
  }

  static async updateWorkflowRule(ruleId: string, updates: Partial<WorkflowRule>): Promise<WorkflowRule> {
    try {
      const { data, error } = await supabase
        .from('workflow_rules')
        .update(updates)
        .eq('id', ruleId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating workflow rule:', error)
      throw error
    }
  }

  static async deleteWorkflowRule(ruleId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('workflow_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting workflow rule:', error)
      throw error
    }
  }

  // Get system notification templates
  static async getSystemNotificationTemplates(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('system_notification_templates')
        .select('*')
        .eq('active', true)
        .order('template_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching system templates:', error)
      return []
    }
  }

  // Copy system template to tenant
  static async copySystemTemplateToTenant(systemTemplateId: string, tenantId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .rpc('copy_system_template_to_tenant', {
          p_tenant_id: tenantId,
          p_system_template_id: systemTemplateId
        })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error copying system template:', error)
      throw error
    }
  }

  // Predefined workflow rule templates
  static getWorkflowTemplates(): Array<Partial<WorkflowRule>> {
    return [
      {
        rule_name: 'Job Status Change Notification',
        description: 'Notify customer when job status changes',
        entity_type: 'job',
        trigger_event: 'status_change',
        trigger_conditions: {},
        actions: [
          {
            type: 'send_notification',
            target: 'customer',
            parameters: {
              recipient_type: 'contact',
              category: 'job_status',
              system_template_name: 'Job Status Update',
              title: 'Job Status Update',
              message: 'Your job status has been updated to {{new_status}}'
            }
          }
        ]
      },
      {
        rule_name: 'Payment Milestone Due Reminder',
        description: 'Send reminder when payment milestone is due',
        entity_type: 'milestone',
        trigger_event: 'date_reached',
        trigger_conditions: { milestone_type: 'payment' },
        actions: [
          {
            type: 'send_email',
            target: 'customer',
            parameters: {
              category: 'payment',
              subject: 'Payment Due Reminder',
              message: 'A payment milestone is now due for your project'
            }
          }
        ]
      },
      {
        rule_name: 'Team Assignment Notification',
        description: 'Notify team member when assigned to job',
        entity_type: 'team_assignment',
        trigger_event: 'created',
        trigger_conditions: {},
        actions: [
          {
            type: 'send_notification',
            target: 'team_member',
            parameters: {
              recipient_type: 'user',
              category: 'assignment',
              title: 'New Job Assignment',
              message: 'You have been assigned to job: {{job_title}}'
            }
          }
        ]
      },
      {
        rule_name: 'Inspection Overdue Alert',
        description: 'Alert when inspection is overdue',
        entity_type: 'inspection',
        trigger_event: 'overdue',
        trigger_conditions: {},
        actions: [
          {
            type: 'send_notification',
            target: 'project_manager',
            parameters: {
              recipient_type: 'user',
              category: 'alert',
              title: 'Overdue Inspection',
              message: 'Inspection {{inspection_type}} is overdue for job {{job_title}}'
            }
          },
          {
            type: 'create_reminder',
            target: 'system',
            parameters: {
              reminder_type: 'inspection',
              title: 'Follow up on overdue inspection',
              message: 'Please follow up on the overdue inspection',
              days_from_now: 1,
              frequency: 'daily',
              max_reminders: 3
            }
          }
        ]
      },
      {
        rule_name: 'Lead Site Visit Reminder',
        description: 'Remind team about upcoming site visits',
        entity_type: 'lead',
        trigger_event: 'date_reached',
        trigger_conditions: { status: 'site_visit_scheduled' },
        actions: [
          {
            type: 'send_notification',
            target: 'assigned_rep',
            parameters: {
              recipient_type: 'user',
              category: 'reminder',
              title: 'Site Visit Reminder',
              message: 'You have a site visit scheduled for {{site_visit_date}}'
            }
          }
        ]
      },
      {
        rule_name: 'Material Order Delivery Reminder',
        description: 'Remind when material delivery is expected',
        entity_type: 'material_order',
        trigger_event: 'date_reached',
        trigger_conditions: { status: 'ordered' },
        actions: [
          {
            type: 'send_notification',
            target: 'project_manager',
            parameters: {
              recipient_type: 'user',
              category: 'reminder',
              title: 'Material Delivery Expected',
              message: 'Material delivery expected today for order {{order_number}}'
            }
          }
        ]
      },
      {
        rule_name: 'Quote Request Follow-up',
        description: 'Follow up on pending quote requests',
        entity_type: 'quote_request',
        trigger_event: 'overdue',
        trigger_conditions: { status: 'sent' },
        actions: [
          {
            type: 'send_notification',
            target: 'procurement_manager',
            parameters: {
              recipient_type: 'user',
              category: 'alert',
              title: 'Quote Request Overdue',
              message: 'Quote request {{request_title}} response deadline has passed'
            }
          },
          {
            type: 'send_email',
            target: 'vendors',
            parameters: {
              category: 'reminder',
              subject: 'Quote Request Follow-up',
              message: 'We are still awaiting your quote for our recent request'
            }
          }
        ]
      }
    ]
  }

  // Trigger workflow automation manually (for testing/immediate execution)
  static async triggerWorkflow(entityType: string, entityId: string, triggerEvent: string, triggerData: Record<string, any> = {}): Promise<void> {
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

      // Find applicable workflow rules
      const { data: rules, error: rulesError } = await supabase
        .from('workflow_rules')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('entity_type', entityType)
        .eq('trigger_event', triggerEvent)
        .eq('active', true)

      if (rulesError) throw rulesError

      // Execute each applicable rule
      for (const rule of rules || []) {
        // Create workflow execution record
        const { data: execution, error: execError } = await supabase
          .from('workflow_executions')
          .insert({
            tenant_id: userProfile.tenant_id,
            workflow_rule_id: rule.id,
            entity_id: entityId,
            entity_type: entityType,
            trigger_data: {
              ...triggerData,
              manual_trigger: true,
              triggered_at: new Date().toISOString()
            },
            status: 'pending'
          })
          .select()
          .single()

        if (execError) throw execError

        // Process the workflow actions
        await this.processWorkflowActions(rule, execution, userProfile.tenant_id)
      }

    } catch (error) {
      console.error('Error triggering workflow:', error)
      throw error
    }
  }

  static async processWorkflowActions(rule: WorkflowRule, execution: WorkflowExecution, tenantId: string): Promise<void> {
    try {
      // Update execution status
      await supabase
        .from('workflow_executions')
        .update({ status: 'executing' })
        .eq('id', execution.id)

      const actionsExecuted: any[] = []

      // Process each action
      for (const action of rule.actions) {
        try {
          await this.executeAction(action, execution, tenantId)
          actionsExecuted.push({
            ...action,
            status: 'completed',
            executed_at: new Date().toISOString()
          })
        } catch (actionError) {
          console.error('Error executing action:', actionError)
          actionsExecuted.push({
            ...action,
            status: 'failed',
            error: actionError instanceof Error ? actionError.message : 'Unknown error',
            executed_at: new Date().toISOString()
          })
        }
      }

      // Update execution as completed
      await supabase
        .from('workflow_executions')
        .update({
          status: 'completed',
          actions_executed: actionsExecuted,
          completed_at: new Date().toISOString()
        })
        .eq('id', execution.id)

    } catch (error) {
      console.error('Error processing workflow actions:', error)
      
      // Mark as failed
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', execution.id)
    }
  }

  static async executeAction(action: WorkflowAction, execution: WorkflowExecution, tenantId: string): Promise<void> {
    switch (action.type) {
      case 'send_notification':
        await this.sendNotificationAction(action, execution, tenantId)
        break
      case 'send_email':
        await this.sendEmailAction(action, execution, tenantId)
        break
      case 'create_reminder':
        await this.createReminderAction(action, execution, tenantId)
        break
      case 'update_status':
        await this.updateStatusAction(action, execution)
        break
      default:
        console.log(`Action type ${action.type} not implemented yet`)
    }
  }

  static async sendNotificationAction(action: WorkflowAction, execution: WorkflowExecution, tenantId: string): Promise<void> {
    await supabase
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        recipient_type: action.parameters.recipient_type || 'user',
        recipient_id: action.parameters.recipient_id,
        notification_type: 'in_app',
        category: action.parameters.category || 'workflow',
        title: action.parameters.title || 'Workflow Notification',
        message: action.parameters.message || 'A workflow action was triggered',
        data: {
          workflow_execution_id: execution.id,
          entity_type: execution.entity_type,
          entity_id: execution.entity_id
        },
        workflow_execution_id: execution.id,
        entity_id: execution.entity_id,
        entity_type: execution.entity_type
      })
  }

  static async sendEmailAction(action: WorkflowAction, execution: WorkflowExecution, tenantId: string): Promise<void> {
    await supabase
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        recipient_type: 'external',
        recipient_email: action.parameters.recipient_email,
        notification_type: 'email',
        category: action.parameters.category || 'workflow',
        title: action.parameters.subject || 'Workflow Email',
        message: action.parameters.message || 'This is an automated email from your workflow',
        data: {
          workflow_execution_id: execution.id,
          entity_type: execution.entity_type,
          entity_id: execution.entity_id
        },
        workflow_execution_id: execution.id,
        entity_id: execution.entity_id,
        entity_type: execution.entity_type
      })
  }

  static async createReminderAction(action: WorkflowAction, execution: WorkflowExecution, tenantId: string): Promise<void> {
    const remindAt = new Date()
    remindAt.setDate(remindAt.getDate() + (action.parameters.days_from_now || 1))

    await supabase
      .from('automated_reminders')
      .insert({
        tenant_id: tenantId,
        entity_type: execution.entity_type,
        entity_id: execution.entity_id,
        reminder_type: action.parameters.reminder_type || 'follow_up',
        title: action.parameters.title || 'Automated Reminder',
        message: action.parameters.message || 'This is an automated reminder',
        remind_at: remindAt.toISOString(),
        reminder_frequency: action.parameters.frequency || 'once',
        max_reminders: action.parameters.max_reminders || 1
      })
  }

  static async updateStatusAction(action: WorkflowAction, execution: WorkflowExecution): Promise<void> {
    const tableName = execution.entity_type
    const newStatus = action.parameters.new_status

    if (!newStatus) {
      throw new Error('new_status parameter is required for update_status action')
    }

    const { error } = await supabase
      .from(tableName)
      .update({ status: newStatus })
      .eq('id', execution.entity_id)

    if (error) throw error
  }
}

export class NotificationService {
  static async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching notifications:', error)
      throw error
    }
  }

  static async getNotificationsForTenant(tenantId: string, limit = 100): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching notifications for tenant:', error)
      throw error
    }
  }

  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error
    } catch (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  static async sendManualNotification(notificationData: Partial<Notification>): Promise<Notification> {
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single()

      if (!userProfile?.tenant_id) {
        throw new Error('No tenant found for user')
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...notificationData,
          tenant_id: userProfile.tenant_id
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error sending notification:', error)
      throw error
    }
  }
}