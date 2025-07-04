import React, { useState, useEffect } from 'react'
import { emailService, EmailSystemHealth, EmailUsage } from '../../services/emailService'

interface EmailHealthDashboardProps {
  className?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

const EmailHealthDashboard: React.FC<EmailHealthDashboardProps> = ({ 
  className = '',
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  const [healthData, setHealthData] = useState<EmailSystemHealth[]>([])
  const [usageData, setUsageData] = useState<EmailUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchHealthData = async () => {
    try {
      const [health, usage] = await Promise.all([
        emailService.getSystemHealth(),
        emailService.getEmailUsage()
      ])
      
      setHealthData(health)
      setUsageData(usage)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealthData()

    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return '#10b981' // green
      case 'warning': return '#f59e0b' // yellow  
      case 'critical': return '#ef4444' // red
      default: return '#6b7280' // gray
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return '✅'
      case 'warning': return '⚠️'
      case 'critical': return '🚨'
      default: return '❓'
    }
  }

  // Prepare chart data
  const usageChartData = usageData.map(usage => ({
    month: usage.month_year,
    sent: usage.emails_sent,
    delivered: usage.emails_delivered,
    bounced: usage.emails_bounced,
    opened: usage.emails_opened,
    deliveryRate: usage.emails_sent > 0 ? ((usage.emails_delivered / usage.emails_sent) * 100).toFixed(1) : 0,
    openRate: usage.emails_delivered > 0 ? ((usage.emails_opened / usage.emails_delivered) * 100).toFixed(1) : 0
  }))

  const currentMonth = usageData[0]
  const deliverabilityData = currentMonth ? [
    { name: 'Delivered', value: currentMonth.emails_delivered, color: '#10b981' },
    { name: 'Bounced', value: currentMonth.emails_bounced, color: '#ef4444' },
    { name: 'Pending', value: currentMonth.emails_sent - currentMonth.emails_delivered - currentMonth.emails_bounced, color: '#f59e0b' }
  ] : []

  if (loading) {
    return (
      <div className={`email-health-dashboard ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading email health data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`email-health-dashboard space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email System Health</h2>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchHealthData}
          disabled={loading}
          className="btn btn-outline btn-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>❌ {error}</span>
        </div>
      )}

      {/* Health Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthData.map((metric) => (
          <div 
            key={metric.metric}
            className={`card bg-base-100 shadow-sm border-l-4`}
            style={{ borderLeftColor: getStatusColor(metric.status) }}
          >
            <div className="card-body p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {metric.metric.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.value.toLocaleString()}
                  </p>
                </div>
                <div className="text-2xl">
                  {getStatusIcon(metric.status)}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {metric.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Email Stats Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Volume Summary */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-lg mb-4">Email Volume Trend</h3>
            <div className="space-y-3">
              {usageChartData.slice(0, 6).map((month) => (
                <div key={month.month} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{month.month}</span>
                  <div className="flex items-center space-x-2">
                    <span className="badge badge-primary">{month.sent} sent</span>
                    <span className="badge badge-success">{month.delivered} delivered</span>
                    <span className="badge badge-error">{month.bounced} bounced</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Current Month Deliverability */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-lg mb-4">Current Month Deliverability</h3>
            {deliverabilityData.length > 0 ? (
              <div className="space-y-4">
                {deliverabilityData.map((item) => (
                  <div key={item.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width: `${(item.value / (currentMonth?.emails_sent || 1)) * 100}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No data available for current month
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg mb-4">Email Performance Rates</h3>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Delivery Rate</th>
                  <th>Open Rate</th>
                </tr>
              </thead>
              <tbody>
                {usageChartData.slice(0, 6).map((month) => (
                  <tr key={month.month}>
                    <td>{month.month}</td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-success h-2 rounded-full"
                            style={{ width: `${month.deliveryRate}%` }}
                          />
                        </div>
                        <span className="text-sm">{month.deliveryRate}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${month.openRate}%` }}
                          />
                        </div>
                        <span className="text-sm">{month.openRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Current Month Summary */}
      {currentMonth && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-lg mb-4">Current Month Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="stat">
                <div className="stat-title text-xs">Sent</div>
                <div className="stat-value text-lg">{currentMonth.emails_sent.toLocaleString()}</div>
                <div className="stat-desc text-xs">of {currentMonth.monthly_limit.toLocaleString()} limit</div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Delivered</div>
                <div className="stat-value text-lg text-success">{currentMonth.emails_delivered.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  {currentMonth.emails_sent > 0 ? 
                    `${((currentMonth.emails_delivered / currentMonth.emails_sent) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Bounced</div>
                <div className="stat-value text-lg text-error">{currentMonth.emails_bounced.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  {currentMonth.emails_sent > 0 ? 
                    `${((currentMonth.emails_bounced / currentMonth.emails_sent) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Complaints</div>
                <div className="stat-value text-lg text-warning">{currentMonth.emails_complained.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  {currentMonth.emails_sent > 0 ? 
                    `${((currentMonth.emails_complained / currentMonth.emails_sent) * 100).toFixed(2)}%` : 
                    '0%'
                  }
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Opened</div>
                <div className="stat-value text-lg text-info">{currentMonth.emails_opened.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  {currentMonth.emails_delivered > 0 ? 
                    `${((currentMonth.emails_opened / currentMonth.emails_delivered) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Clicked</div>
                <div className="stat-value text-lg text-accent">{currentMonth.emails_clicked.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  {currentMonth.emails_opened > 0 ? 
                    `${((currentMonth.emails_clicked / currentMonth.emails_opened) * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </div>
              </div>
              <div className="stat">
                <div className="stat-title text-xs">Daily Limit</div>
                <div className="stat-value text-lg">{currentMonth.daily_limit.toLocaleString()}</div>
                <div className="stat-desc text-xs">
                  Today: {Object.values(currentMonth.daily_usage)[Object.values(currentMonth.daily_usage).length - 1] || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Status Indicators */}
      <div className="flex flex-wrap gap-2">
        {healthData.map((metric) => (
          <div 
            key={metric.metric}
            className={`badge badge-lg gap-2 ${
              metric.status === 'ok' ? 'badge-success' :
              metric.status === 'warning' ? 'badge-warning' : 'badge-error'
            }`}
          >
            {getStatusIcon(metric.status)}
            {metric.metric.replace(/_/g, ' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EmailHealthDashboard