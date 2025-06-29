import React, { useState, useEffect } from 'react'
import { supabase } from '../../../supabaseClient'

interface SubprojectInfo {
  tenant_id: string
  tenant_name: string
  signalwire_subproject_id: string | null
  subproject_status: 'pending' | 'created' | 'failed' | 'retrying'
  subproject_created_at: string | null
  subproject_error: string | null
  subproject_retry_needed: boolean
  notification_count: number
}

interface AdminNotification {
  id: string
  tenant_id: string
  type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  is_read: boolean
  metadata: any
  created_at: string
  read_at: string | null
}

const SubprojectManagementPage: React.FC = () => {
  const [subprojects, setSubprojects] = useState<SubprojectInfo[]>([])
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)
  const [retryInProgress, setRetryInProgress] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSubprojectData()
    loadNotifications()
  }, [])

  const loadSubprojectData = async () => {
    try {
      setLoading(true)
      
      // Load subproject overview
      const { data: subprojectData, error: subprojectError } = await supabase
        .from('subproject_status_overview')
        .select('*')
        .order('created_at', { ascending: false })

      if (subprojectError) throw subprojectError

      setSubprojects(subprojectData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const { data: notificationData, error: notificationError } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (notificationError) throw notificationError

      setNotifications(notificationData || [])
    } catch (err: any) {
      console.error('Failed to load notifications:', err.message)
    }
  }

  const retrySubprojectCreation = async (tenantId: string) => {
    try {
      setRetryInProgress(prev => new Set(prev).add(tenantId))

      const { data, error } = await supabase.functions.invoke('retry-subproject-creation', {
        body: { 
          tenantId,
          adminUserId: (await supabase.auth.getUser()).data.user?.id
        }
      })

      if (error) throw error

      // Refresh data
      await loadSubprojectData()
      await loadNotifications()

      alert('Subproject retry initiated successfully')
    } catch (err: any) {
      alert(`Failed to retry subproject creation: ${err.message}`)
    } finally {
      setRetryInProgress(prev => {
        const newSet = new Set(prev)
        newSet.delete(tenantId)
        return newSet
      })
    }
  }

  const markNotificationRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        notification_id: notificationId
      })

      if (error) throw error

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
      ))
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err.message)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'badge-light-warning',
      created: 'badge-light-success',
      failed: 'badge-light-danger',
      retrying: 'badge-light-primary'
    }
    return badges[status as keyof typeof badges] || 'badge-light-secondary'
  }

  const getSeverityIcon = (severity: string) => {
    const icons = {
      info: 'bi-info-circle text-primary',
      warning: 'bi-exclamation-triangle text-warning',
      error: 'bi-x-circle text-danger',
      critical: 'bi-exclamation-octagon text-danger'
    }
    return icons[severity as keyof typeof icons] || 'bi-info-circle'
  }

  const filteredNotifications = selectedTenant 
    ? notifications.filter(n => n.tenant_id === selectedTenant)
    : notifications

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-5">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Subproject Management</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Manage SignalWire subprojects for tenant isolation
          </span>
        </h3>
        <div className="card-toolbar">
          <button 
            className="btn btn-sm btn-light-primary"
            onClick={() => {
              loadSubprojectData()
              loadNotifications()
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="card-body py-3">
        {error && (
          <div className="alert alert-danger d-flex align-items-center p-5 mb-10">
            <i className="bi bi-shield-exclamation fs-2hx text-danger me-4"></i>
            <div className="d-flex flex-column">
              <h4 className="mb-1 text-danger">Error Loading Data</h4>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="row g-6 g-xl-9 mb-6">
          <div className="col-md-3">
            <div className="card bg-light-success">
              <div className="card-body">
                <div className="text-success fw-bold fs-6">Created</div>
                <div className="fw-bold fs-2">
                  {subprojects.filter(s => s.subproject_status === 'created').length}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-light-warning">
              <div className="card-body">
                <div className="text-warning fw-bold fs-6">Pending</div>
                <div className="fw-bold fs-2">
                  {subprojects.filter(s => s.subproject_status === 'pending').length}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-light-danger">
              <div className="card-body">
                <div className="text-danger fw-bold fs-6">Failed</div>
                <div className="fw-bold fs-2">
                  {subprojects.filter(s => s.subproject_status === 'failed').length}
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-light-primary">
              <div className="card-body">
                <div className="text-primary fw-bold fs-6">Retrying</div>
                <div className="fw-bold fs-2">
                  {subprojects.filter(s => s.subproject_status === 'retrying').length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subprojects Table */}
        <div className="table-responsive">
          <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
            <thead>
              <tr className="fw-bold text-muted">
                <th className="ps-4 min-w-200px">Tenant</th>
                <th className="min-w-125px">Status</th>
                <th className="min-w-150px">Subproject ID</th>
                <th className="min-w-125px">Created</th>
                <th className="min-w-200px">Error</th>
                <th className="min-w-100px">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subprojects.map((subproject) => (
                <tr key={subproject.tenant_id}>
                  <td className="ps-4">
                    <div className="d-flex align-items-center">
                      <div className="d-flex justify-content-start flex-column">
                        <span className="text-dark fw-bold text-hover-primary fs-6">
                          {subproject.tenant_name}
                        </span>
                        <span className="text-muted fw-semibold text-muted d-block fs-7">
                          {subproject.tenant_id.substring(0, 8)}...
                        </span>
                      </div>
                      {subproject.notification_count > 0 && (
                        <span className="badge badge-light-danger ms-2">
                          {subproject.notification_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadge(subproject.subproject_status)}`}>
                      {subproject.subproject_status}
                    </span>
                  </td>
                  <td>
                    <span className="text-dark fw-bold d-block fs-7">
                      {subproject.signalwire_subproject_id || 'Not created'}
                    </span>
                  </td>
                  <td>
                    <span className="text-muted fw-semibold d-block fs-7">
                      {subproject.subproject_created_at 
                        ? new Date(subproject.subproject_created_at).toLocaleDateString()
                        : 'N/A'
                      }
                    </span>
                  </td>
                  <td>
                    {subproject.subproject_error && (
                      <span className="text-danger fw-semibold d-block fs-7" title={subproject.subproject_error}>
                        {subproject.subproject_error.substring(0, 50)}...
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="d-flex justify-content-end flex-shrink-0">
                      {(subproject.subproject_status === 'failed' || subproject.subproject_retry_needed) && (
                        <button
                          className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                          onClick={() => retrySubprojectCreation(subproject.tenant_id)}
                          disabled={retryInProgress.has(subproject.tenant_id)}
                          title="Retry subproject creation"
                        >
                          {retryInProgress.has(subproject.tenant_id) ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                          ) : (
                            <i className="bi bi-arrow-clockwise fs-7"></i>
                          )}
                        </button>
                      )}
                      <button
                        className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm"
                        onClick={() => setSelectedTenant(
                          selectedTenant === subproject.tenant_id ? null : subproject.tenant_id
                        )}
                        title="View notifications"
                      >
                        <i className="bi bi-bell fs-7"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notifications Panel */}
        {notifications.length > 0 && (
          <div className="mt-10">
            <div className="d-flex align-items-center mb-5">
              <h4 className="mb-0">Admin Notifications</h4>
              {selectedTenant && (
                <button
                  className="btn btn-sm btn-light-secondary ms-3"
                  onClick={() => setSelectedTenant(null)}
                >
                  Show All
                </button>
              )}
            </div>
            
            <div className="row">
              {filteredNotifications.slice(0, 10).map((notification) => (
                <div key={notification.id} className="col-12 mb-3">
                  <div className={`card ${!notification.is_read ? 'border-primary' : ''}`}>
                    <div className="card-body p-4">
                      <div className="d-flex align-items-start">
                        <i className={`bi ${getSeverityIcon(notification.severity)} fs-3 me-3 mt-1`}></i>
                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="mb-1">{notification.title}</h6>
                            <div className="d-flex align-items-center">
                              <span className="text-muted fs-7 me-3">
                                {new Date(notification.created_at).toLocaleString()}
                              </span>
                              {!notification.is_read && (
                                <button
                                  className="btn btn-sm btn-light-primary"
                                  onClick={() => markNotificationRead(notification.id)}
                                >
                                  Mark Read
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-muted mb-2">{notification.message}</p>
                          <div className="d-flex align-items-center">
                            <span className={`badge badge-light-${notification.severity} me-2`}>
                              {notification.type}
                            </span>
                            <span className="text-muted fs-8">
                              Tenant: {notification.tenant_id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubprojectManagementPage