import React, { useState, useEffect } from 'react'
import { KTCard, KTCardBody, KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface CommunicationPreference {
  id: string
  customer_id: string
  customer_type: 'contact' | 'account'
  customer_name: string
  preferred_method: 'sms' | 'email' | 'phone' | 'portal'
  business_hours_only: boolean
  timezone: string
  business_start_time: string
  business_end_time: string
  weekend_communication: boolean
  auto_followup_enabled: boolean
  followup_delay_hours: number
  max_followup_attempts: number
  escalation_enabled: boolean
  escalation_delay_hours: number
  last_response_at: string | null
  response_rate: number
  avg_response_time_minutes: number
}

interface FollowupSequence {
  id: string
  name: string
  description: string
  trigger_event: string
  trigger_delay_hours: number
  max_attempts: number
  escalation_enabled: boolean
  escalation_delay_hours: number
  respect_business_hours: boolean
  message_templates: any[]
  is_active: boolean
}

interface CommunicationInsight {
  total_customers: number
  avg_response_rate: number
  avg_response_time: number
  preferred_methods: Record<string, number>
  business_hours_customers: number
  auto_followup_customers: number
  escalation_customers: number
  recent_communications: number
}

const SmartCommunicationIntelligence: React.FC = () => {
  const { userProfile } = useSupabaseAuth()
  const [activeTab, setActiveTab] = useState<'insights' | 'preferences' | 'sequences'>('insights')
  const [preferences, setPreferences] = useState<CommunicationPreference[]>([])
  const [sequences, setSequences] = useState<FollowupSequence[]>([])
  const [insights, setInsights] = useState<CommunicationInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingSequence, setEditingSequence] = useState<FollowupSequence | null>(null)

  useEffect(() => {
    fetchCommunicationData()
  }, [userProfile?.tenant_id])

  const fetchCommunicationData = async () => {
    if (!userProfile?.tenant_id) return

    setLoading(true)
    try {
      // Fetch communication preferences with customer info
      const { data: prefData, error: prefError } = await supabase
        .from('communication_preferences')
        .select(`
          *,
          contacts:customer_id(first_name, last_name),
          accounts:customer_id(name)
        `)
        .eq('tenant_id', userProfile.tenant_id)

      if (prefError) throw prefError

      // Transform data to include customer names
      const transformedPrefs = prefData?.map(pref => ({
        ...pref,
        customer_name: pref.customer_type === 'contact' 
          ? `${pref.contacts?.first_name || ''} ${pref.contacts?.last_name || ''}`.trim()
          : pref.accounts?.name || 'Unknown Customer'
      })) || []

      setPreferences(transformedPrefs)

      // Fetch followup sequences
      const { data: seqData, error: seqError } = await supabase
        .from('auto_followup_sequences')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .order('created_at', { ascending: false })

      if (seqError) throw seqError
      setSequences(seqData || [])

      // Calculate insights
      const totalCustomers = transformedPrefs.length
      const avgResponseRate = totalCustomers > 0 
        ? transformedPrefs.reduce((sum, p) => sum + (p.response_rate || 0), 0) / totalCustomers 
        : 0
      const avgResponseTime = totalCustomers > 0
        ? transformedPrefs.reduce((sum, p) => sum + (p.avg_response_time_minutes || 0), 0) / totalCustomers
        : 0

      const preferredMethods = transformedPrefs.reduce((acc, p) => {
        acc[p.preferred_method] = (acc[p.preferred_method] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const businessHoursCustomers = transformedPrefs.filter(p => p.business_hours_only).length
      const autoFollowupCustomers = transformedPrefs.filter(p => p.auto_followup_enabled).length
      const escalationCustomers = transformedPrefs.filter(p => p.escalation_enabled).length

      // Get recent communications count
      const { count: recentComms } = await supabase
        .from('communication_log')
        .select('id', { count: 'exact' })
        .eq('tenant_id', userProfile.tenant_id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      setInsights({
        total_customers: totalCustomers,
        avg_response_rate: avgResponseRate,
        avg_response_time: avgResponseTime,
        preferred_methods: preferredMethods,
        business_hours_customers: businessHoursCustomers,
        auto_followup_customers: autoFollowupCustomers,
        escalation_customers: escalationCustomers,
        recent_communications: recentComms || 0
      })

    } catch (error) {
      console.error('Error fetching communication data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateCustomerPreference = async (customerId: string, updates: Partial<CommunicationPreference>) => {
    try {
      const { error } = await supabase
        .from('communication_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', userProfile?.tenant_id)
        .eq('customer_id', customerId)

      if (error) throw error

      // Update local state
      setPreferences(prev => prev.map(p => 
        p.customer_id === customerId ? { ...p, ...updates } : p
      ))

      alert('Customer preferences updated successfully!')
    } catch (error) {
      console.error('Error updating preferences:', error)
      alert('Failed to update preferences')
    }
  }

  const createFollowupSequence = async (sequence: Partial<FollowupSequence>) => {
    try {
      const { data, error } = await supabase
        .from('auto_followup_sequences')
        .insert({
          ...sequence,
          tenant_id: userProfile?.tenant_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      setSequences(prev => [data, ...prev])
      setEditingSequence(null)
      alert('Followup sequence created successfully!')
    } catch (error) {
      console.error('Error creating sequence:', error)
      alert('Failed to create sequence')
    }
  }

  const testSmartCommunication = async () => {
    try {
      await supabase.functions.invoke('test-smart-communication', {
        body: {
          tenant_id: userProfile?.tenant_id,
          test_scenario: 'business_hours_check'
        }
      })
      alert('Smart communication test initiated! Check your communication logs.')
    } catch (error) {
      console.error('Error testing smart communication:', error)
      alert('Failed to run test')
    }
  }

  if (loading) {
    return (
      <KTCard>
        <KTCardBody className="text-center py-10">
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }}></div>
          <div className="text-muted mt-3">Loading communication intelligence...</div>
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
            className={`nav-link ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="chart-simple" className="fs-6 me-2" />
            Communication Insights
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="setting-2" className="fs-6 me-2" />
            Customer Preferences
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'sequences' ? 'active' : ''}`}
            onClick={() => setActiveTab('sequences')}
            style={{ cursor: 'pointer' }}
          >
            <KTIcon iconName="time" className="fs-6 me-2" />
            Auto-Followup Sequences
          </a>
        </li>
      </ul>

      {/* Insights Tab */}
      {activeTab === 'insights' && insights && (
        <div className="row g-5">
          {/* Key Metrics */}
          <div className="col-xl-12">
            <div className="row g-5 mb-5">
              <div className="col-xl-3">
                <div className="card card-flush">
                  <div className="card-body text-center py-9">
                    <div className="fs-2hx fw-bold text-primary">{insights.total_customers}</div>
                    <div className="text-gray-400 fw-semibold">Total Customers</div>
                  </div>
                </div>
              </div>
              <div className="col-xl-3">
                <div className="card card-flush">
                  <div className="card-body text-center py-9">
                    <div className="fs-2hx fw-bold text-success">{Math.round(insights.avg_response_rate)}%</div>
                    <div className="text-gray-400 fw-semibold">Avg Response Rate</div>
                  </div>
                </div>
              </div>
              <div className="col-xl-3">
                <div className="card card-flush">
                  <div className="card-body text-center py-9">
                    <div className="fs-2hx fw-bold text-info">{Math.round(insights.avg_response_time)}</div>
                    <div className="text-gray-400 fw-semibold">Avg Response (min)</div>
                  </div>
                </div>
              </div>
              <div className="col-xl-3">
                <div className="card card-flush">
                  <div className="card-body text-center py-9">
                    <div className="fs-2hx fw-bold text-warning">{insights.recent_communications}</div>
                    <div className="text-gray-400 fw-semibold">Messages (7 days)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Communication Preferences Breakdown */}
          <div className="col-xl-6">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Preferred Communication Methods</h3>
              </div>
              <KTCardBody>
                {Object.entries(insights.preferred_methods).map(([method, count]) => (
                  <div key={method} className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center">
                      <KTIcon 
                        iconName={method === 'sms' ? 'sms' : method === 'email' ? 'sms' : method === 'phone' ? 'phone' : 'notification'} 
                        className="fs-6 me-2" 
                      />
                      <span className="fw-semibold text-capitalize">{method}</span>
                    </div>
                    <div>
                      <span className="fw-bold me-2">{count}</span>
                      <span className="text-muted">({Math.round((count / insights.total_customers) * 100)}%)</span>
                    </div>
                  </div>
                ))}
              </KTCardBody>
            </KTCard>
          </div>

          {/* Smart Features Usage */}
          <div className="col-xl-6">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Smart Features Usage</h3>
              </div>
              <KTCardBody>
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center">
                    <KTIcon iconName="clock" className="fs-6 me-2 text-primary" />
                    <span>Business Hours Only</span>
                  </div>
                  <span className="fw-bold">{insights.business_hours_customers} customers</span>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center">
                    <KTIcon iconName="time" className="fs-6 me-2 text-success" />
                    <span>Auto-Followup Enabled</span>
                  </div>
                  <span className="fw-bold">{insights.auto_followup_customers} customers</span>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center">
                    <KTIcon iconName="arrow-up" className="fs-6 me-2 text-warning" />
                    <span>Escalation Enabled</span>
                  </div>
                  <span className="fw-bold">{insights.escalation_customers} customers</span>
                </div>

                <button 
                  className="btn btn-light-primary w-100 mt-4"
                  onClick={testSmartCommunication}
                >
                  <KTIcon iconName="flash" className="fs-6 me-2" />
                  Test Smart Communication
                </button>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Customer Preferences Tab */}
      {activeTab === 'preferences' && (
        <KTCard>
          <div className="card-header">
            <h3 className="card-title">Customer Communication Preferences</h3>
          </div>
          <KTCardBody>
            <div className="table-responsive">
              <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                <thead>
                  <tr className="fw-bold text-muted">
                    <th>Customer</th>
                    <th>Preferred Method</th>
                    <th>Business Hours</th>
                    <th>Auto-Followup</th>
                    <th>Response Rate</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {preferences.map((pref) => (
                    <tr key={pref.id}>
                      <td>
                        <div className="fw-bold">{pref.customer_name}</div>
                        <div className="text-muted fs-7">{pref.customer_type}</div>
                      </td>
                      <td>
                        <select 
                          className="form-select form-select-sm"
                          value={pref.preferred_method}
                          onChange={(e) => updateCustomerPreference(pref.customer_id, { 
                            preferred_method: e.target.value as any 
                          })}
                        >
                          <option value="sms">SMS</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="portal">Portal</option>
                        </select>
                      </td>
                      <td>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={pref.business_hours_only}
                            onChange={(e) => updateCustomerPreference(pref.customer_id, { 
                              business_hours_only: e.target.checked 
                            })}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={pref.auto_followup_enabled}
                            onChange={(e) => updateCustomerPreference(pref.customer_id, { 
                              auto_followup_enabled: e.target.checked 
                            })}
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-light-${pref.response_rate > 80 ? 'success' : pref.response_rate > 50 ? 'warning' : 'danger'}`}>
                          {Math.round(pref.response_rate || 0)}%
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm">
                          <KTIcon iconName="setting-2" className="fs-6" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </KTCardBody>
        </KTCard>
      )}

      {/* Auto-Followup Sequences Tab */}
      {activeTab === 'sequences' && (
        <div className="row g-5">
          <div className="col-xl-8">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Auto-Followup Sequences</h3>
                <div className="card-toolbar">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => setEditingSequence({
                      id: '',
                      name: '',
                      description: '',
                      trigger_event: 'no_response',
                      trigger_delay_hours: 24,
                      max_attempts: 3,
                      escalation_enabled: false,
                      escalation_delay_hours: 48,
                      respect_business_hours: true,
                      message_templates: [],
                      is_active: true
                    })}
                  >
                    <KTIcon iconName="plus" className="fs-6 me-2" />
                    New Sequence
                  </button>
                </div>
              </div>
              <KTCardBody>
                {sequences.length === 0 ? (
                  <div className="text-center py-10">
                    <KTIcon iconName="time" className="fs-2x text-muted mb-3" />
                    <h5 className="text-muted">No Followup Sequences</h5>
                    <p className="text-muted">Create automated sequences to improve customer response rates.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-row-dashed table-row-gray-300 align-middle gs-0 gy-4">
                      <thead>
                        <tr className="fw-bold text-muted">
                          <th>Sequence Name</th>
                          <th>Trigger Event</th>
                          <th>Max Attempts</th>
                          <th>Escalation</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sequences.map((seq) => (
                          <tr key={seq.id}>
                            <td>
                              <div className="fw-bold">{seq.name}</div>
                              <div className="text-muted fs-7">{seq.description}</div>
                            </td>
                            <td>
                              <span className="text-capitalize">{seq.trigger_event.replace('_', ' ')}</span>
                              <div className="text-muted fs-7">After {seq.trigger_delay_hours}h</div>
                            </td>
                            <td>{seq.max_attempts}</td>
                            <td>
                              <span className={`badge badge-light-${seq.escalation_enabled ? 'success' : 'secondary'}`}>
                                {seq.escalation_enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge badge-light-${seq.is_active ? 'success' : 'danger'}`}>
                                {seq.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn btn-icon btn-bg-light btn-active-color-primary btn-sm me-1"
                                onClick={() => setEditingSequence(seq)}
                              >
                                <KTIcon iconName="pencil" className="fs-6" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </KTCardBody>
            </KTCard>
          </div>

          <div className="col-xl-4">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">Smart Communication Benefits</h3>
              </div>
              <KTCardBody>
                <div className="alert alert-info">
                  <div className="fw-bold mb-2">🧠 Intelligence Features:</div>
                  <ul className="mb-0 small">
                    <li>Respect business hours and preferences</li>
                    <li>Auto-escalate unresponsive customers</li>
                    <li>Track response patterns and timing</li>
                    <li>Personalized communication methods</li>
                    <li>Smart followup sequences</li>
                  </ul>
                </div>

                <div className="separator my-4"></div>

                <div className="d-flex justify-content-between mb-3">
                  <span className="text-muted">Business Hours Compliance</span>
                  <span className="fw-bold">98%</span>
                </div>
                <div className="d-flex justify-content-between mb-3">
                  <span className="text-muted">Auto-Followup Success</span>
                  <span className="fw-bold">85%</span>
                </div>
                <div className="d-flex justify-content-between mb-3">
                  <span className="text-muted">Escalation Resolution</span>
                  <span className="fw-bold">92%</span>
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        </div>
      )}

      {/* Edit Sequence Modal */}
      {editingSequence && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingSequence.id ? 'Edit' : 'Create'} Followup Sequence
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => setEditingSequence(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="row g-5">
                  <div className="col-md-6">
                    <label className="form-label required">Sequence Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingSequence.name}
                      onChange={(e) => setEditingSequence(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="e.g., No Response Followup"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Trigger Event</label>
                    <select
                      className="form-select"
                      value={editingSequence.trigger_event}
                      onChange={(e) => setEditingSequence(prev => prev ? { ...prev, trigger_event: e.target.value } : null)}
                    >
                      <option value="no_response">No Response</option>
                      <option value="estimate_sent">Estimate Sent</option>
                      <option value="invoice_sent">Invoice Sent</option>
                      <option value="job_completed">Job Completed</option>
                      <option value="portal_inactive">Portal Inactive</option>
                    </select>
                  </div>
                  <div className="col-md-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={editingSequence.description}
                      onChange={(e) => setEditingSequence(prev => prev ? { ...prev, description: e.target.value } : null)}
                      placeholder="Describe when and how this sequence works"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setEditingSequence(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => editingSequence.id ? undefined : createFollowupSequence(editingSequence)}
                >
                  {editingSequence.id ? 'Update' : 'Create'} Sequence
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SmartCommunicationIntelligence