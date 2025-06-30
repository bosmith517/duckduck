import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ProfitabilityData {
  // Customer Profitability
  customer_reports: CustomerProfitability[]
  
  // Service/Job Type Profitability
  service_reports: ServiceProfitability[]
  
  // Time-based P&L
  monthly_pnl: MonthlyPnL[]
  
  // Overall metrics
  total_revenue: number
  total_costs: number
  total_profit: number
  average_margin: number
  most_profitable_month: string
  least_profitable_month: string
}

interface CustomerProfitability {
  customer_id: string
  customer_name: string
  total_jobs: number
  total_revenue: number
  total_costs: number
  gross_profit: number
  profit_margin: number
  average_job_value: number
  last_job_date: string
  is_profitable: boolean
}

interface ServiceProfitability {
  service_category: string
  job_count: number
  total_revenue: number
  total_costs: number
  gross_profit: number
  profit_margin: number
  average_job_size: number
  most_profitable_job: string
  trend: 'increasing' | 'decreasing' | 'stable'
}

interface MonthlyPnL {
  month: string
  revenue: number
  costs: number
  gross_profit: number
  profit_margin: number
  job_count: number
  average_job_value: number
}

interface ProfitabilityReportsProps {
  showSummaryOnly?: boolean
}

const ProfitabilityReports: React.FC<ProfitabilityReportsProps> = ({
  showSummaryOnly = false
}) => {
  const { userProfile } = useSupabaseAuth()
  
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    end_date: new Date().toISOString().split('T')[0] // Today
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'services' | 'trends'>('overview')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadProfitabilityData()
    }
  }, [userProfile?.tenant_id, dateRange])

  const loadProfitabilityData = async () => {
    setLoading(true)
    try {
      // Load jobs data with financial information
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          job_number,
          title,
          status,
          start_date,
          end_date,
          estimated_cost,
          actual_cost,
          total_invoiced,
          profit_margin_percentage,
          contacts!inner(id, first_name, last_name, account_id),
          accounts!inner(id, name)
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .gte('start_date', dateRange.start_date)
        .lte('start_date', dateRange.end_date)
        .in('status', ['Completed', 'Invoiced'])

      if (jobsError) throw jobsError

      // Process the data
      const processedData = await processDataForReports(jobsData || [])
      setData(processedData)

    } catch (error) {
      console.error('Error loading profitability data:', error)
      showToast.error('Failed to load profitability reports')
    } finally {
      setLoading(false)
    }
  }

  const processDataForReports = async (jobs: any[]): Promise<ProfitabilityData> => {
    // Customer Profitability Analysis
    const customerMap = new Map<string, CustomerProfitability>()
    
    jobs.forEach(job => {
      const customerId = job.contacts.account_id
      const customerName = job.accounts.name
      const revenue = job.total_invoiced || 0
      const costs = job.actual_cost || 0
      const profit = revenue - costs
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0

      if (customerMap.has(customerId)) {
        const existing = customerMap.get(customerId)!
        existing.total_jobs += 1
        existing.total_revenue += revenue
        existing.total_costs += costs
        existing.gross_profit += profit
        existing.last_job_date = job.start_date > existing.last_job_date ? job.start_date : existing.last_job_date
      } else {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: customerName,
          total_jobs: 1,
          total_revenue: revenue,
          total_costs: costs,
          gross_profit: profit,
          profit_margin: margin,
          average_job_value: revenue,
          last_job_date: job.start_date,
          is_profitable: profit > 0
        })
      }
    })

    // Calculate final customer metrics
    const customer_reports = Array.from(customerMap.values()).map(customer => ({
      ...customer,
      profit_margin: customer.total_revenue > 0 ? (customer.gross_profit / customer.total_revenue) * 100 : 0,
      average_job_value: customer.total_revenue / customer.total_jobs,
      is_profitable: customer.gross_profit > 0
    })).sort((a, b) => b.gross_profit - a.gross_profit)

    // Service Type Profitability (simplified - using job titles as categories)
    const serviceMap = new Map<string, ServiceProfitability>()
    
    jobs.forEach(job => {
      // Extract service category from job title (simplified approach)
      const category = extractServiceCategory(job.title)
      const revenue = job.total_invoiced || 0
      const costs = job.actual_cost || 0
      const profit = revenue - costs

      if (serviceMap.has(category)) {
        const existing = serviceMap.get(category)!
        existing.job_count += 1
        existing.total_revenue += revenue
        existing.total_costs += costs
        existing.gross_profit += profit
        if (profit > 0 && revenue > existing.average_job_size) {
          existing.most_profitable_job = job.job_number
        }
      } else {
        serviceMap.set(category, {
          service_category: category,
          job_count: 1,
          total_revenue: revenue,
          total_costs: costs,
          gross_profit: profit,
          profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          average_job_size: revenue,
          most_profitable_job: job.job_number,
          trend: 'stable'
        })
      }
    })

    const service_reports = Array.from(serviceMap.values()).map(service => ({
      ...service,
      profit_margin: service.total_revenue > 0 ? (service.gross_profit / service.total_revenue) * 100 : 0,
      average_job_size: service.total_revenue / service.job_count,
      trend: determineTrend(service.gross_profit, service.job_count)
    })).sort((a, b) => b.profit_margin - a.profit_margin)

    // Monthly P&L Analysis
    const monthlyMap = new Map<string, MonthlyPnL>()
    
    jobs.forEach(job => {
      const month = new Date(job.start_date).toISOString().slice(0, 7) // YYYY-MM
      const monthName = new Date(job.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      const revenue = job.total_invoiced || 0
      const costs = job.actual_cost || 0
      const profit = revenue - costs

      if (monthlyMap.has(month)) {
        const existing = monthlyMap.get(month)!
        existing.revenue += revenue
        existing.costs += costs
        existing.gross_profit += profit
        existing.job_count += 1
      } else {
        monthlyMap.set(month, {
          month: monthName,
          revenue: revenue,
          costs: costs,
          gross_profit: profit,
          profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
          job_count: 1,
          average_job_value: revenue
        })
      }
    })

    const monthly_pnl = Array.from(monthlyMap.values()).map(month => ({
      ...month,
      profit_margin: month.revenue > 0 ? (month.gross_profit / month.revenue) * 100 : 0,
      average_job_value: month.revenue / month.job_count
    })).sort((a, b) => a.month.localeCompare(b.month))

    // Overall metrics
    const total_revenue = jobs.reduce((sum, job) => sum + (job.total_invoiced || 0), 0)
    const total_costs = jobs.reduce((sum, job) => sum + (job.actual_cost || 0), 0)
    const total_profit = total_revenue - total_costs
    const average_margin = total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0

    const most_profitable_month = monthly_pnl.reduce((max, month) => 
      month.gross_profit > max.gross_profit ? month : max, monthly_pnl[0] || { month: 'N/A' }).month
    
    const least_profitable_month = monthly_pnl.reduce((min, month) => 
      month.gross_profit < min.gross_profit ? month : min, monthly_pnl[0] || { month: 'N/A' }).month

    return {
      customer_reports,
      service_reports,
      monthly_pnl,
      total_revenue,
      total_costs,
      total_profit,
      average_margin,
      most_profitable_month,
      least_profitable_month
    }
  }

  const extractServiceCategory = (jobTitle: string): string => {
    const title = jobTitle.toLowerCase()
    if (title.includes('plumbing') || title.includes('pipe') || title.includes('drain')) return 'Plumbing'
    if (title.includes('electrical') || title.includes('electric') || title.includes('wire')) return 'Electrical'
    if (title.includes('hvac') || title.includes('heating') || title.includes('cooling') || title.includes('air')) return 'HVAC'
    if (title.includes('roof') || title.includes('gutter') || title.includes('shingle')) return 'Roofing'
    if (title.includes('paint') || title.includes('drywall') || title.includes('wall')) return 'Painting & Drywall'
    if (title.includes('floor') || title.includes('carpet') || title.includes('tile')) return 'Flooring'
    if (title.includes('kitchen') || title.includes('bathroom') || title.includes('remodel')) return 'Remodeling'
    return 'General Services'
  }

  const determineTrend = (profit: number, jobCount: number): 'increasing' | 'decreasing' | 'stable' => {
    // Simplified trend determination - in a real app, you'd compare with historical data
    if (profit > 5000 && jobCount > 3) return 'increasing'
    if (profit < 1000 || jobCount < 2) return 'decreasing'
    return 'stable'
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

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <i className="ki-duotone ki-arrow-up fs-6 text-success"><span className="path1"></span><span className="path2"></span></i>
      case 'decreasing':
        return <i className="ki-duotone ki-arrow-down fs-6 text-danger"><span className="path1"></span><span className="path2"></span></i>
      default:
        return <i className="ki-duotone ki-minus fs-6 text-muted"><span className="path1"></span></i>
    }
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

  if (!data) {
    return (
      <div className="card">
        <div className="card-body text-center py-10">
          <i className="ki-duotone ki-chart-line-up fs-3x text-muted mb-3">
            <span className="path1"></span>
            <span className="path2"></span>
          </i>
          <h5 className="text-muted">No Data Available</h5>
          <p className="text-muted">No completed jobs found for the selected date range.</p>
        </div>
      </div>
    )
  }

  if (showSummaryOnly) {
    return (
      <div className="card">
        <div className="card-body">
          <h6 className="card-title mb-3">Profitability Summary</h6>
          <div className="row g-3">
            <div className="col-6">
              <div className="text-center p-3 bg-light-success rounded">
                <div className="fw-bold text-dark">{formatCurrency(data.total_profit)}</div>
                <div className="text-muted fs-8">Total Profit</div>
              </div>
            </div>
            <div className="col-6">
              <div className="text-center p-3 bg-light-info rounded">
                <div className="fw-bold text-dark">{formatPercentage(data.average_margin)}</div>
                <div className="text-muted fs-8">Avg Margin</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="row g-6">
      {/* Filters */}
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Profitability Reports</h3>
            <div className="card-toolbar">
              <div className="d-flex align-items-center gap-3">
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="card-header border-0 pt-6">
            <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x border-0 fs-6 fw-bold">
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
                  className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveTab('customers')
                  }}
                >
                  By Customer ({data.customer_reports.length})
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === 'services' ? 'active' : ''}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveTab('services')
                  }}
                >
                  By Service ({data.service_reports.length})
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link ${activeTab === 'trends' ? 'active' : ''}`}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setActiveTab('trends')
                  }}
                >
                  Monthly Trends
                </a>
              </li>
            </ul>
          </div>

          <div className="card-body">
            {activeTab === 'overview' && (
              <div>
                {/* Key Metrics */}
                <div className="row g-4 mb-6">
                  <div className="col-lg-3 col-md-6">
                    <div className="card border border-light h-100">
                      <div className="card-body text-center">
                        <i className="ki-duotone ki-dollar fs-2x text-success mb-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <div className="fs-2x fw-bold text-dark">
                          {formatCurrency(data.total_revenue)}
                        </div>
                        <div className="text-muted fs-7">Total Revenue</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-lg-3 col-md-6">
                    <div className="card border border-light h-100">
                      <div className="card-body text-center">
                        <i className="ki-duotone ki-chart-line-up fs-2x text-primary mb-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="fs-2x fw-bold text-dark">
                          {formatCurrency(data.total_profit)}
                        </div>
                        <div className="text-muted fs-7">Gross Profit</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-lg-3 col-md-6">
                    <div className="card border border-light h-100">
                      <div className="card-body text-center">
                        <i className="ki-duotone ki-percentage fs-2x text-info mb-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                        <div className="fs-2x fw-bold text-dark">
                          {formatPercentage(data.average_margin)}
                        </div>
                        <div className="text-muted fs-7">Average Margin</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-lg-3 col-md-6">
                    <div className="card border border-light h-100">
                      <div className="card-body text-center">
                        <i className="ki-duotone ki-bill fs-2x text-warning mb-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                          <span className="path4"></span>
                          <span className="path5"></span>
                          <span className="path6"></span>
                        </i>
                        <div className="fs-2x fw-bold text-dark">
                          {formatCurrency(data.total_costs)}
                        </div>
                        <div className="text-muted fs-7">Total Costs</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Performers */}
                <div className="row g-6">
                  <div className="col-md-6">
                    <h6 className="mb-4">Top Profitable Customers</h6>
                    <div className="table-responsive">
                      <table className="table table-row-bordered">
                        <thead>
                          <tr className="fw-bold text-muted">
                            <th>Customer</th>
                            <th className="text-end">Profit</th>
                            <th className="text-end">Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.customer_reports.slice(0, 5).map((customer, index) => (
                            <tr key={customer.customer_id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className={`badge badge-circle badge-${customer.is_profitable ? 'success' : 'danger'} me-3`}></div>
                                  <span className="fw-semibold">{customer.customer_name}</span>
                                </div>
                              </td>
                              <td className="text-end fw-bold">
                                {formatCurrency(customer.gross_profit)}
                              </td>
                              <td className="text-end">
                                <span className={`fw-bold ${customer.is_profitable ? 'text-success' : 'text-danger'}`}>
                                  {formatPercentage(customer.profit_margin)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <h6 className="mb-4">Most Profitable Services</h6>
                    <div className="table-responsive">
                      <table className="table table-row-bordered">
                        <thead>
                          <tr className="fw-bold text-muted">
                            <th>Service</th>
                            <th className="text-end">Margin</th>
                            <th className="text-end">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.service_reports.slice(0, 5).map((service, index) => (
                            <tr key={service.service_category}>
                              <td>
                                <span className="fw-semibold">{service.service_category}</span>
                                <div className="text-muted fs-8">{service.job_count} jobs</div>
                              </td>
                              <td className="text-end fw-bold">
                                {formatPercentage(service.profit_margin)}
                              </td>
                              <td className="text-end">
                                {getTrendIcon(service.trend)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div>
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-200px">Customer</th>
                        <th className="w-100px text-end">Jobs</th>
                        <th className="w-120px text-end">Revenue</th>
                        <th className="w-120px text-end">Costs</th>
                        <th className="w-120px text-end">Profit</th>
                        <th className="w-100px text-end">Margin</th>
                        <th className="w-120px text-end">Avg Job</th>
                        <th className="w-120px text-end">Last Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.customer_reports.map((customer) => (
                        <tr key={customer.customer_id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className={`badge badge-circle badge-${customer.is_profitable ? 'success' : 'danger'} me-3`}></div>
                              <span className="text-dark fw-semibold">{customer.customer_name}</span>
                            </div>
                          </td>
                          <td className="text-end">{customer.total_jobs}</td>
                          <td className="text-end fw-bold">{formatCurrency(customer.total_revenue)}</td>
                          <td className="text-end">{formatCurrency(customer.total_costs)}</td>
                          <td className={`text-end fw-bold ${customer.is_profitable ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(customer.gross_profit)}
                          </td>
                          <td className={`text-end fw-bold ${customer.is_profitable ? 'text-success' : 'text-danger'}`}>
                            {formatPercentage(customer.profit_margin)}
                          </td>
                          <td className="text-end">{formatCurrency(customer.average_job_value)}</td>
                          <td className="text-end text-muted">
                            {new Date(customer.last_job_date).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div>
                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-200px">Service Category</th>
                        <th className="w-100px text-end">Jobs</th>
                        <th className="w-120px text-end">Revenue</th>
                        <th className="w-120px text-end">Costs</th>
                        <th className="w-120px text-end">Profit</th>
                        <th className="w-100px text-end">Margin</th>
                        <th className="w-120px text-end">Avg Size</th>
                        <th className="w-100px text-end">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.service_reports.map((service) => (
                        <tr key={service.service_category}>
                          <td>
                            <div className="d-flex flex-column">
                              <span className="text-dark fw-semibold">{service.service_category}</span>
                              <span className="text-muted fs-8">Best: {service.most_profitable_job}</span>
                            </div>
                          </td>
                          <td className="text-end">{service.job_count}</td>
                          <td className="text-end fw-bold">{formatCurrency(service.total_revenue)}</td>
                          <td className="text-end">{formatCurrency(service.total_costs)}</td>
                          <td className={`text-end fw-bold ${service.gross_profit > 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(service.gross_profit)}
                          </td>
                          <td className={`text-end fw-bold ${service.profit_margin > 0 ? 'text-success' : 'text-danger'}`}>
                            {formatPercentage(service.profit_margin)}
                          </td>
                          <td className="text-end">{formatCurrency(service.average_job_size)}</td>
                          <td className="text-end">{getTrendIcon(service.trend)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div>
                <div className="alert alert-light-info mb-6">
                  <h6 className="alert-heading">Performance Insights</h6>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <strong>Best Month:</strong> {data.most_profitable_month}
                    </div>
                    <div className="col-md-6">
                      <strong>Challenging Month:</strong> {data.least_profitable_month}
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                    <thead>
                      <tr className="fw-bold text-muted">
                        <th className="min-w-150px">Month</th>
                        <th className="w-100px text-end">Jobs</th>
                        <th className="w-120px text-end">Revenue</th>
                        <th className="w-120px text-end">Costs</th>
                        <th className="w-120px text-end">Profit</th>
                        <th className="w-100px text-end">Margin</th>
                        <th className="w-120px text-end">Avg Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly_pnl.map((month) => (
                        <tr key={month.month}>
                          <td>
                            <span className="text-dark fw-semibold">{month.month}</span>
                          </td>
                          <td className="text-end">{month.job_count}</td>
                          <td className="text-end fw-bold">{formatCurrency(month.revenue)}</td>
                          <td className="text-end">{formatCurrency(month.costs)}</td>
                          <td className={`text-end fw-bold ${month.gross_profit > 0 ? 'text-success' : 'text-danger'}`}>
                            {formatCurrency(month.gross_profit)}
                          </td>
                          <td className={`text-end fw-bold ${month.profit_margin > 0 ? 'text-success' : 'text-danger'}`}>
                            {formatPercentage(month.profit_margin)}
                          </td>
                          <td className="text-end">{formatCurrency(month.average_job_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfitabilityReports