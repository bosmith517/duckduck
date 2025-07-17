import { supabase } from '../../supabaseClient'
import { formSyncService } from './formSyncService'
import { getFormSchema, getLinkedForms } from '../config/formSchemaRegistry'
import React from 'react'

export interface PrefillContext {
  sourceFormId: string
  targetFormId: string
  sourceRecordId?: string
  sourceData?: Record<string, any>
  tenantId: string
  userId: string
}

export interface PrefillResult {
  success: boolean
  prefillData: Record<string, any>
  linkedRecords: Array<{
    table: string
    id: string
    data: Record<string, any>
  }>
  suggestions: Array<{
    field: string
    suggestedValue: any
    confidence: number
    source: string
  }>
}

class SmartPrefillService {
  // Cache for prefill data
  private prefillCache: Map<string, { data: any; expires: number }> = new Map()
  private cacheDuration = 5 * 60 * 1000 // 5 minutes

  // Get prefill data for a form
  async getPrefillData(context: PrefillContext): Promise<PrefillResult> {
    const cacheKey = this.generateCacheKey(context)
    
    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }

    try {
      // Get form schemas
      const sourceSchema = getFormSchema(context.sourceFormId)
      const targetSchema = getFormSchema(context.targetFormId)

      if (!sourceSchema || !targetSchema) {
        throw new Error('Form schema not found')
      }

      // Get base prefill data from form sync service
      const basePrefillData = await formSyncService.getPrefillData(
        context.sourceFormId,
        context.targetFormId,
        context.sourceData || {}
      )

      // Enhance with linked records
      const linkedRecords = await this.fetchLinkedRecords(context, targetSchema.associatedTables)

      // Generate smart suggestions
      const suggestions = await this.generateSmartSuggestions(
        context,
        basePrefillData,
        linkedRecords
      )

      // Merge all data sources
      const prefillData = this.mergeDataSources(
        basePrefillData,
        linkedRecords,
        suggestions
      )

      const result: PrefillResult = {
        success: true,
        prefillData,
        linkedRecords,
        suggestions
      }

      // Cache the result
      this.setCache(cacheKey, result)

      return result
    } catch (error) {
      console.error('Error getting prefill data:', error)
      return {
        success: false,
        prefillData: {},
        linkedRecords: [],
        suggestions: []
      }
    }
  }

  // Fetch linked records from associated tables
  private async fetchLinkedRecords(
    context: PrefillContext,
    associatedTables: string[]
  ): Promise<any[]> {
    const linkedRecords: any[] = []

    for (const table of associatedTables) {
      try {
        // Determine the link field based on common patterns
        const linkField = this.determineLinkField(context.sourceFormId, table)
        
        if (!linkField || !context.sourceData?.[linkField]) {
          continue
        }

        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq(linkField, context.sourceData[linkField])
          .eq('tenant_id', context.tenantId)
          .limit(10)

        if (!error && data) {
          linkedRecords.push(...data.map(record => ({
            table,
            id: record.id,
            data: record
          })))
        }
      } catch (error) {
        console.error(`Error fetching linked records from ${table}:`, error)
      }
    }

    return linkedRecords
  }

  // Generate smart suggestions based on patterns and history
  private async generateSmartSuggestions(
    context: PrefillContext,
    basePrefillData: Record<string, any>,
    linkedRecords: any[]
  ): Promise<any[]> {
    const suggestions: any[] = []

    // Get historical patterns
    const patterns = await this.analyzeHistoricalPatterns(context)

    // Field-specific suggestions
    const targetSchema = getFormSchema(context.targetFormId)
    if (!targetSchema) return suggestions

    for (const fieldMapping of targetSchema.fieldMappings) {
      const field = fieldMapping.targetField

      // Skip if already have data
      if (basePrefillData[field]) continue

      // Try to find value from linked records
      const linkedValue = this.findValueInLinkedRecords(field, linkedRecords)
      if (linkedValue) {
        suggestions.push({
          field,
          suggestedValue: linkedValue.value,
          confidence: 0.8,
          source: `Linked ${linkedValue.table}`
        })
        continue
      }

      // Use historical patterns
      const patternValue = patterns[field]
      if (patternValue) {
        suggestions.push({
          field,
          suggestedValue: patternValue.value,
          confidence: patternValue.confidence,
          source: 'Historical pattern'
        })
      }

      // Generate default values for common fields
      const defaultValue = this.generateDefaultValue(field, context)
      if (defaultValue) {
        suggestions.push({
          field,
          suggestedValue: defaultValue,
          confidence: 0.5,
          source: 'Default value'
        })
      }
    }

    return suggestions
  }

  // Analyze historical patterns for field values
  private async analyzeHistoricalPatterns(
    context: PrefillContext
  ): Promise<Record<string, any>> {
    const patterns: Record<string, any> = {}

    try {
      // Query recent form submissions
      const { data, error } = await supabase
        .from('form_sync_logs')
        .select('original_data')
        .eq('form_id', context.targetFormId)
        .eq('tenant_id', context.tenantId)
        .eq('status', 'success')
        .order('sync_date', { ascending: false })
        .limit(50)

      if (!error && data) {
        // Analyze field frequencies
        const fieldFrequencies: Record<string, Record<string, number>> = {}

        data.forEach(log => {
          const formData = log.original_data || {}
          Object.entries(formData).forEach(([field, value]) => {
            if (!fieldFrequencies[field]) {
              fieldFrequencies[field] = {}
            }
            const valueStr = String(value)
            fieldFrequencies[field][valueStr] = (fieldFrequencies[field][valueStr] || 0) + 1
          })
        })

        // Find most common values
        Object.entries(fieldFrequencies).forEach(([field, frequencies]) => {
          const sorted = Object.entries(frequencies).sort((a, b) => b[1] - a[1])
          if (sorted.length > 0 && sorted[0][1] > 5) { // At least 5 occurrences
            patterns[field] = {
              value: sorted[0][0],
              confidence: Math.min(sorted[0][1] / data.length, 0.9)
            }
          }
        })
      }
    } catch (error) {
      console.error('Error analyzing patterns:', error)
    }

    return patterns
  }

  // Find value in linked records
  private findValueInLinkedRecords(
    field: string,
    linkedRecords: any[]
  ): { value: any; table: string } | null {
    for (const record of linkedRecords) {
      if (record.data[field] !== undefined && record.data[field] !== null) {
        return {
          value: record.data[field],
          table: record.table
        }
      }
    }
    return null
  }

  // Generate default values for common fields
  private generateDefaultValue(field: string, context: PrefillContext): any {
    const fieldLower = field.toLowerCase()

    // Date fields
    if (fieldLower.includes('date') && !fieldLower.includes('birth')) {
      if (fieldLower.includes('start') || fieldLower.includes('begin')) {
        return new Date().toISOString().split('T')[0]
      }
      if (fieldLower.includes('due') || fieldLower.includes('end')) {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7) // 7 days from now
        return futureDate.toISOString().split('T')[0]
      }
    }

    // Status fields
    if (fieldLower === 'status') {
      switch (context.targetFormId) {
        case 'lead-creation':
          return 'new'
        case 'job-creation':
          return 'scheduled'
        case 'invoice-creation':
          return 'draft'
        default:
          return 'pending'
      }
    }

    // Priority fields
    if (fieldLower.includes('priority')) {
      return 'medium'
    }

    // Boolean fields
    if (fieldLower.includes('is_') || fieldLower.includes('has_')) {
      return false
    }

    return null
  }

  // Determine link field between forms and tables
  private determineLinkField(formId: string, table: string): string | null {
    // Common patterns
    const patterns = [
      { form: 'lead-creation', table: 'contacts', field: 'contact_id' },
      { form: 'lead-creation', table: 'accounts', field: 'account_id' },
      { form: 'estimate-creation', table: 'leads', field: 'lead_id' },
      { form: 'job-creation', table: 'estimates', field: 'estimate_id' },
      { form: 'invoice-creation', table: 'jobs', field: 'job_id' }
    ]

    const pattern = patterns.find(p => p.form === formId && p.table === table)
    return pattern?.field || null
  }

  // Merge data from multiple sources
  private mergeDataSources(
    basePrefillData: Record<string, any>,
    linkedRecords: any[],
    suggestions: any[]
  ): Record<string, any> {
    const merged = { ...basePrefillData }

    // Apply high-confidence suggestions
    suggestions
      .filter(s => s.confidence >= 0.7)
      .forEach(suggestion => {
        if (!merged[suggestion.field]) {
          merged[suggestion.field] = suggestion.suggestedValue
        }
      })

    return merged
  }

  // Cache helpers
  private generateCacheKey(context: PrefillContext): string {
    return `${context.sourceFormId}_${context.targetFormId}_${context.sourceRecordId || 'new'}_${context.tenantId}`
  }

  private getFromCache(key: string): any | null {
    const cached = this.prefillCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    this.prefillCache.delete(key)
    return null
  }

  private setCache(key: string, data: any): void {
    this.prefillCache.set(key, {
      data,
      expires: Date.now() + this.cacheDuration
    })
  }

  // Clear cache for a specific form
  clearCache(formId?: string): void {
    if (formId) {
      // Clear specific form cache
      Array.from(this.prefillCache.keys()).forEach(key => {
        if (key.includes(formId)) {
          this.prefillCache.delete(key)
        }
      })
    } else {
      // Clear all cache
      this.prefillCache.clear()
    }
  }

  // Save prefill data for later use
  async savePrefillData(
    context: PrefillContext,
    prefillData: Record<string, any>
  ): Promise<void> {
    try {
      await supabase
        .from('form_prefill_cache')
        .upsert({
          tenant_id: context.tenantId,
          source_form_id: context.sourceFormId,
          target_form_id: context.targetFormId,
          source_record_id: context.sourceRecordId || 'new',
          prefill_data: prefillData,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })
    } catch (error) {
      console.error('Error saving prefill data:', error)
    }
  }
}

// Export singleton instance
export const smartPrefillService = new SmartPrefillService()

// React hook for using smart prefill
export const useSmartPrefill = (targetFormId: string) => {
  const [prefillData, setPrefillData] = React.useState<Record<string, any>>({})
  const [suggestions, setSuggestions] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  const loadPrefillData = async (
    sourceFormId: string,
    sourceData?: Record<string, any>,
    sourceRecordId?: string
  ) => {
    setIsLoading(true)
    try {
      const context: PrefillContext = {
        sourceFormId,
        targetFormId,
        sourceData,
        sourceRecordId,
        tenantId: '', // Get from auth context
        userId: '' // Get from auth context
      }

      const result = await smartPrefillService.getPrefillData(context)
      
      if (result.success) {
        setPrefillData(result.prefillData)
        setSuggestions(result.suggestions)
      }
    } catch (error) {
      console.error('Error loading prefill data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const acceptSuggestion = (field: string, value: any) => {
    setPrefillData(prev => ({ ...prev, [field]: value }))
    setSuggestions(prev => prev.filter(s => s.field !== field))
  }

  return {
    prefillData,
    suggestions,
    isLoading,
    loadPrefillData,
    acceptSuggestion
  }
}