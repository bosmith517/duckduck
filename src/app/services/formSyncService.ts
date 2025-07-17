import { supabase } from '../../supabaseClient'
import { 
  FormSchema, 
  SyncRule, 
  FieldMapping, 
  getFormSchema, 
  getSyncRules, 
  validateRequiredFields,
  getLinkedForms
} from '../config/formSchemaRegistry'
import { showToast } from '../utils/toast'
import React from 'react'

export interface SyncContext {
  formId: string
  tenantId: string
  userId: string
  data: Record<string, any>
  metadata?: Record<string, any>
}

export interface SyncResult {
  success: boolean
  syncedTables: string[]
  errors: string[]
  createdRecords: Array<{ table: string; id: string }>
  updatedRecords: Array<{ table: string; id: string }>
}

export interface SyncStatus {
  id: string
  formId: string
  syncDate: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  details: SyncResult | null
  errorMessage?: string
}

class FormSyncService {
  private syncQueue: Map<string, SyncStatus> = new Map()
  private listeners: Map<string, Set<(status: SyncStatus) => void>> = new Map()

  // Main sync method
  async syncFormData(context: SyncContext, event: 'create' | 'update' | 'delete'): Promise<SyncResult> {
    const syncId = this.generateSyncId()
    const syncStatus: SyncStatus = {
      id: syncId,
      formId: context.formId,
      syncDate: new Date().toISOString(),
      status: 'pending',
      details: null
    }

    // Add to queue
    this.syncQueue.set(syncId, syncStatus)
    this.notifyListeners(context.formId, syncStatus)

    try {
      // Update status to in progress
      syncStatus.status = 'in_progress'
      this.notifyListeners(context.formId, syncStatus)

      // Validate required fields
      const validation = validateRequiredFields(context.formId, context.data)
      if (!validation.isValid) {
        throw new Error(`Missing required fields: ${validation.missingFields.join(', ')}`)
      }

      // Get sync rules for this form and event
      const syncRules = getSyncRules(context.formId, event)
      
      const result: SyncResult = {
        success: true,
        syncedTables: [],
        errors: [],
        createdRecords: [],
        updatedRecords: []
      }

      // Process each sync rule
      for (const rule of syncRules) {
        try {
          await this.processSyncRule(rule, context, result)
        } catch (error) {
          result.errors.push(`Rule ${rule.name}: ${error instanceof Error ? error.message : String(error)}`)
          console.error(`Error processing sync rule ${rule.id}:`, error)
        }
      }

      // Update sync status
      syncStatus.status = result.errors.length === 0 ? 'completed' : 'failed'
      syncStatus.details = result
      this.notifyListeners(context.formId, syncStatus)

      // Log sync event
      await this.logSyncEvent(context, result)

      return result
    } catch (error) {
      syncStatus.status = 'failed'
      syncStatus.errorMessage = error instanceof Error ? error.message : String(error)
      this.notifyListeners(context.formId, syncStatus)
      
      throw error
    }
  }

  // Process a single sync rule
  private async processSyncRule(rule: SyncRule, context: SyncContext, result: SyncResult): Promise<void> {
    // Check conditions
    if (rule.conditions && !this.evaluateConditions(rule.conditions, context.data)) {
      return
    }

    // Process actions
    for (const action of rule.actions) {
      switch (action.type) {
        case 'sync':
        case 'create':
          await this.handleCreateOrSync(action, context, result)
          break
        case 'update':
          await this.handleUpdate(action, context, result)
          break
        case 'delete':
          await this.handleDelete(action, context, result)
          break
        case 'notify':
          await this.handleNotification(action, context)
          break
      }
    }
  }

  // Handle create or sync action
  private async handleCreateOrSync(action: any, context: SyncContext, result: SyncResult): Promise<void> {
    if (!action.targetTable || !action.fieldMappings) return

    const mappedData = this.mapFields(action.fieldMappings, context.data, context)
    
    // Add tenant_id to all records
    mappedData.tenant_id = context.tenantId

    try {
      if (action.type === 'create') {
        // Create new record
        const { data, error } = await supabase
          .from(action.targetTable)
          .insert(mappedData)
          .select()
          .single()

        if (error) throw error

        result.createdRecords.push({ table: action.targetTable, id: data.id })
        result.syncedTables.push(action.targetTable)
      } else {
        // Sync (upsert) record
        const { data, error } = await supabase
          .from(action.targetTable)
          .upsert(mappedData, { onConflict: 'id' })
          .select()
          .single()

        if (error) throw error

        result.updatedRecords.push({ table: action.targetTable, id: data.id })
        result.syncedTables.push(action.targetTable)
      }
    } catch (error) {
      throw new Error(`Failed to ${action.type} in ${action.targetTable}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Handle update action
  private async handleUpdate(action: any, context: SyncContext, result: SyncResult): Promise<void> {
    if (!action.targetTable || !action.fieldMappings) return

    const mappedData = this.mapFields(action.fieldMappings, context.data, context)
    
    // Find the ID field for update
    const idField = action.fieldMappings.find((m: FieldMapping) => m.targetField === 'id')?.sourceField || 'id'
    const recordId = context.data[idField]

    if (!recordId) {
      throw new Error(`No ID found for update in ${action.targetTable}`)
    }

    try {
      const { data, error } = await supabase
        .from(action.targetTable)
        .update(mappedData)
        .eq('id', recordId)
        .eq('tenant_id', context.tenantId)
        .select()
        .single()

      if (error) throw error

      result.updatedRecords.push({ table: action.targetTable, id: data.id })
      result.syncedTables.push(action.targetTable)
    } catch (error) {
      throw new Error(`Failed to update ${action.targetTable}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Handle delete action
  private async handleDelete(action: any, context: SyncContext, result: SyncResult): Promise<void> {
    if (!action.targetTable) return

    const recordId = context.data.id

    if (!recordId) {
      throw new Error(`No ID found for delete in ${action.targetTable}`)
    }

    try {
      const { error } = await supabase
        .from(action.targetTable)
        .delete()
        .eq('id', recordId)
        .eq('tenant_id', context.tenantId)

      if (error) throw error

      result.syncedTables.push(action.targetTable)
    } catch (error) {
      throw new Error(`Failed to delete from ${action.targetTable}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Handle notification action
  private async handleNotification(action: any, context: SyncContext): Promise<void> {
    if (!action.notificationConfig) return

    try {
      // This would integrate with your notification service
      // For now, just log it
      console.log('Notification triggered:', action.notificationConfig)
      
      // You could call your notification service here
      // await NotificationService.send(action.notificationConfig, context)
    } catch (error) {
      console.error('Failed to send notification:', error)
    }
  }

  // Map fields from source to target
  private mapFields(mappings: FieldMapping[], sourceData: Record<string, any>, context: SyncContext): Record<string, any> {
    const mappedData: Record<string, any> = {}

    for (const mapping of mappings) {
      let value = sourceData[mapping.sourceField]

      // Apply transformation if defined
      if (mapping.transform) {
        value = mapping.transform(value)
      }

      // Handle different sync behaviors
      switch (mapping.syncBehavior) {
        case 'overwrite':
        case 'create_new':
          mappedData[mapping.targetField] = value
          break
        case 'append':
          // For append, we'd need to fetch existing value and append
          // This is simplified for now
          mappedData[mapping.targetField] = value
          break
        case 'ignore':
          // Skip this field
          break
      }
    }

    return mappedData
  }

  // Evaluate conditions
  private evaluateConditions(conditions: any[], data: Record<string, any>): boolean {
    return conditions.every(condition => {
      const fieldValue = data[condition.field]
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value
        case 'not_equals':
          return fieldValue !== condition.value
        case 'contains':
          return String(fieldValue).includes(condition.value)
        case 'greater_than':
          return fieldValue > condition.value
        case 'less_than':
          return fieldValue < condition.value
        default:
          return false
      }
    })
  }

  // Get prefill data for linked forms
  async getPrefillData(sourceFormId: string, targetFormId: string, sourceData: Record<string, any>): Promise<Record<string, any>> {
    const linkedForms = getLinkedForms(sourceFormId)
    const linkedForm = linkedForms.find(lf => lf.formId === targetFormId)

    if (!linkedForm) {
      return {}
    }

    const prefillData: Record<string, any> = {}

    // Map fields according to prefill mapping
    for (const [sourceField, targetField] of Object.entries(linkedForm.prefillMapping)) {
      if (sourceData[sourceField] !== undefined) {
        prefillData[targetField] = sourceData[sourceField]
      }
    }

    return prefillData
  }

  // Subscribe to sync status updates
  subscribeSyncStatus(formId: string, callback: (status: SyncStatus) => void): () => void {
    if (!this.listeners.has(formId)) {
      this.listeners.set(formId, new Set())
    }

    this.listeners.get(formId)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(formId)?.delete(callback)
    }
  }

  // Get sync history for a form
  async getSyncHistory(formId: string, limit = 10): Promise<SyncStatus[]> {
    try {
      const { data, error } = await supabase
        .from('form_sync_logs')
        .select('*')
        .eq('form_id', formId)
        .order('sync_date', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching sync history:', error)
      return []
    }
  }

  // Log sync event
  private async logSyncEvent(context: SyncContext, result: SyncResult): Promise<void> {
    try {
      await supabase
        .from('form_sync_logs')
        .insert({
          form_id: context.formId,
          tenant_id: context.tenantId,
          user_id: context.userId,
          sync_date: new Date().toISOString(),
          status: result.errors.length === 0 ? 'success' : 'failed',
          synced_tables: result.syncedTables,
          created_records: result.createdRecords,
          updated_records: result.updatedRecords,
          errors: result.errors,
          metadata: context.metadata
        })
    } catch (error) {
      console.error('Error logging sync event:', error)
    }
  }

  // Notify listeners
  private notifyListeners(formId: string, status: SyncStatus): void {
    this.listeners.get(formId)?.forEach(callback => {
      try {
        callback(status)
      } catch (error) {
        console.error('Error in sync status listener:', error)
      }
    })
  }

  // Generate unique sync ID
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Retry failed syncs
  async retryFailedSync(syncId: string): Promise<SyncResult> {
    const syncStatus = this.syncQueue.get(syncId)
    
    if (!syncStatus || syncStatus.status !== 'failed') {
      throw new Error('Sync not found or not in failed state')
    }

    // Retrieve original context from logs
    const { data: logEntry } = await supabase
      .from('form_sync_logs')
      .select('*')
      .eq('id', syncId)
      .single()

    if (!logEntry) {
      throw new Error('Sync log entry not found')
    }

    // Retry the sync
    return this.syncFormData({
      formId: logEntry.form_id,
      tenantId: logEntry.tenant_id,
      userId: logEntry.user_id,
      data: logEntry.original_data,
      metadata: logEntry.metadata
    }, 'update')
  }
}

// Export singleton instance
export const formSyncService = new FormSyncService()

// Helper hook for React components
export const useFormSync = (formId: string) => {
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const unsubscribe = formSyncService.subscribeSyncStatus(formId, setSyncStatus)
    return unsubscribe
  }, [formId])

  const syncForm = async (data: Record<string, any>, event: 'create' | 'update' | 'delete', context: Partial<SyncContext>) => {
    setIsLoading(true)
    try {
      const result = await formSyncService.syncFormData({
        formId,
        data,
        ...context
      } as SyncContext, event)
      
      if (result.errors.length > 0) {
        showToast.warning(`Sync completed with errors: ${result.errors.join(', ')}`)
      } else {
        showToast.success('Data synced successfully')
      }
      
      return result
    } catch (error) {
      showToast.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    syncStatus,
    isLoading,
    syncForm
  }
}