import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface PortalAnalytics {
  token_id: string
  job_id: string
  customer_id: string
  portal_created_at: string
  last_accessed: string | null
  access_count: number
  is_active: boolean
  total_activities: number
  active_days: number
  login_count: number
  job_views: number
  estimate_views: number
  invoice_views: number
  payments_made: number
  last_activity: string | null
  is_recently_active: boolean
  job_title: string
  job_status: string
  customer_name: string
  customer_phone: string
  customer_email: string
}

const CustomerPortalAnalytics: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [analytics, setAnalytics] = useState<PortalAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    fetchPortalAnalytics()
  }, [userProfile?.tenant_id, selectedPeriod])

  const fetchPortalAnalytics = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('portal_analytics_summary')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('portal_created_at', { ascending: false })

      if (error) throw error

      setAnalytics(data || [])
    } catch (error) {
      console.error('Error fetching portal analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEngagementLevel = (analytics: PortalAnalytics) => {
    const { access_count, total_activities, is_recently_active } = analytics
    
    if (!is_recently_active && access_count === 0) return { level: 'none', color: 'danger', text: 'No Activity' }
    if (total_activities < 3) return { level: 'low', color: 'warning', text: 'Low Engagement' }
    if (total_activities < 10) return { level: 'medium', color: 'info', text: 'Medium Engagement' }
    return { level: 'high', color: 'success', text: 'High Engagement' }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalActivePortals = analytics.filter(a => a.is_active).length
  const totalAccesses = analytics.reduce((sum, a) => sum + a.access_count, 0)
  const activeUsers = analytics.filter(a => a.is_recently_active).length
  const averageActivities = analytics.length > 0 ? Math.round(analytics.reduce((sum, a) => sum + a.total_activities, 0) / analytics.length) : 0

  if (loading) {
    return (
      <KTCard>
        <KTCardBody className="text-center py-10">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted mt-3">Loading portal analytics...</div>
        </KTCardBody>
      </KTCard>
    )
  }

  return (
    <>
      {/* Summary Stats */}
      <div className="row g-5 g-xl-8 mb-5">
        <div className="col-xl-3">
          <div className="card card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end">
            <div className="card-body text-center">
              <div className="fs-2hx fw-bold text-primary">{totalActivePortals}</div>
              <div className="text-gray-400 fw-semibold">Active Portals</div>
            </div>
          </div>
        </div>
        <div className="col-xl-3">
          <div className="card card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end">
            <div className="card-body text-center">
              <div className="fs-2hx fw-bold text-success">{totalAccesses}</div>
              <div className="text-gray-400 fw-semibold">Total Accesses</div>
            </div>
          </div>
        </div>
        <div className="col-xl-3">
          <div className="card card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end">
            <div className="card-body text-center">
              <div className="fs-2hx fw-bold text-info">{activeUsers}</div>
              <div className="text-gray-400 fw-semibold">Recently Active</div>
            </div>
          </div>
        </div>
        <div className="col-xl-3">
          <div className="card card-flush bgi-no-repeat bgi-size-contain bgi-position-x-end">
            <div className="card-body text-center">
              <div className="fs-2hx fw-bold text-warning">{averageActivities}</div>
              <div className="text-gray-400 fw-semibold">Avg Activities</div>
            </div>
          </div>
        </div>
      </div>

      {/* Portal Analytics Table */}
      <KTCard>
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold fs-3 mb-1">Customer Portal Analytics</span>
            <span className="text-muted mt-1 fw-semibold fs-7">Track customer portal engagement</span>
          </h3>
          <div className="card-toolbar">
            <select 
              className="form-select form-select-sm w-auto"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as '7' | '30' | '90')}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
        </div>
        <KTCardBody className="py-3">
          {analytics.length === 0 ? (
            <div className="text-center py-10">
              <KTIcon iconName="user" className="fs-2x text-muted mb-3" />
              <h5 className="text-muted">No Portal Analytics</h5>
              <p className="text-muted">Customer portals will appear here once jobs are created.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                <thead>
                  <tr className="fw-bold text-muted">
                    <th className="min-w-200px">Customer & Job</th>
                    <th className="min-w-100px">Status</th>
                    <th className="min-w-100px">Engagement</th>
                    <th className="min-w-150px">Activity Breakdown</th>
                    <th className="min-w-100px">Last Access</th>
                    <th className="min-w-100px text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((portal) => {
                    const engagement = getEngagementLevel(portal)
                    return (
                      <tr key={portal.token_id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <div className="d-flex justify-content-start flex-column">
                              <div className="text-dark fw-bold text-hover-primary fs-6">
                                {portal.customer_name}
                              </div>
                              <span className="text-muted fw-semibold text-muted d-block fs-7">
                                {portal.job_title}
                              </span>
                              <span className="text-muted fw-semibold text-muted d-block fs-8">
                                {portal.customer_phone}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-light-${portal.is_active ? 'success' : 'danger'}`}>
                            {portal.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <div className="text-muted fs-7">
                            {portal.job_status}
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className={`badge badge-light-${engagement.color}`}>
                              {engagement.text}
                            </span>
                            <div className="text-muted fs-7">
                              {portal.access_count} visits
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <div className="fs-7 text-muted">
                              👁️ {portal.job_views} job views
                            </div>
                            <div className="fs-7 text-muted">
                              📋 {portal.estimate_views} estimate views
                            </div>
                            <div className="fs-7 text-muted">
                              🧾 {portal.invoice_views} invoice views
                            </div>
                            {portal.payments_made > 0 && (
                              <div className="fs-7 text-success">
                                💳 {portal.payments_made} payments
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-dark fw-bold">
                            {formatDate(portal.last_accessed)}
                          </div>
                          <div className="text-muted fs-7">
                            {portal.active_days} active days
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end flex-shrink-0">
                            <button 
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                              title="View Portal"
                              onClick={() => {
                                const portalUrl = `${window.location.origin}/portal/${portal.customer_id}`
                                window.open(portalUrl, '_blank')
                              }}
                            >
                              <KTIcon iconName="eye" className="fs-6" />
                            </button>
                            <button 
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                              title="Send Reminder"
                              onClick={async () => {
                                try {
                                  await supabase.functions.invoke('send-portal-reminder', {
                                    body: { job_id: portal.job_id }
                                  })
                                  alert('Portal reminder sent!')
                                } catch (error) {
                                  console.error('Error sending reminder:', error)
                                  alert('Failed to send reminder')
                                }
                              }}
                            >
                              <KTIcon iconName="sms" className="fs-6" />
                            </button>
                            <button 
                              className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                              title="Deactivate Portal"
                              onClick={async () => {
                                if (confirm('Are you sure you want to deactivate this portal?')) {
                                  try {
                                    await supabase
                                      .from('client_portal_tokens')
                                      .update({ is_active: false })
                                      .eq('id', portal.token_id)
                                    
                                    fetchPortalAnalytics()
                                    alert('Portal deactivated')
                                  } catch (error) {
                                    console.error('Error deactivating portal:', error)
                                    alert('Failed to deactivate portal')
                                  }
                                }
                              }}
                            >
                              <KTIcon iconName="cross" className="fs-6" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </KTCardBody>
      </KTCard>
    </>
  )
}

export default CustomerPortalAnalytics