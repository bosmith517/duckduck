import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'

interface CallTranscript {
  id: string
  call_id: string
  from_number: string
  to_number: string
  duration: number
  transcript_text: string
  created_at: string
}

interface AIAction {
  id: string
  type: 'update_contact' | 'create_job' | 'schedule_appointment' | 'add_note' | 'create_lead' | 'send_followup'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action_data: any
  confidence: number
  status: 'pending' | 'completed' | 'dismissed'
}

interface AIPostCallActionsProps {
  callId: string
  transcript: CallTranscript
}

export const AIPostCallActions: React.FC<AIPostCallActionsProps> = ({
  callId,
  transcript
}) => {
  const { userProfile, tenant } = useSupabaseAuth()
  const [actions, setActions] = useState<AIAction[]>([])
  const [loading, setLoading] = useState(true)
  const [processingAction, setProcessingAction] = useState<string | null>(null)

  useEffect(() => {
    if (transcript.transcript_text) {
      generateAIActions()
    }
  }, [transcript])

  const generateAIActions = async () => {
    setLoading(true)
    
    try {
      // Call our AI action generation function
      const { data, error } = await supabase.functions.invoke('generate-post-call-actions', {
        body: {
          call_id: callId,
          transcript: transcript.transcript_text,
          from_number: transcript.from_number,
          duration: transcript.duration
        }
      })

      if (error) throw error

      setActions(data.actions || generateFallbackActions())
    } catch (error) {
      console.error('Error generating AI actions:', error)
      // Generate fallback actions based on basic transcript analysis
      setActions(generateFallbackActions())
    } finally {
      setLoading(false)
    }
  }

  const generateFallbackActions = (): AIAction[] => {
    const text = transcript.transcript_text.toLowerCase()
    const actions: AIAction[] = []

    // Check for address mentions
    const addressPattern = /\b\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i
    if (addressPattern.test(transcript.transcript_text)) {
      actions.push({
        id: '1',
        type: 'update_contact',
        priority: 'medium',
        title: 'Update Contact Address',
        description: 'The caller mentioned an address. Would you like to update their contact record?',
        action_data: {
          phone: transcript.from_number,
          suggested_address: transcript.transcript_text.match(addressPattern)?.[0]
        },
        confidence: 0.8,
        status: 'pending'
      })
    }

    // Check for appointment requests
    if (text.includes('appointment') || text.includes('schedule') || text.includes('when can')) {
      actions.push({
        id: '2',
        type: 'schedule_appointment',
        priority: 'high',
        title: 'Schedule Appointment',
        description: 'The caller requested an appointment. Would you like to create a new job and schedule it?',
        action_data: {
          phone: transcript.from_number,
          service_type: extractServiceType(text)
        },
        confidence: 0.9,
        status: 'pending'
      })
    }

    // Check for service mentions
    const serviceTypes = ['plumbing', 'hvac', 'electrical', 'roofing', 'repair', 'installation', 'maintenance']
    const mentionedServices = serviceTypes.filter(service => text.includes(service))
    
    if (mentionedServices.length > 0) {
      actions.push({
        id: '3',
        type: 'create_job',
        priority: 'high',
        title: 'Create Service Job',
        description: `The caller mentioned ${mentionedServices.join(', ')} services. Create a new job?`,
        action_data: {
          phone: transcript.from_number,
          service_types: mentionedServices,
          notes: transcript.transcript_text.substring(0, 200)
        },
        confidence: 0.85,
        status: 'pending'
      })
    }

    // Check for emergency keywords
    const emergencyKeywords = ['emergency', 'urgent', 'leak', 'flooding', 'no heat', 'no power']
    if (emergencyKeywords.some(keyword => text.includes(keyword))) {
      actions.push({
        id: '4',
        type: 'create_job',
        priority: 'high',
        title: 'Create Emergency Job',
        description: 'Emergency keywords detected. Create high-priority emergency job?',
        action_data: {
          phone: transcript.from_number,
          priority: 'emergency',
          service_type: 'Emergency Service',
          notes: 'EMERGENCY: ' + transcript.transcript_text.substring(0, 200)
        },
        confidence: 0.95,
        status: 'pending'
      })
    }

    // Check if caller is new (not in contacts)
    actions.push({
      id: '5',
      type: 'create_lead',
      priority: 'medium',
      title: 'Create New Lead',
      description: 'New phone number detected. Would you like to create a lead record?',
      action_data: {
        phone: transcript.from_number,
        source: 'Inbound Call',
        notes: transcript.transcript_text.substring(0, 200)
      },
      confidence: 0.7,
      status: 'pending'
    })

    return actions
  }

  const extractServiceType = (text: string): string => {
    if (text.includes('plumb')) return 'Plumbing'
    if (text.includes('hvac') || text.includes('heat') || text.includes('air')) return 'HVAC'
    if (text.includes('electric')) return 'Electrical'
    if (text.includes('roof')) return 'Roofing'
    return 'General Service'
  }

  const executeAction = async (action: AIAction) => {
    setProcessingAction(action.id)
    
    try {
      switch (action.type) {
        case 'create_lead':
          await createLead(action.action_data)
          break
        case 'create_job':
          await createJob(action.action_data)
          break
        case 'schedule_appointment':
          await scheduleAppointment(action.action_data)
          break
        case 'update_contact':
          await updateContact(action.action_data)
          break
        case 'add_note':
          await addNote(action.action_data)
          break
        default:
          console.warn('Unknown action type:', action.type)
      }

      // Mark action as completed
      setActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'completed' } : a
      ))

    } catch (error) {
      console.error('Error executing action:', error)
      alert('Failed to execute action. Please try manually.')
    } finally {
      setProcessingAction(null)
    }
  }

  const createLead = async (data: any) => {
    const { error } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenant?.id,
        name: `Caller from ${data.phone}`,
        phone: data.phone,
        source: data.source,
        status: 'new',
        notes: data.notes,
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
  }

  const createJob = async (data: any) => {
    // First, try to find existing contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, account_id')
      .eq('phone', data.phone)
      .eq('tenant_id', tenant?.id)
      .single()

    const { error } = await supabase
      .from('jobs')
      .insert({
        tenant_id: tenant?.id,
        account_id: contact?.account_id,
        contact_id: contact?.id,
        title: data.service_type || 'Service Call',
        description: data.notes,
        status: 'draft',
        priority: data.priority || 'medium',
        service_type: data.service_type,
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
  }

  const scheduleAppointment = async (data: any) => {
    // This would integrate with calendar/scheduling system
    console.log('Scheduling appointment:', data)
    // Implementation depends on scheduling system
  }

  const updateContact = async (data: any) => {
    const { error } = await supabase
      .from('contacts')
      .update({
        address: data.suggested_address,
        updated_at: new Date().toISOString()
      })
      .eq('phone', data.phone)
      .eq('tenant_id', tenant?.id)
    
    if (error) throw error
  }

  const addNote = async (data: any) => {
    const { error } = await supabase
      .from('communication_notes')
      .insert({
        tenant_id: tenant?.id,
        phone_number: data.phone,
        note: data.note,
        type: 'call_note',
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
  }

  const dismissAction = (actionId: string) => {
    setActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, status: 'dismissed' } : a
    ))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'danger'
      case 'medium': return 'warning'
      case 'low': return 'info'
      default: return 'secondary'
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_lead': return 'user-tick'
      case 'create_job': return 'abstract-26'
      case 'schedule_appointment': return 'calendar'
      case 'update_contact': return 'profile-user'
      case 'add_note': return 'message-text-2'
      case 'send_followup': return 'send'
      default: return 'information'
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-10">
          <span className="spinner-border spinner-border-lg me-3"></span>
          <div className="text-muted">AI is analyzing the call transcript...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title d-flex align-items-center">
          <KTIcon iconName="robot" className="fs-2 me-2" />
          AI Action Suggestions
          <span className="badge badge-light-primary ms-2">{actions.filter(a => a.status === 'pending').length}</span>
        </h3>
      </div>
      <div className="card-body">
        {actions.length === 0 ? (
          <div className="text-center py-5">
            <KTIcon iconName="information" className="fs-2x text-muted mb-3" />
            <div className="text-muted">No action suggestions generated for this call.</div>
          </div>
        ) : (
          <div className="row g-5">
            {actions.map(action => (
              <div key={action.id} className="col-12">
                <div className={`card border-left-${getPriorityColor(action.priority)} ${action.status === 'completed' ? 'bg-light-success' : action.status === 'dismissed' ? 'bg-light-secondary' : ''}`}>
                  <div className="card-body p-5">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center">
                        <div className={`symbol symbol-40px me-3 bg-light-${getPriorityColor(action.priority)}`}>
                          <KTIcon iconName={getActionIcon(action.type)} className={`fs-2 text-${getPriorityColor(action.priority)}`} />
                        </div>
                        <div>
                          <h5 className="mb-1">{action.title}</h5>
                          <div className="text-muted">{action.description}</div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <span className={`badge badge-light-${getPriorityColor(action.priority)} me-2`}>
                          {action.priority}
                        </span>
                        <span className="badge badge-light">
                          {Math.round(action.confidence * 100)}% confident
                        </span>
                      </div>
                    </div>

                    {action.status === 'pending' && (
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => dismissAction(action.id)}
                        >
                          Dismiss
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => executeAction(action)}
                          disabled={processingAction === action.id}
                        >
                          {processingAction === action.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <KTIcon iconName="check" className="fs-3 me-1" />
                              Execute
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {action.status === 'completed' && (
                      <div className="alert alert-success d-flex align-items-center py-2 px-3 mb-0">
                        <KTIcon iconName="check-circle" className="fs-4 text-success me-2" />
                        <span>Action completed successfully</span>
                      </div>
                    )}

                    {action.status === 'dismissed' && (
                      <div className="text-muted fs-7">
                        <KTIcon iconName="cross-circle" className="fs-6 me-1" />
                        Dismissed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AIPostCallActions