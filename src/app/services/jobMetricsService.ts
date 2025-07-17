import { supabase } from '../../supabaseClient'
import { Job } from '../../supabaseClient'

export interface JobMetrics {
  contractPrice: number
  expectedProfit: number
  actualProfit: number
  profitMargin: number
  profitVariance: number
  costVariance: number
  isProfitable: boolean
  profitabilityScore: 'A' | 'B' | 'C' | 'D' | 'F'
  burnRate: number
}

export interface EnhancedJob extends Job {
  metrics?: JobMetrics
}

class JobMetricsService {
  /**
   * Calculate profitability score based on various metrics
   */
  private calculateProfitabilityScore(
    profitMargin: number,
    costVariance: number,
    laborVariance: number,
    estimatedCost: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 100
    
    // Profit margin scoring (40% weight)
    if (profitMargin >= 20) score += 0
    else if (profitMargin >= 15) score -= 10
    else if (profitMargin >= 10) score -= 20
    else if (profitMargin >= 5) score -= 30
    else if (profitMargin >= 0) score -= 40
    else score -= 60
    
    // Cost variance scoring (35% weight)
    const costVariancePercent = estimatedCost > 0 ? (costVariance / estimatedCost) * 100 : 0
    if (costVariancePercent <= 0) score += 0 // On or under budget
    else if (costVariancePercent <= 5) score -= 10
    else if (costVariancePercent <= 10) score -= 20
    else if (costVariancePercent <= 15) score -= 30
    else score -= 40
    
    // Labor variance scoring (25% weight)
    if (laborVariance <= 0) score += 0 // On or under time
    else if (laborVariance <= 2) score -= 5
    else if (laborVariance <= 5) score -= 10
    else if (laborVariance <= 10) score -= 15
    else score -= 25
    
    // Convert to letter grade
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  /**
   * Get contract price from estimate if not set on job
   */
  private async getContractPrice(job: Job): Promise<number> {
    // First check if job has contract price set
    if (job.contract_price && job.contract_price > 0) {
      return job.contract_price
    }

    // Try to get from approved estimate
    if (job.estimate_id || job.lead_id) {
      try {
        let query = supabase
          .from('estimates')
          .select('total_amount')
          .eq('status', 'approved')
          
        const orConditions = []
        if (job.estimate_id) orConditions.push(`id.eq.${job.estimate_id}`)
        if (job.lead_id) orConditions.push(`lead_id.eq.${job.lead_id}`)
        
        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','))
          
          const { data: estimate } = await query
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (estimate && estimate.total_amount) {
            return estimate.total_amount
          }
        }
      } catch (error) {
        console.log('No approved estimate found for job:', job.id)
      }
    }

    // Fallback to estimated cost with markup
    return (job.estimated_cost || 0) * 1.3 // 30% markup default
  }

  /**
   * Calculate all metrics for a single job
   */
  async calculateJobMetrics(job: Job): Promise<EnhancedJob> {
    const contractPrice = await this.getContractPrice(job)
    const actualCost = job.actual_cost || 0
    const estimatedCost = job.estimated_cost || 0
    
    const expectedProfit = contractPrice - estimatedCost
    const actualProfit = contractPrice - actualCost
    const profitVariance = actualProfit - expectedProfit
    const profitMargin = contractPrice > 0 ? (actualProfit / contractPrice) * 100 : 0
    const costVariance = actualCost - estimatedCost
    const laborVariance = (job.actual_hours || 0) - (job.estimated_hours || 0)
    
    // Calculate burn rate
    const startDate = job.start_date ? new Date(job.start_date) : new Date()
    const now = new Date()
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const burnRate = actualCost / daysElapsed
    
    const profitabilityScore = this.calculateProfitabilityScore(
      profitMargin,
      costVariance,
      laborVariance,
      estimatedCost
    )
    
    const metrics: JobMetrics = {
      contractPrice,
      expectedProfit,
      actualProfit,
      profitMargin,
      profitVariance,
      costVariance,
      isProfitable: actualProfit > 0,
      profitabilityScore,
      burnRate
    }
    
    return {
      ...job,
      metrics
    }
  }

  /**
   * Calculate metrics for multiple jobs
   */
  async calculateMultipleJobMetrics(jobs: Job[]): Promise<EnhancedJob[]> {
    return Promise.all(jobs.map(job => this.calculateJobMetrics(job)))
  }

  /**
   * Update job's contract price in database
   */
  async updateContractPrice(jobId: string, contractPrice: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ 
          contract_price: contractPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      return !error
    } catch (error) {
      console.error('Error updating contract price:', error)
      return false
    }
  }

  /**
   * Batch update contract prices from estimates
   */
  async populateAllContractPrices(): Promise<{ updated: number; failed: number }> {
    try {
      // Get all jobs that need contract price
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, estimate_id, lead_id, estimated_cost')
        .or('contract_price.is.null,contract_price.eq.0')
      
      if (!jobs) return { updated: 0, failed: 0 }
      
      let updated = 0
      let failed = 0
      
      for (const job of jobs) {
        const contractPrice = await this.getContractPrice(job as Job)
        const success = await this.updateContractPrice(job.id, contractPrice)
        
        if (success) {
          updated++
        } else {
          failed++
        }
      }
      
      return { updated, failed }
    } catch (error) {
      console.error('Error populating contract prices:', error)
      return { updated: 0, failed: 0 }
    }
  }
}

export const jobMetricsService = new JobMetricsService()