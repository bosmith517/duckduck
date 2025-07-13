import { supabase } from '../../supabaseClient'

export interface CustomerNegotiationPattern {
  customer_id: string
  tenant_id: string
  total_estimates: number
  negotiated_estimates: number
  avg_negotiation_rounds: number
  avg_discount_percentage: number
  approved_count: number
  rejected_count: number
  avg_approved_amount: number
}

export interface NegotiationInsight {
  recommendation: string
  confidence: number
  reasoning: string
  suggested_markup?: number
}

class CustomerInsightsService {
  async getCustomerNegotiationPattern(customerId: string): Promise<CustomerNegotiationPattern | null> {
    try {
      const { data, error } = await supabase
        .from('customer_negotiation_patterns')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      if (error) {
        console.error('Error fetching negotiation pattern:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getCustomerNegotiationPattern:', error)
      return null
    }
  }

  async getEstimateRecommendations(
    customerId: string, 
    baseAmount: number
  ): Promise<NegotiationInsight> {
    const pattern = await this.getCustomerNegotiationPattern(customerId)
    
    if (!pattern || pattern.total_estimates < 2) {
      return {
        recommendation: 'Insufficient data for AI recommendations. Present your standard pricing.',
        confidence: 0.1,
        reasoning: 'This is a new customer or we have limited interaction history.'
      }
    }

    // Calculate negotiation likelihood
    const negotiationRate = pattern.negotiated_estimates / pattern.total_estimates
    const avgDiscount = pattern.avg_discount_percentage
    const approvalRate = pattern.approved_count / pattern.total_estimates

    // High negotiator profile
    if (negotiationRate > 0.7 && avgDiscount > 10) {
      const suggestedMarkup = Math.min(avgDiscount * 1.2, 25) // Cap at 25%
      
      return {
        recommendation: `This customer negotiates ${Math.round(negotiationRate * 100)}% of the time with an average discount of ${avgDiscount.toFixed(1)}%. Consider adding a ${suggestedMarkup.toFixed(1)}% buffer to your initial estimate.`,
        confidence: Math.min(pattern.total_estimates / 10, 0.9),
        reasoning: `Based on ${pattern.total_estimates} previous estimates, this customer typically negotiates for discounts averaging ${avgDiscount.toFixed(1)}%. They have approved ${pattern.approved_count} estimates with an average value of $${pattern.avg_approved_amount.toFixed(2)}.`,
        suggested_markup: suggestedMarkup
      }
    }

    // Low negotiator profile
    if (negotiationRate < 0.3) {
      return {
        recommendation: 'This customer rarely negotiates. Present your standard pricing confidently.',
        confidence: Math.min(pattern.total_estimates / 10, 0.8),
        reasoning: `Only ${Math.round(negotiationRate * 100)}% of estimates required negotiation. This customer typically accepts fair pricing.`
      }
    }

    // Price sensitive customer
    if (pattern.rejected_count / pattern.total_estimates > 0.4) {
      return {
        recommendation: 'This customer is price-sensitive. Consider offering payment plans or scope options.',
        confidence: 0.7,
        reasoning: `${Math.round((pattern.rejected_count / pattern.total_estimates) * 100)}% rejection rate suggests price sensitivity. Average approved amount is $${pattern.avg_approved_amount.toFixed(2)}.`
      }
    }

    // Default recommendation
    return {
      recommendation: `This customer negotiates moderately. Consider a ${(avgDiscount * 0.5).toFixed(1)}% buffer.`,
      confidence: 0.5,
      reasoning: `Based on ${pattern.total_estimates} estimates with ${pattern.avg_negotiation_rounds.toFixed(1)} average negotiation rounds.`,
      suggested_markup: avgDiscount * 0.5
    }
  }

  async getCustomerHistory(customerId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('estimates')
        .select(`
          *,
          estimate_negotiation_events(*)
        `)
        .or(`account_id.eq.${customerId},contact_id.eq.${customerId}`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching customer history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getCustomerHistory:', error)
      return []
    }
  }

  async analyzeRejectionReasons(customerId: string): Promise<{
    commonReasons: Array<{ reason: string, count: number }>
    recommendations: string[]
  }> {
    try {
      const { data: events } = await supabase
        .from('estimate_negotiation_events')
        .select('customer_comments')
        .eq('event_type', 'rejection_reason')
        .eq('tenant_id', (await supabase.auth.getUser()).data.user?.id)

      if (!events || events.length === 0) {
        return { commonReasons: [], recommendations: [] }
      }

      // Analyze rejection reasons (simplified - in production, use NLP)
      const reasonCounts: Record<string, number> = {}
      const keywords = {
        'price': ['price', 'expensive', 'cost', 'budget'],
        'timeline': ['timeline', 'schedule', 'timing', 'delay'],
        'scope': ['scope', 'features', 'requirements'],
        'competitor': ['competitor', 'other', 'quote', 'bid']
      }

      events.forEach(event => {
        const comment = (event.customer_comments || '').toLowerCase()
        Object.entries(keywords).forEach(([category, words]) => {
          if (words.some(word => comment.includes(word))) {
            reasonCounts[category] = (reasonCounts[category] || 0) + 1
          }
        })
      })

      const commonReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)

      // Generate recommendations based on common reasons
      const recommendations: string[] = []
      if (reasonCounts.price > 2) {
        recommendations.push('Consider offering payment plans or phased project options')
      }
      if (reasonCounts.timeline > 2) {
        recommendations.push('Highlight your fast turnaround times and scheduling flexibility')
      }
      if (reasonCounts.competitor > 2) {
        recommendations.push('Emphasize your unique value propositions and warranty offerings')
      }

      return { commonReasons, recommendations }
    } catch (error) {
      console.error('Error analyzing rejection reasons:', error)
      return { commonReasons: [], recommendations: [] }
    }
  }
}

export const customerInsightsService = new CustomerInsightsService()