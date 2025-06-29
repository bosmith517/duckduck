import React, { useState, useEffect } from 'react'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { supabase } from '../../../supabaseClient'
import { showToast } from '../../utils/toast'

interface ReminderSettings {
  id?: string
  tenant_id: string
  due_soon_days: number
  overdue_3_days: number
  overdue_15_days: number
  overdue_30_days: number
  final_notice_days: number
  is_active: boolean
  email_from_name: string
  email_from_address: string
}

interface InvoiceReminder {
  id: string
  invoice_id: string
  reminder_type: string
  scheduled_for: string
  sent_at?: string
  status: string
  email_subject: string
  invoices: {
    invoice_number: string
    project_title: string
    total_amount: number
    contacts: {
      first_name: string
      last_name: string
      email: string
    }
  }
}

const InvoiceReminderManager: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  
  // State
  const [settings, setSettings] = useState<ReminderSettings>({
    tenant_id: userProfile?.tenant_id || '',
    due_soon_days: 3,
    overdue_3_days: 3,
    overdue_15_days: 15,
    overdue_30_days: 30,
    final_notice_days: 45,
    is_active: true,
    email_from_name: '',
    email_from_address: 'noreply@tradeworkspro.com'
  })
  
  const [reminders, setReminders] = useState<InvoiceReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings')

  useEffect(() => {
    if (userProfile?.tenant_id) {
      loadData()
    }
  }, [userProfile?.tenant_id])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadSettings(), loadReminders()])
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('tenant_id', userProfile?.tenant_id)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error
      }

      if (data) {
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error)
    }
  }

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_reminders')
        .select(`
          *,
          invoices!inner(
            invoice_number,
            project_title,
            total_amount,
            contacts!inner(first_name, last_name, email)
          )
        `)
        .eq('tenant_id', userProfile?.tenant_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error('Error loading reminders:', error)
      showToast.error('Failed to load reminder history')
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const settingsData = {
        ...settings,
        tenant_id: userProfile?.tenant_id
      }

      const { error } = settings.id
        ? await supabase
            .from('reminder_settings')
            .update(settingsData)
            .eq('id', settings.id)
        : await supabase
            .from('reminder_settings')
            .insert(settingsData)

      if (error) throw error

      showToast.success('Reminder settings saved successfully')
      if (!settings.id) {
        loadSettings() // Reload to get the ID
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      showToast.error('Failed to save reminder settings')
    } finally {
      setSaving(false)
    }
  }

  const testReminderSystem = async () => {
    try {
      showToast.loading('Testing reminder system...')
      
      const { data, error } = await supabase.functions.invoke('automated-invoice-reminders', {
        body: { test: true }
      })

      showToast.dismiss()
      
      if (error) throw error
      
      showToast.success('Reminder system test completed successfully')
      loadReminders()
    } catch (error) {
      showToast.dismiss()
      console.error('Error testing reminder system:', error)
      showToast.error('Reminder system test failed')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReminderTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'due_soon': 'Due Soon (3 days)',
      'overdue_3': '3 Days Overdue',
      'overdue_15': '15 Days Overdue',
      'overdue_30': '30 Days Overdue',
      'final_notice': 'Final Notice'
    }
    return labels[type] || type
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { class: string; text: string }> = {
      'pending': { class: 'badge-light-warning', text: 'Pending' },
      'sent': { class: 'badge-light-success', text: 'Sent' },
      'failed': { class: 'badge-light-danger', text: 'Failed' },
      'cancelled': { class: 'badge-light-secondary', text: 'Cancelled' }
    }
    
    const statusConfig = config[status] || { class: 'badge-light-secondary', text: status }
    return <span className={`badge ${statusConfig.class}`}>{statusConfig.text}</span>
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

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <i className="ki-duotone ki-timer fs-2 text-primary me-3">
            <span className="path1"></span>
            <span className="path2"></span>
            <span className="path3"></span>
          </i>
          Automated Invoice Reminders
        </h3>
        <div className="card-toolbar">
          <ul className="nav nav-tabs nav-line-tabs nav-line-tabs-2x nav-stretch fs-6 border-0">
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('settings')
                }}
              >
                <i className="ki-duotone ki-setting-3 fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Settings
              </a>
            </li>
            <li className="nav-item">
              <a
                className={`nav-link ${activeTab === 'history' ? 'active' : ''}`}
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setActiveTab('history')
                }}
              >
                <i className="ki-duotone ki-time fs-4 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                History ({reminders.length})
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="card-body">
        {activeTab === 'settings' && (
          <div>
            {/* Status Toggle */}
            <div className="alert alert-light-info d-flex align-items-center mb-6">
              <i className="ki-duotone ki-information fs-2x text-info me-4">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <div className="flex-grow-1">
                <h5 className="alert-heading">Automated Reminder System</h5>
                <p className="mb-0">
                  Automatically send professional reminder emails to customers when invoices are due or overdue.
                  This helps improve cash flow and reduces manual follow-up work.
                </p>
              </div>
              <div className="form-check form-switch form-check-custom form-check-solid">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={(e) => setSettings(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <label className="form-check-label fw-bold">
                  {settings.is_active ? 'Active' : 'Inactive'}
                </label>
              </div>
            </div>

            {/* Email Configuration */}
            <div className="row mb-6">
              <div className="col-md-6">
                <label className="form-label required">From Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={settings.email_from_name}
                  onChange={(e) => setSettings(prev => ({ ...prev, email_from_name: e.target.value }))}
                  placeholder="Your Company Name"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label required">From Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={settings.email_from_address}
                  onChange={(e) => setSettings(prev => ({ ...prev, email_from_address: e.target.value }))}
                  placeholder="noreply@yourcompany.com"
                />
              </div>
            </div>

            {/* Reminder Timing */}
            <div className="row mb-6">
              <div className="col-12">
                <h5 className="mb-4">Reminder Schedule</h5>
                <div className="alert alert-light-warning">
                  <p className="mb-0">
                    Configure when reminder emails are automatically sent. Days are counted from the invoice due date.
                  </p>
                </div>
              </div>
            </div>

            <div className="row g-4 mb-6">
              <div className="col-md-6">
                <div className="card border border-light">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-calendar-search fs-2x text-warning me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <div>
                        <h6 className="mb-1">Due Soon Reminder</h6>
                        <p className="text-muted fs-7 mb-0">Friendly reminder before due date</p>
                      </div>
                    </div>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={settings.due_soon_days}
                        onChange={(e) => setSettings(prev => ({ ...prev, due_soon_days: parseInt(e.target.value) || 0 }))}
                        min="1"
                        max="30"
                      />
                      <span className="input-group-text">days before due</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card border border-light">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-timer fs-2x text-primary me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <div>
                        <h6 className="mb-1">First Overdue</h6>
                        <p className="text-muted fs-7 mb-0">Polite overdue notice</p>
                      </div>
                    </div>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={settings.overdue_3_days}
                        onChange={(e) => setSettings(prev => ({ ...prev, overdue_3_days: parseInt(e.target.value) || 0 }))}
                        min="1"
                        max="30"
                      />
                      <span className="input-group-text">days after due</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card border border-light">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-warning-2 fs-2x text-info me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                      <div>
                        <h6 className="mb-1">Second Overdue</h6>
                        <p className="text-muted fs-7 mb-0">More urgent reminder</p>
                      </div>
                    </div>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={settings.overdue_15_days}
                        onChange={(e) => setSettings(prev => ({ ...prev, overdue_15_days: parseInt(e.target.value) || 0 }))}
                        min="1"
                        max="60"
                      />
                      <span className="input-group-text">days after due</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card border border-light">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-3">
                      <i className="ki-duotone ki-notification-status fs-2x text-danger me-3">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                        <span className="path4"></span>
                      </i>
                      <div>
                        <h6 className="mb-1">Final Notice</h6>
                        <p className="text-muted fs-7 mb-0">Last warning before action</p>
                      </div>
                    </div>
                    <div className="input-group">
                      <input
                        type="number"
                        className="form-control"
                        value={settings.overdue_30_days}
                        onChange={(e) => setSettings(prev => ({ ...prev, overdue_30_days: parseInt(e.target.value) || 0 }))}
                        min="1"
                        max="90"
                      />
                      <span className="input-group-text">days after due</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-between">
              <button
                className="btn btn-light-primary"
                onClick={testReminderSystem}
              >
                <i className="ki-duotone ki-rocket fs-5 me-2">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Test System
              </button>
              
              <div className="d-flex gap-2">
                <button
                  className="btn btn-light"
                  onClick={loadData}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={saveSettings}
                  disabled={saving}
                >
                  {saving && <span className="spinner-border spinner-border-sm me-2"></span>}
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {reminders.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                  <thead>
                    <tr className="fw-bold text-muted">
                      <th className="min-w-150px">Invoice</th>
                      <th className="min-w-150px">Customer</th>
                      <th className="min-w-120px">Reminder Type</th>
                      <th className="min-w-120px">Scheduled</th>
                      <th className="min-w-120px">Sent</th>
                      <th className="w-80px">Status</th>
                      <th className="w-80px text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map((reminder) => (
                      <tr key={reminder.id}>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="text-dark fw-bold">
                              {reminder.invoices.invoice_number}
                            </span>
                            <span className="text-muted fs-7">
                              {reminder.invoices.project_title}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="text-dark fw-semibold">
                              {reminder.invoices.contacts.first_name} {reminder.invoices.contacts.last_name}
                            </span>
                            <span className="text-muted fs-7">
                              {reminder.invoices.contacts.email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-light-info">
                            {getReminderTypeLabel(reminder.reminder_type)}
                          </span>
                        </td>
                        <td>
                          <span className="text-dark">
                            {formatDate(reminder.scheduled_for)}
                          </span>
                        </td>
                        <td>
                          <span className="text-dark">
                            {reminder.sent_at ? formatDate(reminder.sent_at) : '-'}
                          </span>
                        </td>
                        <td>
                          {getStatusBadge(reminder.status)}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-icon btn-light-primary"
                            title="View details"
                          >
                            <i className="ki-duotone ki-eye fs-6">
                              <span className="path1"></span>
                              <span className="path2"></span>
                              <span className="path3"></span>
                            </i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <i className="ki-duotone ki-timer fs-3x text-muted mb-3">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                <h5 className="text-muted">No Reminders Sent Yet</h5>
                <p className="text-muted">
                  Reminder history will appear here once the system starts sending automated emails.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default InvoiceReminderManager
