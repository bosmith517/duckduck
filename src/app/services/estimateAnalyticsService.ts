import { supabase } from '../../supabaseClient'

export type EstimateContext = 'journey' | 'change_order' | 'standalone'

interface EstimateAnalyticsData {
  totalEstimates: number
  contextBreakdown: {
    journey: number
    change_order: number
    standalone: number
  }
  conversionRates: {
    journey: number
    change_order: number
    standalone: number
  }
  averageValues: {
    journey: number
    change_order: number
    standalone: number
  }
}

class EstimateAnalyticsService {
  async trackEstimateCreation(estimateId: string, context: EstimateContext, metadata?: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('estimate_analytics')
        .insert({
          estimate_id: estimateId,
          context_type: context,
          created_by: user.id,
          metadata: metadata || {}
        })
    } catch (error) {
      console.error('Error tracking estimate creation:', error)
    }
  }

  async getEstimateAnalytics(tenantId: string, dateRange?: { start: Date; end: Date }): Promise<EstimateAnalyticsData> {
    try {
      // Build query
      let query = supabase
        .from('estimates')
        .select('id, total_amount, created_at, lead_id, job_id, status')
        .eq('tenant_id', tenantId)

      // Apply date range if provided
      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
      }

      const { data: estimates, error } = await query
      if (error) throw error

      // Calculate analytics
      const analytics: EstimateAnalyticsData = {
        totalEstimates: estimates?.length || 0,
        contextBreakdown: {
          journey: 0,
          change_order: 0,
          standalone: 0
        },
        conversionRates: {
          journey: 0,
          change_order: 0,
          standalone: 0
        },
        averageValues: {
          journey: 0,
          change_order: 0,
          standalone: 0
        }
      }

      // Process each estimate
      const contextTotals = {
        journey: { count: 0, value: 0, converted: 0 },
        change_order: { count: 0, value: 0, converted: 0 },
        standalone: { count: 0, value: 0, converted: 0 }
      }

      estimates?.forEach(estimate => {
        let context: EstimateContext = 'standalone'
        
        if (estimate.lead_id && !estimate.job_id) {
          context = 'journey'
        } else if (estimate.job_id && !estimate.lead_id) {
          context = 'change_order'
        }

        contextTotals[context].count++
        contextTotals[context].value += estimate.total_amount || 0
        
        if (estimate.status === 'approved') {
          contextTotals[context].converted++
        }
      })

      // Calculate final metrics
      Object.keys(contextTotals).forEach(context => {
        const key = context as EstimateContext
        const data = contextTotals[key]
        
        analytics.contextBreakdown[key] = data.count
        analytics.conversionRates[key] = data.count > 0 
          ? Math.round((data.converted / data.count) * 100) 
          : 0
        analytics.averageValues[key] = data.count > 0 
          ? Math.round(data.value / data.count) 
          : 0
      })

      return analytics
    } catch (error) {
      console.error('Error fetching estimate analytics:', error)
      return {
        totalEstimates: 0,
        contextBreakdown: { journey: 0, change_order: 0, standalone: 0 },
        conversionRates: { journey: 0, change_order: 0, standalone: 0 },
        averageValues: { journey: 0, change_order: 0, standalone: 0 }
      }
    }
  }

  async getContextDistribution(tenantId: string): Promise<{ context: string; percentage: number }[]> {
    const analytics = await this.getEstimateAnalytics(tenantId)
    const total = analytics.totalEstimates || 1 // Avoid division by zero

    return [
      {
        context: 'Journey-based',
        percentage: Math.round((analytics.contextBreakdown.journey / total) * 100)
      },
      {
        context: 'Change Orders',
        percentage: Math.round((analytics.contextBreakdown.change_order / total) * 100)
      },
      {
        context: 'Standalone',
        percentage: Math.round((analytics.contextBreakdown.standalone / total) * 100)
      }
    ]
  }
}

export const estimateAnalyticsService = new EstimateAnalyticsService()