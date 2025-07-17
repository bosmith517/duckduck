import { supabase } from '../../supabaseClient'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { formSyncService, SyncContext } from './formSyncService'
import { formSchemas } from '../config/formSchemaRegistry'
import React from 'react'

export interface TableMapping {
  tableName: string
  formId: string
  syncEvents: ('INSERT' | 'UPDATE' | 'DELETE')[]
  fieldMappings: Record<string, string>
}

export interface SyncSubscription {
  id: string
  channel: RealtimeChannel
  table: string
  active: boolean
}

class RealtimeSyncService {
  private subscriptions: Map<string, SyncSubscription> = new Map()
  private tableMappings: Map<string, TableMapping[]> = new Map()
  private isInitialized = false

  constructor() {
    this.initializeTableMappings()
  }

  // Initialize table mappings from form schemas
  private initializeTableMappings() {
    // Build reverse mapping from tables to forms
    Object.entries(formSchemas).forEach(([formId, schema]) => {
      // Primary table mapping
      this.addTableMapping(schema.primaryTable, {
        tableName: schema.primaryTable,
        formId,
        syncEvents: ['INSERT', 'UPDATE', 'DELETE'],
        fieldMappings: {}
      })

      // Associated tables mapping
      schema.associatedTables.forEach(table => {
        this.addTableMapping(table, {
          tableName: table,
          formId,
          syncEvents: ['UPDATE'],
          fieldMappings: {}
        })
      })
    })
  }

  // Add table mapping
  private addTableMapping(table: string, mapping: TableMapping) {
    if (!this.tableMappings.has(table)) {
      this.tableMappings.set(table, [])
    }
    this.tableMappings.get(table)!.push(mapping)
  }

  // Initialize real-time sync
  async initialize(tenantId: string) {
    if (this.isInitialized) return

    try {
      // Subscribe to all mapped tables
      for (const [table, mappings] of this.tableMappings.entries()) {
        await this.subscribeToTable(table, tenantId)
      }

      this.isInitialized = true
      console.log('Realtime sync service initialized')
    } catch (error) {
      console.error('Failed to initialize realtime sync:', error)
      throw error
    }
  }

  // Subscribe to table changes
  private async subscribeToTable(table: string, tenantId: string) {
    const subscriptionId = `${table}_${tenantId}`
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionId)) {
      return
    }

    const channel = supabase
      .channel(`${table}_sync`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => this.handleDatabaseChange(table, payload, tenantId)
      )
      .subscribe()

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      channel,
      table,
      active: true
    })
  }

  // Handle database changes
  private async handleDatabaseChange(
    table: string,
    payload: RealtimePostgresChangesPayload<any>,
    tenantId: string
  ) {
    console.log(`Database change detected in ${table}:`, payload.eventType)

    const mappings = this.tableMappings.get(table) || []
    
    for (const mapping of mappings) {
      // Check if this event type should trigger sync
      if (!mapping.syncEvents.includes(payload.eventType as any)) {
        continue
      }

      try {
        // Prepare sync context
        const syncContext: SyncContext = {
          formId: mapping.formId,
          tenantId,
          userId: 'system', // This would come from the change metadata
          data: payload.new || payload.old || {},
          metadata: {
            triggerTable: table,
            triggerEvent: payload.eventType,
            timestamp: new Date().toISOString()
          }
        }

        // Map event type to sync event
        const syncEvent = this.mapPostgresEventToSyncEvent(payload.eventType)
        
        // Trigger sync
        await formSyncService.syncFormData(syncContext, syncEvent)
      } catch (error) {
        console.error(`Failed to sync changes from ${table}:`, error)
      }
    }
  }

  // Map Postgres event to sync event
  private mapPostgresEventToSyncEvent(eventType: string): 'create' | 'update' | 'delete' {
    switch (eventType) {
      case 'INSERT':
        return 'create'
      case 'UPDATE':
        return 'update'
      case 'DELETE':
        return 'delete'
      default:
        return 'update'
    }
  }

  // Subscribe to specific form changes
  subscribeToFormChanges(
    formId: string,
    callback: (change: any) => void
  ): () => void {
    const schema = formSchemas[formId]
    if (!schema) {
      console.error(`Form schema not found for ${formId}`)
      return () => {}
    }

    const channel = supabase
      .channel(`form_${formId}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: schema.primaryTable
        },
        callback
      )
      .subscribe()

    // Return unsubscribe function
    return () => {
      channel.unsubscribe()
    }
  }

  // Get active subscriptions
  getActiveSubscriptions(): Array<{ table: string; active: boolean }> {
    return Array.from(this.subscriptions.values()).map(sub => ({
      table: sub.table,
      active: sub.active
    }))
  }

  // Pause sync for a table
  pauseTableSync(table: string) {
    this.subscriptions.forEach(sub => {
      if (sub.table === table) {
        sub.channel.unsubscribe()
        sub.active = false
      }
    })
  }

  // Resume sync for a table
  resumeTableSync(table: string) {
    this.subscriptions.forEach(sub => {
      if (sub.table === table) {
        sub.channel.subscribe()
        sub.active = true
      }
    })
  }

  // Cleanup subscriptions
  cleanup() {
    this.subscriptions.forEach(sub => {
      sub.channel.unsubscribe()
    })
    this.subscriptions.clear()
    this.isInitialized = false
  }
}

// Export singleton instance
export const realtimeSyncService = new RealtimeSyncService()

// Hook for React components
export const useRealtimeSync = (formId: string) => {
  const [lastChange, setLastChange] = React.useState<any>(null)
  const [isListening, setIsListening] = React.useState(false)

  React.useEffect(() => {
    setIsListening(true)
    
    const unsubscribe = realtimeSyncService.subscribeToFormChanges(
      formId,
      (change) => {
        setLastChange({
          ...change,
          timestamp: new Date().toISOString()
        })
      }
    )

    return () => {
      setIsListening(false)
      unsubscribe()
    }
  }, [formId])

  return {
    lastChange,
    isListening
  }
}

// Initialize service when authenticated
export const initializeRealtimeSync = async (tenantId: string) => {
  try {
    await realtimeSyncService.initialize(tenantId)
    console.log('Realtime sync initialized for tenant:', tenantId)
  } catch (error) {
    console.error('Failed to initialize realtime sync:', error)
  }
}