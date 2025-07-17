import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import PhotoCapture from '../shared/PhotoCapture'
import JobContractPriceEditor from './JobContractPriceEditor'

interface JobCostData {
  id: string
  title: string
  status: string
  start_date: string
  contact_name: string
  
  // Financial data (from actual schema)
  estimated_cost: number
  actual_cost: number
  estimated_hours: number
  actual_hours: number
  
  // Enhanced financial fields
  contract_price: number // Total amount charging client
  estimated_material_cost: number
  estimated_labor_cost: number
  estimated_equipment_cost: number
  estimated_overhead_cost: number
  
  // Actual cost breakdowns
  actual_material_cost?: number
  actual_labor_cost?: number
  actual_equipment_cost?: number
  actual_overhead_cost?: number
  
  // Reference IDs
  estimate_id?: string | null
  lead_id?: string | null
  
  // Calculated fields
  gross_profit: number
  profit_margin: number
  cost_variance: number
  labor_variance: number
  is_profitable: boolean
  total_invoiced: number // Will be calculated from invoices
  
  // Enhanced profitability metrics
  expected_profit: number // contract_price - estimated_total_cost
  actual_profit: number // contract_price - actual_total_cost
  profit_variance: number // actual_profit - expected_profit
  profitability_score: 'A' | 'B' | 'C' | 'D' | 'F'
  burn_rate: number // actual_cost / days_elapsed
  completion_percentage: number
}

interface CostEntry {
  id: string
  job_id: string
  cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other'
  cost_subtype?: string // e.g., 'paint', 'drywall', 'lumber' for materials
  description: string
  quantity: number
  unit_cost: number
  total_cost: number
  cost_date: string
  vendor?: string
  receipt_url?: string
  created_by_name?: string
  
  // Enhanced cost tracking
  markup_percentage?: number // e.g., 20%
  markup_type?: 'flat' | 'margin'
  is_approved?: boolean
  approved_by?: string
  approval_notes?: string
  budget_category?: string // Links to budget line item
}

interface JobCostingDashboardProps {
  jobId?: string
  showSummaryOnly?: boolean
}

// Helper function to calculate profitability score
const calculateProfitabilityScore = (
  profitMargin: number,
  costVariance: number,
  laborVariance: number,
  estimatedCost: number
): 'A' | 'B' | 'C' | 'D' | 'F' => {
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

// Helper function to get alert thresholds
const getAlertThresholds = (job: JobCostData) => {
  const alerts = []
  
  // Cost overrun alert (>10% over budget)
  if (job.estimated_cost > 0) {
    const overrunPercent = (job.cost_variance / job.estimated_cost) * 100
    if (overrunPercent > 10) {
      alerts.push({
        type: 'danger',
        message: `Cost overrun: ${overrunPercent.toFixed(1)}% over budget`,
        icon: 'warning'
      })
    }
  }
  
  // Low profit margin alert (<5%)
  if (job.profit_margin < 5 && job.profit_margin >= 0) {
    alerts.push({
      type: 'warning',
      message: `Low profit margin: ${job.profit_margin.toFixed(1)}%`,
      icon: 'information'
    })
  }
  
  // Unprofitable alert
  if (job.profit_margin < 0) {
    alerts.push({
      type: 'danger',
      message: `Job is unprofitable: ${job.profit_margin.toFixed(1)}% margin`,
      icon: 'cross-circle'
    })
  }
  
  // Contract price missing alert
  if (job.contract_price === 0) {
    alerts.push({
      type: 'warning',
      message: `Contract price not set - profitability calculations may be incorrect`,
      icon: 'dollar'
    })
  }
  
  // High burn rate alert
  if (job.burn_rate > 0 && job.completion_percentage < 100) {
    const projectedTotalCost = job.burn_rate * (job.completion_percentage > 0 ? 
      (100 / job.completion_percentage) * 
      Math.floor((new Date().getTime() - new Date(job.start_date).getTime()) / (1000 * 60 * 60 * 24)) 
      : 30)
    
    if (projectedTotalCost > job.estimated_cost * 1.15) {
      alerts.push({
        type: 'warning',
        message: `High burn rate detected - projected to exceed budget`,
        icon: 'chart-line-up'
      })
    }
  }
  
  return alerts
}

const JobCostingDashboard: React.FC<JobCostingDashboardProps> = ({
  jobId,
  showSummaryOnly = false
}) => {
  const { userProfile } = useSupabaseAuth()
  
  // State
  const [jobs, setJobs] = useState<JobCostData[]>([])
  const [selectedJob, setSelectedJob] = useState<JobCostData | null>(null)
  const [costEntries, setCostEntries] = useState<CostEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'analysis'>('overview')
  const [editingContractPrice, setEditingContractPrice] = useState(false)
  const [contractPriceForm, setContractPriceForm] = useState(0)
  
  // Form states
  const [showCostModal, setShowCostModal] = useState(false)
  const [editingCost, setEditingCost] = useState<CostEntry | null>(null)
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [currentCostEntryId, setCurrentCostEntryId] = useState<string | null>(null)
  const [costForm, setCostForm] = useState<{
    cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other'
    cost_subtype: string
    description: string
    quantity: number
    unit_cost: number
    cost_date: string
    vendor: string
    receipt_url: string
    markup_percentage: number
    markup_type: 'flat' | 'margin'
  }>({
    cost_type: 'labor',
    cost_subtype: '',
    description: '',
    quantity: 1,
    unit_cost: 0,
    cost_date: new Date().toISOString().split('T')[0],
    vendor: '',
    receipt_url: '',
    markup_percentage: 0,
    markup_type: 'flat'
  })

  useEffect(() => {
    if (userProfile?.tenant_id) {
      if (jobId) {
        loadSingleJob(jobId)
      } else {
        loadJobsWithCosts()
      }
    }
  }, [userProfile?.tenant_id, jobId])

  // Subscribe to real-time cost updates
  useEffect(() => {
    if (!jobId || !userProfile?.tenant_id) return

    const subscription = supabase
      .channel('job_costs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'job_costs',
          filter: `job_id=eq.${jobId}`
        }, 
        (payload) => {
          console.log('🔄 Cost change detected, refreshing data...', payload)
          try {
            loadCostEntries(jobId)
            loadSingleJob(jobId) // Refresh job totals
          } catch (error) {
            console.error('Error refreshing data after cost change:', error)
          }
        }
      )
      .subscribe()

    return () => {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing from real-time updates:', error)
      }
    }
  }, [jobId, userProfile?.tenant_id])

  const loadJobsWithCosts = async () => {
    setLoading(true)
    try {
      if (!userProfile?.tenant_id) {
        throw new Error('User profile or tenant ID not available')
      }

      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          status,
          start_date,
          estimated_cost,
          actual_cost,
          estimated_hours,
          actual_hours,
          contract_price,
          estimate_id,
          lead_id,
          contacts(first_name, last_name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .not('status', 'eq', 'Draft')
        .order('start_date', { ascending: false })

      if (error) {
        console.error('Database error loading jobs:', error)
        throw new Error(`Failed to load jobs: ${error.message}`)
      }

      if (!jobsData || jobsData.length === 0) {
        console.log('No jobs found for tenant')
        setJobs([])
        setSelectedJob(null)
        return
      }

      // Process and calculate profitability metrics
      const processedJobs = await Promise.all(
        jobsData.map(async (job) => {
          try {
            return await calculateJobMetrics(job)
          } catch (error) {
            console.error(`Error calculating metrics for job ${job.id}:`, error)
            // Return job with default values if calculation fails
            const contact = job.contacts as any
            const contactName = contact && typeof contact === 'object' && !Array.isArray(contact) && 'first_name' in contact 
              ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown' 
              : 'Unknown'
            
            const fallbackMetrics: JobCostData = {
              id: job.id,
              title: job.title,
              status: job.status,
              start_date: job.start_date,
              contact_name: contactName,
              estimated_cost: job.estimated_cost || 0,
              actual_cost: job.actual_cost || 0,
              estimated_hours: job.estimated_hours || 0,
              actual_hours: job.actual_hours || 0,
              contract_price: job.contract_price || 0,
              estimated_material_cost: 0,
              estimated_labor_cost: 0,
              estimated_equipment_cost: 0,
              estimated_overhead_cost: 0,
              actual_material_cost: 0,
              actual_labor_cost: 0,
              actual_equipment_cost: 0,
              actual_overhead_cost: 0,
              total_invoiced: 0,
              gross_profit: 0,
              profit_margin: 0,
              cost_variance: 0,
              labor_variance: 0,
              is_profitable: false,
              expected_profit: 0,
              actual_profit: 0,
              profit_variance: 0,
              profitability_score: 'F' as const,
              burn_rate: 0,
              completion_percentage: 0,
              estimate_id: job.estimate_id || null,
              lead_id: job.lead_id || null
            }
            
            return fallbackMetrics
          }
        })
      )
      setJobs(processedJobs)

      // Auto-select first job if none selected
      if (processedJobs.length > 0 && !selectedJob) {
        setSelectedJob(processedJobs[0])
        try {
          await loadCostEntries(processedJobs[0].id)
        } catch (error) {
          console.error('Error loading cost entries for first job:', error)
        }
      }

    } catch (error) {
      console.error('Error loading jobs:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      showToast.error(`Failed to load job costing data: ${errorMessage}`)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const loadSingleJob = async (id: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          status,
          start_date,
          estimated_cost,
          actual_cost,
          estimated_hours,
          actual_hours,
          contract_price,
          estimate_id,
          lead_id,
          contacts(first_name, last_name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      const processedJob = await calculateJobMetrics(data)
      setSelectedJob(processedJob)
      setJobs([processedJob])
      loadCostEntries(id)

    } catch (error) {
      console.error('Error loading job:', error)
      showToast.error('Failed to load job data')
    } finally {
      setLoading(false)
    }
  }

  const loadCostEntries = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from('job_costs')
        .select(`
          *,
          user_profiles!created_by(first_name, last_name)
        `)
        .eq('job_id', jobId)
        .order('cost_date', { ascending: false })

      if (error) throw error

      const processedEntries = (data || []).map(entry => ({
        ...entry,
        created_by_name: entry.user_profiles 
          ? `${entry.user_profiles.first_name} ${entry.user_profiles.last_name}`
          : 'Unknown'
      }))

      setCostEntries(processedEntries)
    } catch (error) {
      console.error('Error loading cost entries:', error)
      showToast.error('Failed to load cost entries')
      setCostEntries([])
    }
  }

  const calculateJobMetrics = async (job: any): Promise<JobCostData> => {
    try {
      const actualCost = Math.max(0, job.actual_cost || 0)
      const estimatedCost = Math.max(0, job.estimated_cost || 0)
      
      // Get the accepted estimate to find the contract price
      let contractPrice = job.contract_price || 0
      if (job.estimate_id || job.lead_id) {
        try {
          let query = supabase
            .from('estimates')
            .select('total_amount, status')
            .eq('status', 'approved')
            
          // Build the OR condition based on what IDs we have
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
              contractPrice = estimate.total_amount
            }
          }
        } catch (error) {
          console.log('No approved estimate found for job')
        }
      }
      
      // Calculate total invoiced amount from invoices table
      let totalInvoiced = 0
      try {
        const { data: invoices, error } = await supabase
          .from('invoices')
          .select('total_amount')
          .eq('job_id', job.id)
          .eq('payment_status', 'paid')
        
        if (error) {
          console.error(`Error fetching invoices for job ${job.id}:`, error)
        } else {
          totalInvoiced = (invoices || []).reduce((sum, invoice) => {
            const amount = parseFloat(invoice.total_amount) || 0
            return sum + (isNaN(amount) ? 0 : amount)
          }, 0)
        }
      } catch (error) {
        console.error('Error calculating invoiced amount:', error)
        totalInvoiced = 0
      }
      
      // PROPER FINANCIAL CALCULATIONS
      // Using the accepted estimate total as the contract price
      
      const expectedProfit = contractPrice - estimatedCost  // What we expected to make
      const actualProfit = contractPrice - actualCost      // What we actually made
      const profitVariance = actualProfit - expectedProfit
      
      const grossProfit = totalInvoiced - actualCost
      const profitMargin = contractPrice > 0 ? (expectedProfit / contractPrice) * 100 : 0
      const costVariance = actualCost - estimatedCost  // How much over/under budget we are
      const laborVariance = (job.actual_hours || 0) - (job.estimated_hours || 0)
      
      // Calculate burn rate and completion metrics
      const startDate = new Date(job.start_date)
      const now = new Date()
      const daysElapsed = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      const burnRate = actualCost / daysElapsed
      const completionPercentage = job.completion_percentage || 0
      
      // Calculate profitability score
      const profitabilityScore = calculateProfitabilityScore(profitMargin, costVariance, laborVariance, estimatedCost)
      
      // Validate calculated values
      const safeMetrics = {
        total_invoiced: isNaN(totalInvoiced) ? 0 : totalInvoiced,
        gross_profit: isNaN(grossProfit) ? 0 : grossProfit,
        profit_margin: isNaN(profitMargin) ? 0 : profitMargin,
        cost_variance: isNaN(costVariance) ? 0 : costVariance,
        labor_variance: isNaN(laborVariance) ? 0 : laborVariance,
        is_profitable: !isNaN(actualProfit) && actualProfit > 0,
        expected_profit: isNaN(expectedProfit) ? 0 : expectedProfit,
        actual_profit: isNaN(actualProfit) ? 0 : actualProfit,
        profit_variance: isNaN(profitVariance) ? 0 : profitVariance,
        profitability_score: profitabilityScore,
        burn_rate: isNaN(burnRate) ? 0 : burnRate,
        completion_percentage: isNaN(completionPercentage) ? 0 : completionPercentage,
        contract_price: isNaN(contractPrice) ? 0 : contractPrice,
        estimated_material_cost: job.estimated_material_cost || 0,
        estimated_labor_cost: job.estimated_labor_cost || 0,
        estimated_equipment_cost: job.estimated_equipment_cost || 0,
        estimated_overhead_cost: job.estimated_overhead_cost || 0
      }
      
      return {
        ...job,
        contact_name: job.contacts && typeof job.contacts === 'object' && 'first_name' in job.contacts 
          ? `${job.contacts.first_name} ${job.contacts.last_name}` 
          : 'Unknown',
        ...safeMetrics,
        // Add missing fields
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_equipment_cost: 0,
        actual_overhead_cost: 0,
        estimate_id: job.estimate_id || null,
        lead_id: job.lead_id || null
      } as JobCostData
    } catch (error) {
      console.error(`Error calculating job metrics for job ${job.id}:`, error)
      // Return safe default values if calculation fails
      return {
        ...job,
        contact_name: job.contacts && typeof job.contacts === 'object' && 'first_name' in job.contacts 
          ? `${job.contacts.first_name} ${job.contacts.last_name}` 
          : 'Unknown',
        total_invoiced: 0,
        gross_profit: 0,
        profit_margin: 0,
        cost_variance: 0,
        labor_variance: 0,
        is_profitable: false,
        expected_profit: 0,
        actual_profit: 0,
        profit_variance: 0,
        profitability_score: 'F' as const,
        burn_rate: 0,
        completion_percentage: 0,
        contract_price: 0,
        estimated_material_cost: 0,
        estimated_labor_cost: 0,
        estimated_equipment_cost: 0,
        estimated_overhead_cost: 0,
        actual_material_cost: 0,
        actual_labor_cost: 0,
        actual_equipment_cost: 0,
        actual_overhead_cost: 0,
        estimate_id: job.estimate_id || null,
        lead_id: job.lead_id || null
      } as JobCostData
    }
  }

  const handleSaveCost = async () => {
    if (!selectedJob) {
      showToast.error('No job selected')
      return
    }

    if (!userProfile?.tenant_id || !userProfile?.id) {
      showToast.error('User authentication required')
      return
    }

    // Validate form data
    if (!costForm.description.trim()) {
      showToast.error('Description is required')
      return
    }

    if (costForm.quantity <= 0) {
      showToast.error('Quantity must be greater than 0')
      return
    }

    if (costForm.unit_cost <= 0) {
      showToast.error('Unit cost must be greater than 0')
      return
    }

    try {
      const totalCost = costForm.quantity * costForm.unit_cost
      if (isNaN(totalCost) || totalCost <= 0) {
        throw new Error('Invalid cost calculation')
      }

      const costData = {
        job_id: selectedJob.id,
        tenant_id: userProfile.tenant_id,
        ...costForm,
        total_cost: totalCost,
        created_by: userProfile.id
      }

      if (editingCost) {
        const { error } = await supabase
          .from('job_costs')
          .update(costData)
          .eq('id', editingCost.id)

        if (error) {
          console.error('Error updating cost entry:', error)
          throw new Error(`Failed to update cost entry: ${error.message}`)
        }
        showToast.success('Cost entry updated successfully')
      } else {
        const { error } = await supabase
          .from('job_costs')
          .insert(costData)

        if (error) {
          console.error('Error adding cost entry:', error)
          throw new Error(`Failed to add cost entry: ${error.message}`)
        }
        showToast.success('Cost entry added successfully')
      }

      // Update job actual costs
      await updateJobActualCosts(selectedJob.id)
      
      setShowCostModal(false)
      resetCostForm()
      
      // Refresh data
      try {
        await loadCostEntries(selectedJob.id)
        await loadJobsWithCosts()
      } catch (refreshError) {
        console.error('Error refreshing data:', refreshError)
        showToast.error('Cost saved but failed to refresh display')
      }

    } catch (error) {
      console.error('Error saving cost:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      showToast.error(`Failed to save cost entry: ${errorMessage}`)
    }
  }

  const updateJobActualCosts = async (jobId: string) => {
    try {
      if (!jobId) {
        throw new Error('Job ID is required')
      }

      // Calculate total actual costs from cost entries
      const { data: costs, error: costsError } = await supabase
        .from('job_costs')
        .select('cost_type, total_cost')
        .eq('job_id', jobId)

      if (costsError) {
        console.error('Error fetching job costs:', costsError)
        throw new Error(`Failed to fetch costs: ${costsError.message}`)
      }

      const totalActualCost = (costs || []).reduce((sum, c) => {
        const cost = parseFloat(c.total_cost) || 0
        return sum + (isNaN(cost) ? 0 : cost)
      }, 0)

      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          actual_cost: totalActualCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

      if (updateError) {
        console.error('Error updating job actual costs:', updateError)
        throw new Error(`Failed to update job costs: ${updateError.message}`)
      }

    } catch (error) {
      console.error('Error updating job costs:', error)
      showToast.error('Failed to update job cost totals')
    }
  }

  const resetCostForm = () => {
    setCostForm({
      cost_type: 'labor',
      cost_subtype: '',
      description: '',
      quantity: 1,
      unit_cost: 0,
      cost_date: new Date().toISOString().split('T')[0],
      vendor: '',
      receipt_url: '',
      markup_percentage: 0,
      markup_type: 'flat'
    })
    setEditingCost(null)
  }

  const deleteCostEntry = async (costId: string) => {
    if (!window.confirm('Are you sure you want to delete this cost entry?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('job_costs')
        .delete()
        .eq('id', costId)

      if (error) throw error

      // Update job actual costs after deletion
      if (selectedJob) {
        await updateJobActualCosts(selectedJob.id)
        loadCostEntries(selectedJob.id)
        loadSingleJob(selectedJob.id) // Refresh job data
      }
      
      showToast.success('Cost entry deleted successfully')

    } catch (error) {
      console.error('Error deleting cost entry:', error)
      showToast.error('Failed to delete cost entry')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'In Progress': 'primary',
      'Completed': 'success',
      'On Hold': 'warning',
      'Cancelled': 'danger'
    }
    return colors[status] || 'secondary'
  }

  const getProfitabilityScoreColor = (score: 'A' | 'B' | 'C' | 'D' | 'F') => {
    const colors: Record<string, string> = {
      'A': 'success',
      'B': 'primary',
      'C': 'warning',
      'D': 'danger',
      'F': 'dark'
    }
    return colors[score] || 'secondary'
  }

  const getCostTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'labor': 'primary',
      'material': 'success',
      'equipment': 'info',
      'subcontractor': 'warning',
      'overhead': 'secondary',
      'other': 'dark'
    }
    return colors[type] || 'secondary'
  }

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-10">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (showSummaryOnly && selectedJob) {
    return (
      <div className="card">
        <div className="card-body">
          <h6 className="card-title mb-3">Job Profitability</h6>
          <div className="row g-3">
            <div className="col-6">
              <div className="text-center p-3 bg-light-success rounded">
                <div className="fw-bold text-dark">{formatCurrency(selectedJob.gross_profit)}</div>
                <div className="text-muted fs-8">Gross Profit</div>
              </div>
            </div>
            <div className="col-6">
              <div className="text-center p-3 bg-light-info rounded">
                <div className="fw-bold text-dark">{selectedJob.profit_margin.toFixed(1)}%</div>
                <div className="text-muted fs-8">Profit Margin</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="row g-6">
      {/* Contract Price Notice */}
      {selectedJob && selectedJob.contract_price === 0 && (
        <div className="col-12">
          <div className="alert alert-warning d-flex align-items-center p-5">
            <i className="ki-duotone ki-dollar fs-2hx text-warning me-4">
              <span className="path1"></span>
              <span className="path2"></span>
            </i>
            <div className="d-flex flex-column">
              <h5 className="mb-1">Contract Price Not Set</h5>
              <span>The contract price should be pulled from your accepted estimate. Click the edit button to set it manually or ensure the estimate is marked as approved.</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Jobs List */}
      {!jobId && (
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Active Jobs</h5>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    className={`list-group-item list-group-item-action ${
                      selectedJob?.id === job.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelectedJob(job)
                      loadCostEntries(job.id)
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        <h6 className="mb-1">{job.title}</h6>
                        <p className="mb-1 fs-7">Job ID: {job.id.slice(0, 8)}</p>
                        <small className="text-muted">{job.contact_name}</small>
                      </div>
                      <div className="text-end">
                        <div className="d-flex gap-1 mb-1">
                          <span className={`badge badge-light-${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                          <span className={`badge badge-light-${getProfitabilityScoreColor(job.profitability_score)}`}>
                            {job.profitability_score}
                          </span>
                        </div>
                        <div className={`fs-7 fw-bold ${job.is_profitable ? 'text-success' : 'text-danger'}`}>
                          {formatCurrency(job.actual_profit)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Details */}
      <div className={jobId ? 'col-12' : 'col-lg-8'}>
        {selectedJob ? (
          <div className="card">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h3 className="card-title mb-0">
                  {selectedJob.title}
                </h3>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    resetCostForm()
                    setShowCostModal(true)
                  }}
                >
                  <i className="ki-duotone ki-plus fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Add Cost
                </button>
              </div>
              
              {/* Tab Navigation */}
              <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-6 fw-bold mt-4">
                <li className="nav-item">
                  <a
                    className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('overview')
                    }}
                  >
                    Overview
                  </a>
                </li>
                <li className="nav-item">
                  <a
                    className={`nav-link ${activeTab === 'costs' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('costs')
                    }}
                  >
                    Cost Entries ({costEntries.length})
                  </a>
                </li>
                <li className="nav-item">
                  <a
                    className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setActiveTab('analysis')
                    }}
                  >
                    Analysis
                  </a>
                </li>
              </ul>
            </div>

            <div className="card-body">
              {activeTab === 'overview' && (
                <div>
                  {/* Alert System */}
                  {(() => {
                    const alerts = getAlertThresholds(selectedJob)
                    return alerts.length > 0 ? (
                      <div className="mb-6">
                        {alerts.map((alert, index) => (
                          <div key={index} className={`alert alert-${alert.type} d-flex align-items-center p-5 mb-3`}>
                            <i className={`ki-duotone ki-${alert.icon} fs-2hx text-${alert.type} me-4`}>
                              <span className="path1"></span>
                              <span className="path2"></span>
                            </i>
                            <div className="d-flex flex-column">
                              <h5 className="mb-1">Alert</h5>
                              <span>{alert.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}

                  {/* Key Metrics */}
                  <div className="row g-4 mb-6">
                    <div className="col-md-3">
                      <div className="card border border-light h-100">
                        <div className="card-body text-center">
                          <i className="ki-duotone ki-dollar fs-2x text-success mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                            <span className="path3"></span>
                          </i>
                          <div className="fs-2x fw-bold text-dark">
                            {formatCurrency(selectedJob.actual_profit)}
                          </div>
                          <div className="text-muted fs-7">Actual Profit</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-3">
                      <div className="card border border-light h-100">
                        <div className="card-body text-center">
                          <i className="ki-duotone ki-percentage fs-2x text-primary mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div className="fs-2x fw-bold text-dark">
                            {formatPercentage(selectedJob.profit_margin)}
                          </div>
                          <div className="text-muted fs-7">Profit Margin</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-3">
                      <div className="card border border-light h-100">
                        <div className="card-body text-center">
                          <i className="ki-duotone ki-chart-line-up fs-2x text-info mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div className={`fs-2x fw-bold ${selectedJob.cost_variance >= 0 ? 'text-danger' : 'text-success'}`}>
                            {selectedJob.cost_variance >= 0 ? '+' : ''}{formatCurrency(selectedJob.cost_variance)}
                          </div>
                          <div className="text-muted fs-7">Cost Variance</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-3">
                      <div className="card border border-light h-100">
                        <div className="card-body text-center">
                          <div className={`symbol symbol-50px symbol-circle bg-light-${getProfitabilityScoreColor(selectedJob.profitability_score)} mb-3`}>
                            <div className="symbol-label">
                              <span className={`fs-2x fw-bold text-${getProfitabilityScoreColor(selectedJob.profitability_score)}`}>
                                {selectedJob.profitability_score}
                              </span>
                            </div>
                          </div>
                          <div className="text-muted fs-7">Profitability Score</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="row g-6">
                    <div className="col-md-6">
                      <h6 className="mb-4">Cost Breakdown</h6>
                      <div className="table-responsive">
                        <table className="table table-row-bordered">
                          <tbody>
                            <tr>
                              <td className="fw-bold text-muted">Contract Price</td>
                              <td className="text-end">
                                {editingContractPrice ? (
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="text-muted">$</span>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      style={{ width: '120px' }}
                                      value={contractPriceForm}
                                      onChange={(e) => setContractPriceForm(parseFloat(e.target.value) || 0)}
                                      min="0"
                                      step="0.01"
                                      autoFocus
                                    />
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={async () => {
                                        if (contractPriceForm <= 0) {
                                          showToast.error('Contract price must be greater than 0')
                                          return
                                        }
                                        try {
                                          const { error } = await supabase
                                            .from('jobs')
                                            .update({ 
                                              contract_price: contractPriceForm,
                                              updated_at: new Date().toISOString()
                                            })
                                            .eq('id', selectedJob.id)
                                          if (error) throw error
                                          showToast.success('Contract price updated')
                                          setEditingContractPrice(false)
                                          // Refresh the job data
                                          if (jobId) {
                                            await loadSingleJob(selectedJob.id)
                                          } else {
                                            await loadJobsWithCosts()
                                          }
                                        } catch (error) {
                                          console.error('Error updating contract price:', error)
                                          showToast.error('Failed to update contract price')
                                        }
                                      }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => {
                                        setContractPriceForm(selectedJob.contract_price)
                                        setEditingContractPrice(false)
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="d-flex align-items-center gap-2">
                                    <span className={selectedJob.contract_price === 0 ? 'text-danger' : ''}>
                                      {formatCurrency(selectedJob.contract_price)}
                                    </span>
                                    <button
                                      className="btn btn-sm btn-icon btn-light-primary"
                                      onClick={() => {
                                        setContractPriceForm(selectedJob.contract_price)
                                        setEditingContractPrice(true)
                                      }}
                                      title="Edit contract price"
                                    >
                                      <i className="ki-duotone ki-pencil fs-6">
                                        <span className="path1"></span>
                                        <span className="path2"></span>
                                      </i>
                                    </button>
                                    {selectedJob.contract_price === 0 && (
                                      <span className="badge badge-light-danger">
                                        From accepted estimate
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Estimated Cost</td>
                              <td className="text-end">{formatCurrency(selectedJob.estimated_cost)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Actual Cost</td>
                              <td className="text-end">{formatCurrency(selectedJob.actual_cost)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Cost Variance</td>
                              <td className={`text-end fw-bold ${selectedJob.cost_variance >= 0 ? 'text-danger' : 'text-success'}`}>
                                {selectedJob.cost_variance >= 0 ? '+' : ''}{formatCurrency(selectedJob.cost_variance)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Burn Rate/Day</td>
                              <td className="text-end">{formatCurrency(selectedJob.burn_rate)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <h6 className="mb-4">Profit Analysis</h6>
                      <div className="table-responsive">
                        <table className="table table-row-bordered">
                          <tbody>
                            <tr>
                              <td className="fw-bold text-muted">Expected Profit</td>
                              <td className="text-end">{formatCurrency(selectedJob.expected_profit)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Actual Profit</td>
                              <td className={`text-end fw-bold ${selectedJob.is_profitable ? 'text-success' : 'text-danger'}`}>
                                {formatCurrency(selectedJob.actual_profit)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Profit Variance</td>
                              <td className={`text-end fw-bold ${selectedJob.profit_variance >= 0 ? 'text-success' : 'text-danger'}`}>
                                {selectedJob.profit_variance >= 0 ? '+' : ''}{formatCurrency(selectedJob.profit_variance)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Total Invoiced</td>
                              <td className="text-end">{formatCurrency(selectedJob.total_invoiced)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Completion</td>
                              <td className="text-end">{formatPercentage(selectedJob.completion_percentage)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'costs' && (
                <div>
                  {costEntries.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                        <thead>
                          <tr className="fw-bold text-muted">
                            <th className="min-w-100px">Date</th>
                            <th className="min-w-100px">Type</th>
                            <th className="min-w-200px">Description</th>
                            <th className="w-80px">Qty</th>
                            <th className="w-100px">Unit Cost</th>
                            <th className="w-100px">Total</th>
                            <th className="min-w-100px">Vendor</th>
                            <th className="w-80px text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costEntries.map((cost) => (
                            <tr key={cost.id}>
                              <td>
                                <span className="text-dark">
                                  {new Date(cost.cost_date).toLocaleDateString()}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge-light-${getCostTypeColor(cost.cost_type)}`}>
                                  {cost.cost_type}
                                </span>
                              </td>
                              <td>
                                <div className="d-flex flex-column">
                                  <span className="text-dark fw-semibold">{cost.description}</span>
                                  {cost.created_by_name && (
                                    <span className="text-muted fs-8">by {cost.created_by_name}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className="text-dark">{cost.quantity}</span>
                              </td>
                              <td>
                                <span className="text-dark">{formatCurrency(cost.unit_cost)}</span>
                              </td>
                              <td>
                                <span className="text-dark fw-bold">{formatCurrency(cost.total_cost)}</span>
                              </td>
                              <td>
                                <span className="text-muted">{cost.vendor || '-'}</span>
                              </td>
                              <td className="text-end">
                                <div className="d-flex gap-1">
                                  <button
                                    className="btn btn-sm btn-icon btn-light-primary"
                                    onClick={() => {
                                      setEditingCost(cost)
                                      setCostForm({
                                        cost_type: cost.cost_type,
                                        cost_subtype: cost.cost_subtype || '',
                                        description: cost.description,
                                        quantity: cost.quantity,
                                        unit_cost: cost.unit_cost,
                                        cost_date: cost.cost_date,
                                        vendor: cost.vendor || '',
                                        receipt_url: cost.receipt_url || '',
                                        markup_percentage: cost.markup_percentage || 0,
                                        markup_type: cost.markup_type || 'flat'
                                      })
                                      setShowCostModal(true)
                                    }}
                                  >
                                    <i className="ki-duotone ki-pencil fs-6">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-icon btn-light-success"
                                    onClick={() => {
                                      setCurrentCostEntryId(cost.id)
                                      setShowPhotoCapture(true)
                                    }}
                                    title="Add Receipt Photo"
                                  >
                                    <i className="ki-duotone ki-camera fs-6">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                    </i>
                                  </button>
                                  <button
                                    className="btn btn-sm btn-icon btn-light-danger"
                                    onClick={() => deleteCostEntry(cost.id)}
                                    title="Delete cost entry"
                                  >
                                    <i className="ki-duotone ki-trash fs-6">
                                      <span className="path1"></span>
                                      <span className="path2"></span>
                                      <span className="path3"></span>
                                      <span className="path4"></span>
                                      <span className="path5"></span>
                                    </i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <i className="ki-duotone ki-bill fs-3x text-muted mb-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                        <span className="path5"></span>
                        <span className="path6"></span>
                      </i>
                      <h5 className="text-muted">No Cost Entries</h5>
                      <p className="text-muted">
                        Start tracking job costs by adding your first cost entry.
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          resetCostForm()
                          setShowCostModal(true)
                        }}
                      >
                        Add First Cost Entry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div>
                  {/* Profitability Analysis */}
                  <div className="alert alert-light-primary mb-6">
                    <h5 className="alert-heading">Profitability Analysis</h5>
                    <p className="mb-2">
                      This job is currently {selectedJob.is_profitable ? 
                        <span className="text-success fw-bold">PROFITABLE</span> : 
                        <span className="text-danger fw-bold">UNPROFITABLE</span>
                      } with a {Math.abs(selectedJob.profit_margin).toFixed(1)}% margin.
                    </p>
                    {!selectedJob.is_profitable && (
                      <p className="mb-0 text-danger">
                        <strong>Action Required:</strong> Review costs and pricing to improve profitability.
                      </p>
                    )}
                  </div>

                  {/* Cost Distribution */}
                  <div className="row g-6">
                    <div className="col-md-6">
                      <h6 className="mb-4">Cost Distribution</h6>
                      <div className="d-flex flex-column gap-3">
                        {['labor', 'material', 'equipment', 'subcontractor', 'overhead', 'other'].map(type => {
                          try {
                            const typeCosts = costEntries.filter(c => c.cost_type === type)
                            const totalTypeCost = typeCosts.reduce((sum, c) => {
                              const cost = Number(c.total_cost) || 0
                              return sum + (isNaN(cost) ? 0 : cost)
                            }, 0)
                            const percentage = selectedJob.actual_cost > 0 ? (totalTypeCost / selectedJob.actual_cost) * 100 : 0
                            const safePercentage = isNaN(percentage) ? 0 : percentage
                            
                            return (
                              <div key={type} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                  <span className={`badge badge-circle badge-${getCostTypeColor(type)} me-3`}></span>
                                  <span className="fw-semibold text-capitalize">{type}</span>
                                </div>
                                <div className="text-end">
                                  <div className="fw-bold">{formatCurrency(totalTypeCost)}</div>
                                  <div className="text-muted fs-8">{safePercentage.toFixed(1)}%</div>
                                </div>
                              </div>
                            )
                          } catch (error) {
                            console.error(`Error calculating costs for type ${type}:`, error)
                            return (
                              <div key={type} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                  <span className={`badge badge-circle badge-${getCostTypeColor(type)} me-3`}></span>
                                  <span className="fw-semibold text-capitalize">{type}</span>
                                </div>
                                <div className="text-end">
                                  <div className="fw-bold">$0.00</div>
                                  <div className="text-muted fs-8">0.0%</div>
                                </div>
                              </div>
                            )
                          }
                        })}  
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <h6 className="mb-4">Performance Indicators</h6>
                      <div className="d-flex flex-column gap-4">
                        <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                          <span className="fw-semibold">Estimated vs Actual</span>
                          <div className="text-end">
                            <div className={`fw-bold ${selectedJob.cost_variance <= 0 ? 'text-success' : 'text-danger'}`}>
                              {selectedJob.cost_variance <= 0 ? 'On Budget' : 'Over Budget'}
                            </div>
                            <div className="text-muted fs-8">
                              {selectedJob.estimated_cost > 0 
                                ? `${Math.abs(selectedJob.cost_variance / selectedJob.estimated_cost * 100).toFixed(1)}% variance`
                                : 'No estimate available'
                              }
                            </div>
                          </div>
                        </div>
                        
                        <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                          <span className="fw-semibold">Labor Efficiency</span>
                          <div className="text-end">
                            <div className={`fw-bold ${selectedJob.labor_variance <= 0 ? 'text-success' : 'text-warning'}`}>
                              {selectedJob.labor_variance <= 0 ? 'Efficient' : 'Over Time'}
                            </div>
                            <div className="text-muted fs-8">
                              {selectedJob.actual_hours || 0}h / {selectedJob.estimated_hours || 0}h
                            </div>
                          </div>
                        </div>
                        
                        <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                          <span className="fw-semibold">Revenue Recognition</span>
                          <div className="text-end">
                            <div className="fw-bold text-primary">
                              {selectedJob.estimated_cost > 0 
                                ? ((selectedJob.total_invoiced / (selectedJob.estimated_cost * 1.2)) * 100).toFixed(1) 
                                : '0'}%
                            </div>
                            <div className="text-muted fs-8">of expected revenue</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body text-center py-10">
              <i className="ki-duotone ki-chart-line-up fs-3x text-muted mb-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <h5 className="text-muted">Select a Job</h5>
              <p className="text-muted">Choose a job from the list to view detailed costing information.</p>
            </div>
          </div>
        )}
      </div>

      {/* Cost Entry Modal */}
      {showCostModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingCost ? 'Edit Cost Entry' : 'Add Cost Entry'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCostModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-4">
                  <div className="col-md-4">
                    <label className="form-label required">Cost Type</label>
                    <select
                      className="form-select"
                      value={costForm.cost_type}
                      onChange={(e) => setCostForm(prev => ({ ...prev, cost_type: e.target.value as any }))}
                    >
                      <option value="labor">Labor</option>
                      <option value="material">Material</option>
                      <option value="equipment">Equipment</option>
                      <option value="subcontractor">Subcontractor</option>
                      <option value="overhead">Overhead</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Subcategory</label>
                    <input
                      type="text"
                      className="form-control"
                      value={costForm.cost_subtype}
                      onChange={(e) => setCostForm(prev => ({ ...prev, cost_subtype: e.target.value }))}
                      placeholder={costForm.cost_type === 'material' ? 'e.g., paint, drywall' : costForm.cost_type === 'labor' ? 'e.g., plumbing, electrical' : 'Optional subcategory'}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={costForm.cost_date}
                      onChange={(e) => setCostForm(prev => ({ ...prev, cost_date: e.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label required">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={costForm.description}
                      onChange={(e) => setCostForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g., 4 hours of plumbing work"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Quantity</label>
                    <input
                      type="number"
                      className="form-control"
                      value={costForm.quantity}
                      onChange={(e) => setCostForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label required">Unit Cost</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={costForm.unit_cost}
                        onChange={(e) => setCostForm(prev => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Total Cost</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="text"
                        className="form-control"
                        value={(costForm.quantity * costForm.unit_cost).toFixed(2)}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Vendor/Supplier</label>
                    <input
                      type="text"
                      className="form-control"
                      value={costForm.vendor}
                      onChange={(e) => setCostForm(prev => ({ ...prev, vendor: e.target.value }))}
                      placeholder="Optional vendor name"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Markup %</label>
                    <input
                      type="number"
                      className="form-control"
                      value={costForm.markup_percentage}
                      onChange={(e) => setCostForm(prev => ({ ...prev, markup_percentage: parseFloat(e.target.value) || 0 }))}
                      min="0"
                      step="0.1"
                      placeholder="20"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Markup Type</label>
                    <select
                      className="form-select"
                      value={costForm.markup_type}
                      onChange={(e) => setCostForm(prev => ({ ...prev, markup_type: e.target.value as any }))}
                    >
                      <option value="flat">Flat Rate</option>
                      <option value="margin">Margin</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Receipt Photo</label>
                    <button
                      type="button"
                      className="btn btn-light-success w-100"
                      onClick={() => {
                        setCurrentCostEntryId(editingCost?.id || null)
                        setShowPhotoCapture(true)
                      }}
                    >
                      <i className="ki-duotone ki-camera fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Take Receipt Photo
                    </button>
                    <div className="form-text">
                      Capture receipt photos for expense documentation and tax purposes
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowCostModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveCost}
                  disabled={!costForm.description || costForm.quantity <= 0 || costForm.unit_cost <= 0}
                >
                  {editingCost ? 'Update' : 'Add'} Cost Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Capture Component */}
      <PhotoCapture
        isOpen={showPhotoCapture}
        onClose={() => {
          setShowPhotoCapture(false)
          setCurrentCostEntryId(null)
        }}
        onPhotoSaved={(photoUrl, photoId) => {
          console.log('Photo saved:', photoUrl, photoId)
          showToast.success('Receipt photo saved successfully!')
        }}
        jobId={selectedJob?.id}
        costEntryId={currentCostEntryId || undefined}
        photoType="receipt"
        title="Receipt Photo"
      />
    </div>
  )
}

export default JobCostingDashboard
