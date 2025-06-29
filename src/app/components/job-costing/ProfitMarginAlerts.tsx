import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface ProfitAlert {
  id: string
  job_id: string
  job_title: string
  alert_type: 'losing_money' | 'low_margin' | 'over_budget' | 'high_cost'
  severity: 'critical' | 'warning' | 'info'
  message: string
  current_margin: number
  threshold: number
  created_at: string
  is_acknowledged: boolean
}

interface ProfitMarginAlertsProps {
  onAlertClick?: (jobId: string) => void
  showInline?: boolean
}

const ProfitMarginAlerts: React.FC<ProfitMarginAlertsProps> = ({ onAlertClick, showInline = false }) => {
  const { userProfile } = useSupabaseAuth()
  const [alerts, setAlerts] = useState<ProfitAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchAlerts()
    
    // Set up real-time subscription for new alerts
    const subscription = supabase
      .channel('profit_alerts')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'job_profitability_snapshots',
          filter: `tenant_id=eq.${userProfile?.tenant_id}`
        }, 
        () => {
          fetchAlerts()
        }
      )
      .subscribe()

    return () => subscription.unsubscribe()
  }, [userProfile?.tenant_id])

  const fetchAlerts = async () => {
    if (!userProfile?.tenant_id) return

    try {
      // Get jobs with profit issues - using existing jobs table with calculated data
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select(`
          id, title, status, estimated_cost, actual_cost,
          estimated_hours, actual_hours, total_invoiced,
          total_job_costs, actual_profit_margin, profit_percentage,
          profitability_status, cost_last_updated
        `)
        .eq('tenant_id', userProfile.tenant_id)
        .in('status', ['scheduled', 'in_progress'])
        .order('cost_last_updated', { ascending: false })

      if (error) throw error

      // Generate alerts based on profitability data
      const generatedAlerts: ProfitAlert[] = []
      
      jobsData?.forEach((job, index) => {
        const alertId = `${job.id}_${Date.now()}_${index}`
        
        // Critical: Losing money
        if (job.profitability_status === 'losing_money') {
          generatedAlerts.push({
            id: alertId + '_losing',
            job_id: job.id,
            job_title: job.title,
            alert_type: 'losing_money',
            severity: 'critical',
            message: `Job is losing money! Margin: $${job.actual_profit_margin?.toLocaleString() || '0'}`,
            current_margin: job.profit_percentage || 0,
            threshold: 0,
            created_at: job.cost_last_updated || new Date().toISOString(),
            is_acknowledged: false
          })
        }
        
        // Warning: Low profit margin
        if (job.profit_percentage > 0 && job.profit_percentage < 10) {
          generatedAlerts.push({
            id: alertId + '_low_margin',
            job_id: job.id,
            job_title: job.title,
            alert_type: 'low_margin',
            severity: 'warning',
            message: `Low profit margin: ${job.profit_percentage?.toFixed(1)}%`,
            current_margin: job.profit_percentage || 0,
            threshold: 10,
            created_at: job.cost_last_updated || new Date().toISOString(),
            is_acknowledged: false
          })
        }
        
        // Warning: Over budget (calculate from estimated vs actual cost)
        const budgetUtilization = job.estimated_cost > 0 ? ((job.total_job_costs || 0) / job.estimated_cost) * 100 : 0
        if (budgetUtilization > 90) {
          generatedAlerts.push({
            id: alertId + '_over_budget',
            job_id: job.id,
            job_title: job.title,
            alert_type: 'over_budget',
            severity: 'warning',
            message: `Budget utilization: ${budgetUtilization.toFixed(1)}%`,
            current_margin: budgetUtilization,
            threshold: 90,
            created_at: job.cost_last_updated || new Date().toISOString(),
            is_acknowledged: false
          })
        }
        
        // Info: High costs added recently
        if (job.cost_last_updated && new Date(job.cost_last_updated) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
          const recentCostIncrease = job.total_job_costs || 0
          if (recentCostIncrease > (job.estimated_cost || 0) * 0.1) { // More than 10% of estimated cost
            generatedAlerts.push({
              id: alertId + '_high_cost',
              job_id: job.id,
              job_title: job.title,
              alert_type: 'high_cost',
              severity: 'info',
              message: `Significant costs added: $${recentCostIncrease.toLocaleString()}`,
              current_margin: recentCostIncrease,
              threshold: (job.estimated_cost || 0) * 0.1,
              created_at: job.cost_last_updated,
              is_acknowledged: false
            })
          }
        }
      })

      setAlerts(generatedAlerts.slice(0, showAll ? undefined : 5))
      
    } catch (error) {
      console.error('Error fetching profit alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAlertIcon = (alertType: string, severity: string) => {
    switch (alertType) {
      case 'losing_money': return 'arrow-down'
      case 'low_margin': return 'warning'
      case 'over_budget': return 'chart-line-up'
      case 'high_cost': return 'dollar'
      default: return 'information'
    }
  }

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'danger'
      case 'warning': return 'warning'
      case 'info': return 'info'
      default: return 'secondary'
    }
  }

  const handleAlertClick = (jobId: string) => {
    if (onAlertClick) {
      onAlertClick(jobId)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm text-primary"></div>
        <div className="text-muted mt-2">Checking profit margins...</div>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-4">
        <KTIcon iconName="check-circle" className="fs-2x text-success mb-3" />
        <div className="text-success fw-bold">All Jobs Profitable! 💰</div>
        <div className="text-muted">No profit margin alerts at this time</div>
      </div>
    )
  }

  if (showInline) {
    return (
      <div className="alert alert-warning d-flex align-items-center">
        <KTIcon iconName="warning" className="fs-2x text-warning me-3" />
        <div>
          <div className="fw-bold">Profit Margin Alert!</div>
          <div className="fs-7">
            {alerts.filter(a => a.severity === 'critical').length} critical, {' '}
            {alerts.filter(a => a.severity === 'warning').length} warnings
          </div>
        </div>
        <button 
          className="btn btn-warning btn-sm ms-auto"
          onClick={() => setShowAll(!showAll)}
        >
          View Details
        </button>
      </div>
    )
  }

  return (
    <div className="card border border-warning">
      <div className="card-header bg-light-warning">
        <div className="card-title d-flex align-items-center">
          <KTIcon iconName="warning" className="fs-2 text-warning me-2" />
          <span className="fw-bold">💰 Profit Margin Alerts</span>
        </div>
        <div className="card-toolbar">
          <span className="badge badge-warning">
            {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div className={`symbol symbol-35px symbol-circle me-3 bg-light-${getAlertColor(alert.severity)}`}>
                        <KTIcon 
                          iconName={getAlertIcon(alert.alert_type, alert.severity)} 
                          className={`fs-6 text-${getAlertColor(alert.severity)}`} 
                        />
                      </div>
                      <div>
                        <div className="fw-bold fs-7">{alert.job_title}</div>
                        <div className={`text-${getAlertColor(alert.severity)} fs-8`}>
                          {alert.message}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-light-${getAlertColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-end">
                    <div className="text-muted fs-8">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="text-end pe-4">
                    <button 
                      className={`btn btn-icon btn-sm btn-light-${getAlertColor(alert.severity)}`}
                      onClick={() => handleAlertClick(alert.job_id)}
                      title="View Job Details"
                    >
                      <KTIcon iconName="eye" className="fs-6" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {alerts.length >= 5 && !showAll && (
          <div className="card-footer text-center">
            <button 
              className="btn btn-light btn-sm"
              onClick={() => setShowAll(true)}
            >
              <KTIcon iconName="arrow-down" className="fs-6 me-1" />
              Show More Alerts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfitMarginAlerts