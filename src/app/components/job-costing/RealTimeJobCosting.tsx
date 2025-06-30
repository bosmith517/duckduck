import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import MobileReceiptScanner from './MobileReceiptScanner'

interface JobCost {
  id: string
  job_id: string
  cost_type: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead'
  category?: string
  subcategory?: string
  description: string
  amount: number
  cost_date: string
  date?: string
  quantity?: number
  unit_cost?: number
  total_cost?: number
  receipt_url?: string
  vendor_name?: string
  is_reimbursable?: boolean
  technician_id?: string
  status: 'pending' | 'approved' | 'rejected'
  approval_status?: string
  created_at: string
}

interface JobProfitability {
  job_id: string
  job_title: string
  estimated_revenue: number
  actual_revenue: number
  total_costs: number
  labor_costs: number
  material_costs: number
  equipment_costs: number
  other_costs: number
  profit_margin: number
  profit_percentage: number
  status: 'profitable' | 'break_even' | 'losing_money'
  cost_variance: number
  budget_utilization: number
}

interface CostCategory {
  category: string
  budgeted: number
  actual: number
  variance: number
  percentage: number
}

const RealTimeJobCosting: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'costs' | 'analytics' | 'scanner'>('dashboard')
  const [jobs, setJobs] = useState<any[]>([])
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [jobCosts, setJobCosts] = useState<JobCost[]>([])
  const [jobProfitability, setJobProfitability] = useState<JobProfitability[]>([])
  const [loading, setLoading] = useState(true)
  const [addingCost, setAddingCost] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // New cost form
  const [newCost, setNewCost] = useState({
    job_id: '',
    cost_type: 'material' as const,
    subcategory: '',
    description: '',
    amount: 0,
    vendor_name: '',
    is_reimbursable: false,
    receipt_url: ''
  })

  const costCategories = [
    { value: 'labor', label: 'Labor', icon: 'user', color: 'primary' },
    { value: 'material', label: 'Materials', icon: 'package', color: 'success' },
    { value: 'equipment', label: 'Equipment', icon: 'wrench', color: 'warning' },
    { value: 'subcontractor', label: 'Subcontractor', icon: 'users', color: 'info' },
    { value: 'overhead', label: 'Overhead', icon: 'setting-2', color: 'dark' }
  ]

  useEffect(() => {
    fetchData()
  }, [userProfile?.tenant_id])

  const fetchData = async () => {
    console.log('UserProfile:', userProfile)
    if (!userProfile?.tenant_id) {
      console.log('No tenant_id found in userProfile')
      return
    }

    setLoading(true)
    try {
      // Fetch active jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id, title, status, estimated_cost, actual_cost, total_budget, total_invoiced,
          contact_id, account_id, created_at, 
          contacts(first_name, last_name),
          accounts(name)
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['Scheduled', 'In Progress', 'Completed', 'scheduled', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })

      if (jobsError) throw jobsError
      console.log('Jobs fetched:', jobsData)
      setJobs(jobsData || [])

      // Fetch job costs
      const { data: costsData, error: costsError } = await supabase
        .from('job_costs')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (costsError) throw costsError
      console.log('Job costs fetched:', costsData)
      setJobCosts(costsData || [])

      // Calculate profitability
      calculateJobProfitability(jobsData || [], costsData || [])

    } catch (error) {
      console.error('Error fetching job costing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateJobProfitability = (jobsData: any[], costsData: JobCost[]) => {
    const profitability = jobsData.map(job => {
      const jobCosts = costsData.filter(cost => cost.job_id === job.id)
      const totalCosts = jobCosts.reduce((sum, cost) => sum + (cost.total_cost || cost.amount || 0), 0)
      
      const laborCosts = jobCosts
        .filter(cost => cost.cost_type === 'labor')
        .reduce((sum, cost) => sum + (cost.total_cost || cost.amount || 0), 0)
      
      const materialCosts = jobCosts
        .filter(cost => cost.cost_type === 'material')
        .reduce((sum, cost) => sum + (cost.total_cost || cost.amount || 0), 0)
      
      const equipmentCosts = jobCosts
        .filter(cost => cost.cost_type === 'equipment')
        .reduce((sum, cost) => sum + (cost.total_cost || cost.amount || 0), 0)
      
      const otherCosts = totalCosts - laborCosts - materialCosts - equipmentCosts

      // For HVAC jobs, total_budget is the job price/revenue, costs come from job_costs table
      const estimatedRevenue = job.total_budget || 0
      const actualRevenue = job.total_invoiced || job.total_budget || 0
      const profitMargin = actualRevenue - totalCosts
      const profitPercentage = actualRevenue > 0 ? (profitMargin / actualRevenue) * 100 : 0
      
      let status: 'profitable' | 'break_even' | 'losing_money' = 'profitable'
      if (profitMargin < 0) status = 'losing_money'
      else if (profitPercentage < 5) status = 'break_even'

      const costVariance = estimatedRevenue > 0 ? totalCosts - (estimatedRevenue * 0.7) : 0
      const budgetUtilization = estimatedRevenue > 0 ? (totalCosts / (estimatedRevenue * 0.7)) * 100 : 0

      return {
        job_id: job.id,
        job_title: job.title,
        estimated_revenue: estimatedRevenue,
        actual_revenue: actualRevenue,
        total_costs: totalCosts,
        labor_costs: laborCosts,
        material_costs: materialCosts,
        equipment_costs: equipmentCosts,
        other_costs: otherCosts,
        profit_margin: profitMargin,
        profit_percentage: profitPercentage,
        status,
        cost_variance: costVariance,
        budget_utilization: budgetUtilization
      }
    })

    setJobProfitability(profitability)
  }

  const addJobCost = async () => {
    if (!newCost.job_id || !newCost.amount || !newCost.description) {
      alert('Please fill in all required fields')
      return
    }

    setAddingCost(true)
    try {
      const { error } = await supabase
        .from('job_costs')
        .insert({
          ...newCost,
          tenant_id: userProfile?.tenant_id,
          technician_id: userProfile?.id,
          cost_date: new Date().toISOString().split('T')[0],
          total_cost: newCost.amount,
          quantity: 1,
          unit_cost: newCost.amount,
          status: 'approved'
        })

      if (error) throw error

      // Reset form
      setNewCost({
        job_id: '',
        cost_type: 'material',
        subcategory: '',
        description: '',
        amount: 0,
        vendor_name: '',
        is_reimbursable: false,
        receipt_url: ''
      })

      alert('✅ Cost added successfully!')
      fetchData()

    } catch (error) {
      console.error('Error adding job cost:', error)
      alert('Failed to add cost')
    } finally {
      setAddingCost(false)
    }
  }

  const handleReceiptScanned = (receiptData: any) => {
    setNewCost(prev => ({
      ...prev,
      amount: receiptData.total || prev.amount,
      vendor_name: receiptData.vendor || prev.vendor_name,
      description: receiptData.description || prev.description,
      receipt_url: receiptData.imageUrl || prev.receipt_url
    }))
    setShowScanner(false)
    alert('📱 Receipt scanned! Review and save the cost.')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'profitable': return 'success'
      case 'break_even': return 'warning'
      case 'losing_money': return 'danger'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'profitable': return 'arrow-up'
      case 'break_even': return 'minus'
      case 'losing_money': return 'arrow-down'
      default: return 'question'
    }
  }

  if (loading) {
    return (
      <KTCard>
        <KTCardBody className="text-center py-10">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted mt-3">Loading job costing data...</div>
        </KTCardBody>
      </KTCard>
    )
  }

  return (
    <>
      {/* Tab Navigation */}
      <ul className="nav nav-tabs nav-line-tabs mb-5 fs-6">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="chart-line" className="fs-6 me-2" />
            Profit Dashboard
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'costs' ? 'active' : ''}`}
            onClick={() => setActiveTab('costs')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="dollar" className="fs-6 me-2" />
            Cost Tracking
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => setActiveTab('scanner')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="scanner" className="fs-6 me-2" />
            📱 Receipt Scanner
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="chart-pie" className="fs-6 me-2" />
            Analytics
          </a>
        </li>
      </ul>

      {/* Profit Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="row g-5">
          {/* Summary Cards */}
          <div className="col-12">
            <div className="row g-5">
              <div className="col-md-3">
                <div className="card bg-light-success">
                  <div className="card-body">
                    <KTIcon iconName="arrow-up" className="fs-2x text-success mb-3" />
                    <div className="fs-2 fw-bold text-dark">
                      {jobProfitability.filter(j => j.status === 'profitable').length}
                    </div>
                    <div className="text-success fw-bold">Profitable Jobs</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-light-warning">
                  <div className="card-body">
                    <KTIcon iconName="minus" className="fs-2x text-warning mb-3" />
                    <div className="fs-2 fw-bold text-dark">
                      {jobProfitability.filter(j => j.status === 'break_even').length}
                    </div>
                    <div className="text-warning fw-bold">Break Even</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-light-danger">
                  <div className="card-body">
                    <KTIcon iconName="arrow-down" className="fs-2x text-danger mb-3" />
                    <div className="fs-2 fw-bold text-dark">
                      {jobProfitability.filter(j => j.status === 'losing_money').length}
                    </div>
                    <div className="text-danger fw-bold">Losing Money</div>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-light-primary">
                  <div className="card-body">
                    <KTIcon iconName="dollar" className="fs-2x text-primary mb-3" />
                    <div className="fs-2 fw-bold text-dark">
                      ${jobProfitability.reduce((sum, j) => sum + j.profit_margin, 0).toLocaleString()}
                    </div>
                    <div className="text-primary fw-bold">Total Profit</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Job Profitability Table */}
          <div className="col-12">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">💰 Real-Time Job Profitability</h3>
                <div className="card-toolbar">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('scanner')}
                  >
                    <KTIcon iconName="scanner" className="fs-6 me-2" />
                    📱 Scan Receipt
                  </button>
                </div>
              </div>
              <KTCardBody>
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th>Job</th>
                        <th>Revenue</th>
                        <th>Total Costs</th>
                        <th>Profit Margin</th>
                        <th>Profit %</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobProfitability.map((job) => (
                        <tr key={job.job_id}>
                          <td>
                            <div className="fw-bold">{job.job_title}</div>
                            <div className="text-muted fs-7">ID: {job.job_id.slice(0, 8)}</div>
                          </td>
                          <td>
                            <div className="fw-bold">${job.actual_revenue.toLocaleString()}</div>
                            {job.estimated_revenue !== job.actual_revenue && (
                              <div className="text-muted fs-7">Est: ${job.estimated_revenue.toLocaleString()}</div>
                            )}
                          </td>
                          <td>
                            <div className="fw-bold">${job.total_costs.toLocaleString()}</div>
                            <div className="text-muted fs-7">
                              L: ${job.labor_costs.toLocaleString()} | 
                              M: ${job.material_costs.toLocaleString()}
                            </div>
                          </td>
                          <td>
                            <div className={`fw-bold text-${getStatusColor(job.status)}`}>
                              ${job.profit_margin.toLocaleString()}
                            </div>
                          </td>
                          <td>
                            <div className={`fw-bold text-${getStatusColor(job.status)}`}>
                              {job.profit_percentage.toFixed(1)}%
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-light-${getStatusColor(job.status)}`}>
                              <KTIcon iconName={getStatusIcon(job.status)} className="fs-7 me-1" />
                              {job.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                              onClick={() => {
                                const jobData = jobs.find(j => j.id === job.job_id)
                                setSelectedJob(jobData)
                                setActiveTab('costs')
                              }}
                            >
                              <KTIcon iconName="eye" className="fs-6" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Cost Tracking Tab */}
      {activeTab === 'costs' && (
        <div className="row g-5">
          {/* Add New Cost */}
          <div className="col-xl-4">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">💰 Add Job Cost</h3>
                <div className="card-toolbar">
                  <button 
                    className="btn btn-light btn-sm"
                    onClick={() => setShowScanner(true)}
                  >
                    <KTIcon iconName="scanner" className="fs-6 me-1" />
                    📱 Scan
                  </button>
                </div>
              </div>
              <KTCardBody>
                <div className="mb-4">
                  <label className="form-label required">Job</label>
                  <select 
                    className="form-select"
                    value={newCost.job_id}
                    onChange={(e) => setNewCost(prev => ({ ...prev, job_id: e.target.value }))}
                  >
                    <option value="">Select a job...</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.contacts?.first_name || job.accounts?.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="form-label required">Category</label>
                  <select 
                    className="form-select"
                    value={newCost.cost_type}
                    onChange={(e) => setNewCost(prev => ({ ...prev, cost_type: e.target.value as any }))}
                  >
                    {costCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="form-label required">Description</label>
                  <input 
                    type="text"
                    className="form-control"
                    value={newCost.description}
                    onChange={(e) => setNewCost(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., PVC pipes, labor hours, permit fees"
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label required">Amount</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={newCost.amount}
                      onChange={(e) => setNewCost(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Vendor</label>
                  <input 
                    type="text"
                    className="form-control"
                    value={newCost.vendor_name}
                    onChange={(e) => setNewCost(prev => ({ ...prev, vendor_name: e.target.value }))}
                    placeholder="Home Depot, Local Supplier, etc."
                  />
                </div>

                <div className="mb-4">
                  <div className="form-check">
                    <input 
                      className="form-check-input"
                      type="checkbox"
                      checked={newCost.is_reimbursable}
                      onChange={(e) => setNewCost(prev => ({ ...prev, is_reimbursable: e.target.checked }))}
                    />
                    <label className="form-check-label">
                      Reimbursable Expense
                    </label>
                  </div>
                </div>

                <button 
                  className="btn btn-primary w-100"
                  onClick={addJobCost}
                  disabled={addingCost}
                >
                  {addingCost ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Adding Cost...
                    </>
                  ) : (
                    <>
                      <KTIcon iconName="plus" className="fs-6 me-2" />
                      Add Cost
                    </>
                  )}
                </button>
              </KTCardBody>
            </KTCard>
          </div>

          {/* Recent Costs */}
          <div className="col-xl-8">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Recent Job Costs</h3>
                <div className="card-toolbar">
                  {selectedJob && (
                    <span className="badge badge-light-primary">
                      Viewing: {selectedJob.title}
                    </span>
                  )}
                </div>
              </div>
              <KTCardBody>
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th>Date</th>
                        <th>Job</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Vendor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobCosts
                        .filter(cost => !selectedJob || cost.job_id === selectedJob.id)
                        .slice(0, 20)
                        .map((cost) => {
                          const job = jobs.find(j => j.id === cost.job_id)
                          const category = costCategories.find(c => c.value === cost.cost_type)
                          return (
                            <tr key={cost.id}>
                              <td>
                                <div className="text-muted fs-7">
                                  {new Date(cost.cost_date || cost.date || cost.created_at).toLocaleDateString()}
                                </div>
                              </td>
                              <td>
                                <div className="fw-bold fs-7">{job?.title || 'Unknown Job'}</div>
                              </td>
                              <td>
                                <span className={`badge badge-light-${category?.color || 'secondary'}`}>
                                  <KTIcon iconName={category?.icon || 'question'} className="fs-7 me-1" />
                                  {category?.label || cost.cost_type}
                                </span>
                              </td>
                              <td>
                                <div className="fw-bold">{cost.description}</div>
                                {cost.subcategory && (
                                  <div className="text-muted fs-7">{cost.subcategory}</div>
                                )}
                              </td>
                              <td>
                                <div className="fw-bold">${(cost.total_cost || cost.amount || 0).toLocaleString()}</div>
                                {cost.is_reimbursable && (
                                  <div className="badge badge-light-info fs-8">Reimbursable</div>
                                )}
                              </td>
                              <td>
                                <div className="text-muted fs-7">{cost.vendor_name || '—'}</div>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Receipt Scanner Tab */}
      {activeTab === 'scanner' && (
        <div className="row justify-content-center">
          <div className="col-lg-8">
            <MobileReceiptScanner 
              onReceiptScanned={handleReceiptScanned}
              onCancel={() => setActiveTab('costs')}
            />
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="row g-5">
          <div className="col-12">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">📊 Profitability Analytics</h3>
              </div>
              <KTCardBody>
                <div className="text-center py-10">
                  <KTIcon iconName="chart-pie" className="fs-2x text-primary mb-3" />
                  <h5>Advanced Analytics Coming Soon</h5>
                  <p className="text-muted">
                    Detailed cost breakdowns, profit trends, and margin analysis
                  </p>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Mobile Scanner Modal */}
      {showScanner && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">📱 Scan Receipt</h5>
                <button 
                  className="btn-close"
                  onClick={() => setShowScanner(false)}
                ></button>
              </div>
              <div className="modal-body p-0">
                <MobileReceiptScanner 
                  onReceiptScanned={handleReceiptScanned}
                  onCancel={() => setShowScanner(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default RealTimeJobCosting