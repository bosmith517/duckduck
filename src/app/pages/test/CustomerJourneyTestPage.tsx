import React, { useState, useEffect } from 'react'
import { PageTitle } from '../../../_metronic/layout/core'
import { KTCard, KTCardBody } from '../../../_metronic/helpers'
import { useCustomerJourneyStore, journeyEventBus, JOURNEY_EVENTS } from '../../stores/customerJourneyStore'
import { useSmartAssistant, useAIActionHandler } from '../../hooks/useSmartAssistant'
import StepTracker from '../../components/journey/StepTracker'
import { NewInquiryModal } from '../../components/workflows/NewInquiryModal'
import { showToast } from '../../utils/toast'

const CustomerJourneyTestPage: React.FC = () => {
  const [showNewInquiry, setShowNewInquiry] = useState(false)
  const [events, setEvents] = useState<Array<{ event: string; data: any; timestamp: string }>>([])
  
  // Journey store
  const store = useCustomerJourneyStore()
  const { suggestions, trackAction } = useSmartAssistant()
  
  // Set up AI action handlers
  useAIActionHandler()
  
  // Subscribe to journey events for demonstration
  useEffect(() => {
    const eventNames = Object.values(JOURNEY_EVENTS)
    
    const handleEvent = (eventName: string) => (data: any) => {
      setEvents(prev => [{
        event: eventName,
        data,
        timestamp: new Date().toISOString()
      }, ...prev].slice(0, 10)) // Keep last 10 events
      
      showToast.info(`Event: ${eventName}`)
    }
    
    // Subscribe to all events
    const handlers = eventNames.map(eventName => ({
      event: eventName,
      handler: handleEvent(eventName)
    }))
    
    handlers.forEach(({ event, handler }) => {
      journeyEventBus.on(event, handler)
    })
    
    // Cleanup
    return () => {
      handlers.forEach(({ event, handler }) => {
        journeyEventBus.off(event, handler)
      })
    }
  }, [])
  
  // Set up real-time subscriptions when we have a lead
  useEffect(() => {
    if (store.leadId) {
      const unsubscribe = store.subscribeToRealtimeUpdates()
      return unsubscribe
    }
  }, [store.leadId])
  
  const handleNewInquirySuccess = (leadId: string) => {
    setShowNewInquiry(false)
    showToast.success(`Lead created: ${leadId}`)
    
    // Simulate moving to next step after delay
    setTimeout(() => {
      store.completeCurrentStep()
      showToast.info('Auto-advanced to Site Visit step')
    }, 3000)
  }
  
  const simulateActions = {
    scheduleSiteVisit: () => {
      const visit = {
        id: 'visit-' + Date.now(),
        lead_id: store.leadId || '',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 60,
        assigned_to: 'John Technician',
        notes: 'Customer prefers morning appointment',
        status: 'scheduled' as const,
        created_at: new Date().toISOString()
      }
      store.setSiteVisit(visit)
      trackAction('site_visit_scheduled')
    },
    
    createEstimate: () => {
      const estimate = {
        id: 'est-' + Date.now(),
        lead_id: store.leadId,
        number: 'EST-2024-001',
        line_items: [
          { title: 'Service Call', description: 'Initial assessment', quantity: 1, unit_price: 150, total: 150 },
          { title: 'Labor', description: '4 hours @ $75/hr', quantity: 4, unit_price: 75, total: 300 }
        ],
        subtotal: 450,
        tax_rate: 0.0875,
        tax_amount: 39.38,
        total: 489.38,
        valid_until: new Date(Date.now() + 604800000).toISOString(),
        status: 'draft' as const,
        created_at: new Date().toISOString()
      }
      store.setEstimate(estimate)
      trackAction('estimate_created')
    },
    
    approveEstimate: () => {
      if (store.estimate) {
        store.setEstimate({
          ...store.estimate,
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        trackAction('estimate_approved')
      }
    },
    
    convertToJob: () => {
      const job = {
        id: 'job-' + Date.now(),
        title: 'Service Job from Lead',
        description: store.lead?.service_type,
        status: 'scheduled' as const,
        priority: store.lead?.urgency || 'medium' as const,
        scheduled_start: new Date(Date.now() + 172800000).toISOString(),
        scheduled_end: new Date(Date.now() + 176400000).toISOString(),
        lead_id: store.leadId,
        contact_id: store.contactId,
        estimate_id: store.estimateId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      store.setJob(job)
      store.updateStep('job_tracking')
      trackAction('job_created')
    }
  }
  
  return (
    <>
      <PageTitle breadcrumbs={[]}>Customer Journey Test</PageTitle>
      
      <div className="row g-5">
        {/* Step Tracker */}
        <div className="col-12">
          <StepTracker 
            showDescriptions={true}
            showAISuggestions={true}
            onStepClick={(step) => {
              store.updateStep(step)
              showToast.info(`Navigated to ${step}`)
            }}
          />
        </div>
        
        {/* Journey State */}
        <div className="col-lg-6">
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Journey State</h3>
              <div className="card-toolbar">
                <span className={`badge ${store.isConnected ? 'badge-success' : 'badge-danger'}`}>
                  {store.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <KTCardBody>
              <div className="mb-4">
                <h5>Current State:</h5>
                <pre className="bg-light p-3 rounded">
                  {JSON.stringify({
                    step: store.step,
                    leadId: store.leadId,
                    siteVisitId: store.siteVisitId,
                    estimateId: store.estimateId,
                    jobId: store.jobId,
                    completedSteps: store.completedSteps,
                    photoQueue: {
                      count: store.photoQueue.totalCount,
                      status: store.photoQueue.status
                    }
                  }, null, 2)}
                </pre>
              </div>
              
              {store.lead && (
                <div className="mb-4">
                  <h5>Lead Data:</h5>
                  <div className="bg-light p-3 rounded">
                    <p><strong>Name:</strong> {store.lead.name}</p>
                    <p><strong>Phone:</strong> {store.lead.contact.phone}</p>
                    <p><strong>Service:</strong> {store.lead.service_type}</p>
                    <p><strong>Urgency:</strong> <span className={`badge badge-${
                      store.lead.urgency === 'high' ? 'danger' : 
                      store.lead.urgency === 'medium' ? 'warning' : 'success'
                    }`}>{store.lead.urgency}</span></p>
                  </div>
                </div>
              )}
            </KTCardBody>
          </KTCard>
        </div>
        
        {/* Actions & Events */}
        <div className="col-lg-6">
          <KTCard className="mb-5">
            <div className="card-header">
              <h3 className="card-title">Test Actions</h3>
            </div>
            <KTCardBody>
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowNewInquiry(true)}
                >
                  Start New Journey (Open Inquiry Modal)
                </button>
                
                <button 
                  className="btn btn-light-primary"
                  onClick={simulateActions.scheduleSiteVisit}
                  disabled={!store.leadId || store.siteVisitId !== undefined}
                >
                  Schedule Site Visit
                </button>
                
                <button 
                  className="btn btn-light-primary"
                  onClick={simulateActions.createEstimate}
                  disabled={!store.leadId || store.estimateId !== undefined}
                >
                  Create Estimate
                </button>
                
                <button 
                  className="btn btn-light-success"
                  onClick={simulateActions.approveEstimate}
                  disabled={!store.estimate || store.estimate.status === 'approved'}
                >
                  Approve Estimate
                </button>
                
                <button 
                  className="btn btn-light-info"
                  onClick={simulateActions.convertToJob}
                  disabled={!store.estimate || store.estimate.status !== 'approved' || store.jobId !== undefined}
                >
                  Convert to Job
                </button>
                
                <button 
                  className="btn btn-light-warning"
                  onClick={() => store.completeCurrentStep()}
                >
                  Complete Current Step
                </button>
                
                <button 
                  className="btn btn-light-danger"
                  onClick={() => {
                    store.startNewJourney()
                    setEvents([])
                  }}
                >
                  Reset Journey
                </button>
              </div>
            </KTCardBody>
          </KTCard>
          
          <KTCard>
            <div className="card-header">
              <h3 className="card-title">Event Log</h3>
              <div className="card-toolbar">
                <button 
                  className="btn btn-sm btn-light"
                  onClick={() => setEvents([])}
                >
                  Clear
                </button>
              </div>
            </div>
            <KTCardBody>
              <div className="timeline">
                {events.map((event, index) => (
                  <div key={index} className="timeline-item mb-3">
                    <div className="timeline-badge">
                      <i className="ki-duotone ki-notification fs-2 text-primary">
                        <span className="path1"></span>
                        <span className="path2"></span>
                        <span className="path3"></span>
                      </i>
                    </div>
                    <div className="timeline-content">
                      <div className="d-flex align-items-center mb-1">
                        <span className="fw-bold text-primary me-2">{event.event}</span>
                        <span className="text-muted fs-7">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.data && (
                        <pre className="bg-light p-2 rounded fs-8 mb-0">
                          {JSON.stringify(event.data, null, 2).slice(0, 200)}...
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-muted">No events yet. Start a new journey!</p>
                )}
              </div>
            </KTCardBody>
          </KTCard>
        </div>
        
        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="col-12">
            <KTCard>
              <div className="card-header">
                <h3 className="card-title">
                  <i className="ki-duotone ki-artificial-intelligence fs-2 text-primary me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                  </i>
                  AI Suggestions
                </h3>
              </div>
              <KTCardBody>
                <div className="row g-3">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="col-md-4">
                      <div className="card bg-light-primary">
                        <div className="card-body">
                          <h6>{suggestion.title}</h6>
                          <p className="text-gray-700 fs-7">{suggestion.description}</p>
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="badge badge-primary">
                              {Math.round(suggestion.confidence * 100)}% confidence
                            </span>
                            {suggestion.action && (
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={suggestion.action}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </KTCardBody>
            </KTCard>
          </div>
        )}
      </div>
      
      {/* New Inquiry Modal */}
      <NewInquiryModal
        isOpen={showNewInquiry}
        onClose={() => setShowNewInquiry(false)}
        onSuccess={handleNewInquirySuccess}
      />
    </>
  )
}

export default CustomerJourneyTestPage