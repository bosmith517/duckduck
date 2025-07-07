import { supabase } from '../../supabaseClient'
import { useState, useEffect } from 'react'

export interface TenantInfo {
  id: string
  company_name: string
  plan: string
  is_active: boolean
}

class TenantService {
  private cachedTenantId: string | null = null
  private cacheExpiry: Date | null = null

  /**
   * Get the current user's tenant ID
   * Caches the result for 5 minutes to reduce database queries
   */
  async getCurrentTenantId(): Promise<string> {
    // Check cache first
    if (this.cachedTenantId && this.cacheExpiry && this.cacheExpiry > new Date()) {
      return this.cachedTenantId
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (error || !userProfile?.tenant_id) {
      throw new Error('User tenant not found')
    }

    // Cache for 5 minutes
    this.cachedTenantId = userProfile.tenant_id
    this.cacheExpiry = new Date(Date.now() + 5 * 60 * 1000)

    return userProfile.tenant_id
  }

  /**
   * Clear the tenant ID cache (useful after tenant switches)
   */
  clearCache(): void {
    this.cachedTenantId = null
    this.cacheExpiry = null
  }

  /**
   * Get full tenant information
   */
  async getTenantInfo(): Promise<TenantInfo> {
    const tenantId = await this.getCurrentTenantId()

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error || !data) {
      throw new Error('Tenant information not found')
    }

    return data
  }

  /**
   * Ensure data object has tenant_id set
   * Useful for insert operations
   */
  async ensureTenantId<T extends Record<string, any>>(data: T): Promise<T & { tenant_id: string }> {
    const tenantId = await this.getCurrentTenantId()
    return {
      ...data,
      tenant_id: tenantId
    }
  }

  /**
   * Validate that a record belongs to the current tenant
   */
  async validateRecordTenant(tableName: string, recordId: string): Promise<boolean> {
    const tenantId = await this.getCurrentTenantId()

    const { data, error } = await supabase
      .from(tableName)
      .select('tenant_id')
      .eq('id', recordId)
      .single()

    if (error || !data) {
      return false
    }

    return data.tenant_id === tenantId
  }

  /**
   * Create a query builder with tenant filter automatically applied
   */
  async createTenantQuery(tableName: string) {
    const tenantId = await this.getCurrentTenantId()
    return supabase
      .from(tableName)
      .select()
      .eq('tenant_id', tenantId)
  }

  /**
   * Batch insert with tenant_id automatically added
   */
  async batchInsertWithTenant<T extends Record<string, any>>(
    tableName: string,
    records: T[]
  ): Promise<any[]> {
    const tenantId = await this.getCurrentTenantId()
    
    const recordsWithTenant = records.map(record => ({
      ...record,
      tenant_id: tenantId
    }))

    const { data, error } = await supabase
      .from(tableName)
      .insert(recordsWithTenant)
      .select()

    if (error) {
      throw error
    }

    return data
  }

  /**
   * Check tenant data health
   */
  async checkTenantHealth(): Promise<any> {
    const tenantId = await this.getCurrentTenantId()

    const { data, error } = await supabase
      .rpc('check_tenant_health', { p_tenant_id: tenantId })

    if (error) {
      throw error
    }

    return data
  }

  /**
   * Get tenant data summary
   */
  async getTenantDataSummary(): Promise<any> {
    const tenantId = await this.getCurrentTenantId()

    const { data, error } = await supabase
      .from('tenant_data_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      throw error
    }

    return data
  }
}

export const tenantService = new TenantService()

/**
 * React hook for tenant operations
 * Usage: const { tenantId, ensureTenantId } = useTenant()
 */
export function useTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const loadTenant = async () => {
      try {
        const id = await tenantService.getCurrentTenantId()
        if (mounted) {
          setTenantId(id)
          setError(null)
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadTenant()

    return () => {
      mounted = false
    }
  }, [])

  return {
    tenantId,
    loading,
    error,
    ensureTenantId: tenantService.ensureTenantId.bind(tenantService),
    validateRecordTenant: tenantService.validateRecordTenant.bind(tenantService)
  }
}

// Utility function to add tenant_id to any data object
export async function withTenantId<T extends Record<string, any>>(data: T): Promise<T & { tenant_id: string }> {
  return tenantService.ensureTenantId(data)
}