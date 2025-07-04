import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'
import PhotoCapture from '../shared/PhotoCapture'

interface JobCostData {
  id: string
  job_number: string
  title: string
  status: string
  start_date: string
  contact_name: string
  
  // Financial data
  estimated_cost: number
  actual_cost: number
  total_invoiced: number
  
  // Labor
  labor_hours_estimated: number
  labor_hours_actual: number
  labor_rate: number
  
  // Materials & other costs
  material_cost_estimated: number
  material_cost_actual: number
  overhead_percentage: number
  profit_margin_percentage: number
  
  // Calculated fields
  gross_profit: number
  profit_margin: number
  cost_variance: number
  labor_variance: number
  is_profitable: boolean
}

interface CostEntry {
  id: string
  job_id: string
  cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other'
  description: string
  quantity: number
  unit_cost: number
  total_cost: number
  cost_date: string
  vendor?: string
  receipt_url?: string
  created_by_name?: string
}

interface JobCostingDashboardProps {
  jobId?: string
  showSummaryOnly?: boolean
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
  
  // Form states
  const [showCostModal, setShowCostModal] = useState(false)
  const [editingCost, setEditingCost] = useState<CostEntry | null>(null)
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [currentCostEntryId, setCurrentCostEntryId] = useState<string | null>(null)
  const [costForm, setCostForm] = useState<{
    cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead' | 'other'
    description: string
    quantity: number
    unit_cost: number
    cost_date: string
    vendor: string
    receipt_url: string
  }>({
    cost_type: 'labor',
    description: '',
    quantity: 1,
    unit_cost: 0,
    cost_date: new Date().toISOString().split('T')[0],
    vendor: '',
    receipt_url: ''
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
          loadCostEntries(jobId)
          loadSingleJob(jobId) // Refresh job totals
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [jobId, userProfile?.tenant_id])

  const loadJobsWithCosts = async () => {
    setLoading(true)
    try {
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          id,
          job_number,
          title,
          status,
          start_date,
          estimated_cost,
          actual_cost,
          total_invoiced,
          labor_hours_estimated,
          labor_hours_actual,
          labor_rate,
          material_cost_estimated,
          material_cost_actual,
          overhead_percentage,
          profit_margin_percentage,
          contacts(first_name, last_name)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .in('status', ['In Progress', 'Completed', 'On Hold'])
        .order('start_date', { ascending: false })

      if (error) throw error

      // Process and calculate profitability metrics
      const processedJobs = (jobsData || []).map(job => calculateJobMetrics(job))
      setJobs(processedJobs)

      // Auto-select first job if none selected
      if (processedJobs.length > 0 && !selectedJob) {
        setSelectedJob(processedJobs[0])
        loadCostEntries(processedJobs[0].id)
      }

    } catch (error) {
      console.error('Error loading jobs:', error)
      showToast.error('Failed to load job costing data')
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
          job_number,
          title,
          status,
          start_date,
          estimated_cost,
          actual_cost,
          total_invoiced,
          labor_hours_estimated,
          labor_hours_actual,
          labor_rate,
          material_cost_estimated,
          material_cost_actual,
          overhead_percentage,
          profit_margin_percentage,
          contacts(first_name, last_name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      const processedJob = calculateJobMetrics(data)
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
    }
  }

  const calculateJobMetrics = (job: any): JobCostData => {
    const totalInvoiced = job.total_invoiced || 0
    const actualCost = job.actual_cost || 0
    const estimatedCost = job.estimated_cost || 0
    
    const grossProfit = totalInvoiced - actualCost
    const profitMargin = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0
    const costVariance = actualCost - estimatedCost
    const laborVariance = (job.labor_hours_actual || 0) - (job.labor_hours_estimated || 0)
    
    return {
      ...job,
      contact_name: job.contacts ? `${job.contacts.first_name} ${job.contacts.last_name}` : 'Unknown',
      gross_profit: grossProfit,
      profit_margin: profitMargin,
      cost_variance: costVariance,
      labor_variance: laborVariance,
      is_profitable: grossProfit > 0
    }
  }

  const handleSaveCost = async () => {
    if (!selectedJob) return

    try {
      const costData = {
        job_id: selectedJob.id,
        tenant_id: userProfile?.tenant_id,
        ...costForm,
        total_cost: costForm.quantity * costForm.unit_cost,
        created_by: userProfile?.id
      }

      if (editingCost) {
        const { error } = await supabase
          .from('job_costs')
          .update(costData)
          .eq('id', editingCost.id)

        if (error) throw error
        showToast.success('Cost entry updated successfully')
      } else {
        const { error } = await supabase
          .from('job_costs')
          .insert(costData)

        if (error) throw error
        showToast.success('Cost entry added successfully')
      }

      // Update job actual costs
      await updateJobActualCosts(selectedJob.id)
      
      setShowCostModal(false)
      resetCostForm()
      loadCostEntries(selectedJob.id)
      loadJobsWithCosts()

    } catch (error) {
      console.error('Error saving cost:', error)
      showToast.error('Failed to save cost entry')
    }
  }

  const updateJobActualCosts = async (jobId: string) => {
    try {
      // Calculate total actual costs from cost entries
      const { data: costs } = await supabase
        .from('job_costs')
        .select('cost_type, total_cost')
        .eq('job_id', jobId)

      if (!costs) return

      const laborCost = costs
        .filter(c => c.cost_type === 'labor')
        .reduce((sum, c) => sum + c.total_cost, 0)
      
      const materialCost = costs
        .filter(c => c.cost_type === 'material')
        .reduce((sum, c) => sum + c.total_cost, 0)
      
      const totalActualCost = costs.reduce((sum, c) => sum + c.total_cost, 0)

      await supabase
        .from('jobs')
        .update({
          actual_cost: totalActualCost,
          material_cost_actual: materialCost,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)

    } catch (error) {
      console.error('Error updating job costs:', error)
    }
  }

  const resetCostForm = () => {
    setCostForm({
      cost_type: 'labor',
      description: '',
      quantity: 1,
      unit_cost: 0,
      cost_date: new Date().toISOString().split('T')[0],
      vendor: '',
      receipt_url: ''
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'In Progress': 'primary',
      'Completed': 'success',
      'On Hold': 'warning',
      'Cancelled': 'danger'
    }
    return colors[status] || 'secondary'
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
                        <h6 className="mb-1">{job.job_number}</h6>
                        <p className="mb-1 fs-7">{job.title}</p>
                        <small className="text-muted">{job.contact_name}</small>
                      </div>
                      <div className="text-end">
                        <span className={`badge badge-light-${getStatusColor(job.status)} mb-1`}>
                          {job.status}
                        </span>
                        <div className={`fs-7 fw-bold ${job.is_profitable ? 'text-success' : 'text-danger'}`}>
                          {formatCurrency(job.gross_profit)}
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
                  {selectedJob.job_number} - {selectedJob.title}
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
                            {formatCurrency(selectedJob.gross_profit)}
                          </div>
                          <div className="text-muted fs-7">Gross Profit</div>
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
                            {selectedJob.profit_margin.toFixed(1)}%
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
                          <i className="ki-duotone ki-time fs-2x text-warning mb-3">
                            <span className="path1"></span>
                            <span className="path2"></span>
                          </i>
                          <div className={`fs-2x fw-bold ${selectedJob.labor_variance >= 0 ? 'text-danger' : 'text-success'}`}>
                            {selectedJob.labor_variance >= 0 ? '+' : ''}{selectedJob.labor_variance.toFixed(1)}h
                          </div>
                          <div className="text-muted fs-7">Labor Variance</div>
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
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <h6 className="mb-4">Revenue & Profit</h6>
                      <div className="table-responsive">
                        <table className="table table-row-bordered">
                          <tbody>
                            <tr>
                              <td className="fw-bold text-muted">Total Invoiced</td>
                              <td className="text-end">{formatCurrency(selectedJob.total_invoiced)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Total Costs</td>
                              <td className="text-end">{formatCurrency(selectedJob.actual_cost)}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold text-muted">Gross Profit</td>
                              <td className={`text-end fw-bold ${selectedJob.is_profitable ? 'text-success' : 'text-danger'}`}>
                                {formatCurrency(selectedJob.gross_profit)}
                              </td>
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
                                        description: cost.description,
                                        quantity: cost.quantity,
                                        unit_cost: cost.unit_cost,
                                        cost_date: cost.cost_date,
                                        vendor: cost.vendor || '',
                                        receipt_url: cost.receipt_url || ''
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
                          const typeCosts = costEntries.filter(c => c.cost_type === type)
                          const totalTypeCost = typeCosts.reduce((sum, c) => sum + c.total_cost, 0)
                          const percentage = selectedJob.actual_cost > 0 ? (totalTypeCost / selectedJob.actual_cost) * 100 : 0
                          
                          return (
                            <div key={type} className="d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <span className={`badge badge-circle badge-${getCostTypeColor(type)} me-3`}></span>
                                <span className="fw-semibold text-capitalize">{type}</span>
                              </div>
                              <div className="text-end">
                                <div className="fw-bold">{formatCurrency(totalTypeCost)}</div>
                                <div className="text-muted fs-8">{percentage.toFixed(1)}%</div>
                              </div>
                            </div>
                          )
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
                              {Math.abs(selectedJob.cost_variance / selectedJob.estimated_cost * 100).toFixed(1)}% variance
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
                              {selectedJob.labor_hours_actual}h / {selectedJob.labor_hours_estimated}h
                            </div>
                          </div>
                        </div>
                        
                        <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded">
                          <span className="fw-semibold">Revenue Recognition</span>
                          <div className="text-end">
                            <div className="fw-bold text-primary">
                              {((selectedJob.total_invoiced / (selectedJob.estimated_cost * 1.2)) * 100).toFixed(1)}%
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
                  <div className="col-md-6">
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
                  <div className="col-md-6">
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
                  <div className="col-12">
                    <label className="form-label">Vendor/Supplier</label>
                    <input
                      type="text"
                      className="form-control"
                      value={costForm.vendor}
                      onChange={(e) => setCostForm(prev => ({ ...prev, vendor: e.target.value }))}
                      placeholder="Optional vendor name"
                    />
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
