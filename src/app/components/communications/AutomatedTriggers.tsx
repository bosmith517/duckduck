import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface CommunicationTrigger {
  id: string
  name: string
  description: string
  trigger_type: 'job_status' | 'location_proximity' | 'time_based' | 'payment_status' | 'appointment_reminder'
  trigger_conditions: {
    status?: string
    distance_meters?: number
    time_before_minutes?: number
    payment_status?: string
  }
  message_template: {
    sms_enabled: boolean
    email_enabled: boolean
    sms_message: string
    email_subject: string
    email_body: string
  }
  active: boolean
  send_count: number
  last_sent: string | null
}

export const AutomatedTriggers: React.FC = () => {
  const { tenant, userProfile } = useSupabaseAuth()
  const [triggers, setTriggers] = useState<CommunicationTrigger[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTrigger, setEditingTrigger] = useState<CommunicationTrigger | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchTriggers()
  }, [tenant?.id])

  const fetchTriggers = async () => {
    if (!tenant?.id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('communication_triggers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('name')

      if (error) throw error

      if (data && data.length > 0) {
        setTriggers(data)
      } else {
        // Create default triggers if none exist
        setTriggers(getDefaultTriggers())
      }
    } catch (error) {
      console.error('Error fetching triggers:', error)
      setTriggers(getDefaultTriggers())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultTriggers = (): CommunicationTrigger[] => {
    return [
      {
        id: '1',
        name: 'Technician En Route',
        description: 'Notify customer when technician is nearby',
        trigger_type: 'location_proximity',
        trigger_conditions: {
          distance_meters: 1600 // 1 mile
        },
        message_template: {
          sms_enabled: true,
          email_enabled: false,
          sms_message: 'Hi {customer_name}! Your technician {technician_name} is about 10 minutes away. Please ensure someone is available at the property. - {company_name}',
          email_subject: 'Your Technician is Almost There',
          email_body: 'Your technician will arrive shortly.'
        },
        active: true,
        send_count: 0,
        last_sent: null
      },
      {
        id: '2',
        name: 'Job Started',
        description: 'Confirm when technician begins work',
        trigger_type: 'job_status',
        trigger_conditions: {
          status: 'in_progress'
        },
        message_template: {
          sms_enabled: true,
          email_enabled: true,
          sms_message: 'Good news! {technician_name} has started working on your {service_type} at {address}. We\'ll keep you updated on progress. - {company_name}',
          email_subject: 'Work Has Started on Your Service Request',
          email_body: 'Our technician {technician_name} has arrived and begun work on your {service_type} service. You can track real-time progress in your customer portal: {portal_link}'
        },
        active: true,
        send_count: 0,
        last_sent: null
      },
      {
        id: '3',
        name: 'Job Completed',
        description: 'Send completion notice with invoice',
        trigger_type: 'job_status',
        trigger_conditions: {
          status: 'completed'
        },
        message_template: {
          sms_enabled: true,
          email_enabled: true,
          sms_message: 'Great news! Your {service_type} has been completed. Invoice: {invoice_link}. Please let us know if you have any questions. - {company_name}',
          email_subject: 'Service Complete - Invoice Attached',
          email_body: 'Your {service_type} service has been completed successfully. Please find your invoice attached. You can view details and make payment at: {invoice_link}\n\nThank you for choosing {company_name}!'
        },
        active: true,
        send_count: 0,
        last_sent: null
      },
      {
        id: '4',
        name: 'Appointment Reminder',
        description: 'Remind customer of upcoming appointment',
        trigger_type: 'appointment_reminder',
        trigger_conditions: {
          time_before_minutes: 1440 // 24 hours
        },
        message_template: {
          sms_enabled: true,
          email_enabled: true,
          sms_message: 'Reminder: Your {service_type} appointment is tomorrow at {appointment_time}. Technician: {technician_name}. Call us at {company_phone} if you need to reschedule. - {company_name}',
          email_subject: 'Appointment Reminder - Tomorrow',
          email_body: 'This is a friendly reminder that you have a {service_type} appointment scheduled for tomorrow at {appointment_time}.\n\nTechnician: {technician_name}\nService Address: {address}\n\nIf you need to reschedule, please call us at {company_phone}.'
        },
        active: true,
        send_count: 0,
        last_sent: null
      },
      {
        id: '5',
        name: 'Payment Received',
        description: 'Thank customer for payment',
        trigger_type: 'payment_status',
        trigger_conditions: {
          payment_status: 'paid'
        },
        message_template: {
          sms_enabled: true,
          email_enabled: true,
          sms_message: 'Thank you! Your payment of ${amount} has been received. Receipt: {receipt_link}. We appreciate your business! - {company_name}',
          email_subject: 'Payment Confirmation - Thank You!',
          email_body: 'Thank you for your payment of ${amount}. Your receipt is attached.\n\nWe truly appreciate your business and look forward to serving you again.\n\n{company_name}'
        },
        active: true,
        send_count: 0,
        last_sent: null
      },
      {
        id: '6',
        name: 'Emergency Response',
        description: 'Fast response for emergency jobs',
        trigger_type: 'job_status',
        trigger_conditions: {
          status: 'scheduled'
        },
        message_template: {
          sms_enabled: true,
          email_enabled: false,
          sms_message: 'EMERGENCY RESPONSE: We\'ve received your urgent request. A technician will be there within 2 hours. Job #: {job_number}. Call {emergency_phone} for updates. - {company_name}',
          email_subject: 'Emergency Service Dispatched',
          email_body: 'Emergency service has been dispatched to your location.'
        },
        active: true,
        send_count: 0,
        last_sent: null
      }
    ]
  }

  const toggleTrigger = async (triggerId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('communication_triggers')
        .update({ active })
        .eq('id', triggerId)

      if (error) throw error

      setTriggers(prev => prev.map(t => 
        t.id === triggerId ? { ...t, active } : t
      ))
    } catch (error) {
      console.error('Error updating trigger:', error)
      alert('Failed to update trigger')
    }
  }

  const saveTrigger = async (trigger: CommunicationTrigger) => {
    try {
      const { error } = await supabase
        .from('communication_triggers')
        .upsert({
          ...trigger,
          tenant_id: tenant?.id,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      await fetchTriggers()
      setEditingTrigger(null)
      setShowCreateModal(false)
    } catch (error) {
      console.error('Error saving trigger:', error)
      alert('Failed to save trigger')
    }
  }

  const testTrigger = async (trigger: CommunicationTrigger) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-communication-trigger', {
        body: {
          trigger_id: trigger.id,
          test_phone: userProfile?.phone || '+1234567890',
          test_email: userProfile?.email || 'test@example.com'
        }
      })

      if (error) throw error

      alert('Test message sent successfully!')
    } catch (error) {
      console.error('Error testing trigger:', error)
      alert('Failed to send test message')
    }
  }

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'job_status': return 'abstract-26'
      case 'location_proximity': return 'geolocation'
      case 'time_based': return 'timer'
      case 'payment_status': return 'credit-cart'
      case 'appointment_reminder': return 'calendar'
      default: return 'notification-status'
    }
  }

  const getTriggerColor = (type: string) => {
    switch (type) {
      case 'job_status': return 'primary'
      case 'location_proximity': return 'warning'
      case 'time_based': return 'info'
      case 'payment_status': return 'success'
      case 'appointment_reminder': return 'secondary'
      default: return 'light'
    }
  }

  return (
    <div className="card">
      <div className="card-header border-0 pt-6">
        <h3 className="card-title align-items-start flex-column">
          <span className="card-label fw-bold fs-3 mb-1">Automated Communication Triggers</span>
          <span className="text-muted mt-1 fw-semibold fs-7">
            Professional customer communications that happen automatically
          </span>
        </h3>
        <div className="card-toolbar">
          <button
            className="btn btn-sm btn-light-primary me-3"
            onClick={() => setShowCreateModal(true)}
          >
            <KTIcon iconName="plus" className="fs-3 me-1" />
            Add Trigger
          </button>
          <button className="btn btn-sm btn-primary">
            <KTIcon iconName="setting-3" className="fs-3 me-1" />
            Settings
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Stats Overview */}
        <div className="row g-6 g-xl-9 mb-6 mb-xl-9">
          <div className="col-md-3">
            <div className="bg-light-success rounded p-4 text-center">
              <div className="fs-2 fw-bold text-success">{triggers.filter(t => t.active).length}</div>
              <div className="fs-7 text-muted">Active Triggers</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-light-primary rounded p-4 text-center">
              <div className="fs-2 fw-bold text-primary">{triggers.reduce((sum, t) => sum + t.send_count, 0)}</div>
              <div className="fs-7 text-muted">Messages Sent</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-light-info rounded p-4 text-center">
              <div className="fs-2 fw-bold text-info">{triggers.filter(t => t.message_template.sms_enabled).length}</div>
              <div className="fs-7 text-muted">SMS Enabled</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="bg-light-warning rounded p-4 text-center">
              <div className="fs-2 fw-bold text-warning">{triggers.filter(t => t.message_template.email_enabled).length}</div>
              <div className="fs-7 text-muted">Email Enabled</div>
            </div>
          </div>
        </div>

        {/* Triggers List */}
        <div className="row g-6">
          {triggers.map(trigger => (
            <div key={trigger.id} className="col-md-6 col-xl-4">
              <div className={`card h-100 ${trigger.active ? 'border-success' : 'border-secondary'}`}>
                <div className="card-body p-5">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className={`symbol symbol-50px bg-light-${getTriggerColor(trigger.trigger_type)}`}>
                      <KTIcon 
                        iconName={getTriggerIcon(trigger.trigger_type)} 
                        className={`fs-2x text-${getTriggerColor(trigger.trigger_type)}`} 
                      />
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={trigger.active}
                        onChange={(e) => toggleTrigger(trigger.id, e.target.checked)}
                      />
                    </div>
                  </div>

                  <h5 className="mb-2">{trigger.name}</h5>
                  <p className="text-muted mb-4 fs-7">{trigger.description}</p>

                  {/* Trigger Conditions */}
                  <div className="bg-light rounded p-3 mb-4">
                    <div className="fs-8 text-muted mb-1">TRIGGER CONDITIONS</div>
                    {trigger.trigger_conditions.status && (
                      <div className="badge badge-light-primary">Status: {trigger.trigger_conditions.status}</div>
                    )}
                    {trigger.trigger_conditions.distance_meters && (
                      <div className="badge badge-light-warning">Within {Math.round(trigger.trigger_conditions.distance_meters / 1609)} miles</div>
                    )}
                    {trigger.trigger_conditions.time_before_minutes && (
                      <div className="badge badge-light-info">{trigger.trigger_conditions.time_before_minutes / 60}h before</div>
                    )}
                    {trigger.trigger_conditions.payment_status && (
                      <div className="badge badge-light-success">Payment: {trigger.trigger_conditions.payment_status}</div>
                    )}
                  </div>

                  {/* Message Channels */}
                  <div className="d-flex justify-content-center gap-3 mb-4">
                    <div className={`text-center ${trigger.message_template.sms_enabled ? 'text-success' : 'text-muted'}`}>
                      <KTIcon iconName="sms" className="fs-2x mb-1" />
                      <div className="fs-8">SMS</div>
                    </div>
                    <div className={`text-center ${trigger.message_template.email_enabled ? 'text-primary' : 'text-muted'}`}>
                      <KTIcon iconName="sms" className="fs-2x mb-1" />
                      <div className="fs-8">Email</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="row text-center mb-4">
                    <div className="col-6">
                      <div className="fw-bold">{trigger.send_count}</div>
                      <div className="fs-8 text-muted">Sent</div>
                    </div>
                    <div className="col-6">
                      <div className="fw-bold">
                        {trigger.last_sent ? new Date(trigger.last_sent).toLocaleDateString() : 'Never'}
                      </div>
                      <div className="fs-8 text-muted">Last Sent</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-light-primary flex-fill"
                      onClick={() => setEditingTrigger(trigger)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-light-info"
                      onClick={() => testTrigger(trigger)}
                    >
                      Test
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit/Create Modal */}
      {(editingTrigger || showCreateModal) && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingTrigger ? 'Edit Trigger' : 'Create New Trigger'}
                </h5>
                <button 
                  className="btn-close"
                  onClick={() => {
                    setEditingTrigger(null)
                    setShowCreateModal(false)
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <KTIcon iconName="information" className="fs-2 me-3" />
                  <div>
                    <h5 className="mb-1">Message Variables Available:</h5>
                    <div className="fs-7">
                      {'{customer_name}'}, {'{technician_name}'}, {'{company_name}'}, {'{service_type}'}, 
                      {'{address}'}, {'{appointment_time}'}, {'{job_number}'}, {'{amount}'}, {'{portal_link}'}
                    </div>
                  </div>
                </div>
                
                <p className="text-muted">Configure your automated message trigger settings and templates.</p>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingTrigger(null)
                    setShowCreateModal(false)
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => editingTrigger && saveTrigger(editingTrigger)}
                >
                  Save Trigger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutomatedTriggers