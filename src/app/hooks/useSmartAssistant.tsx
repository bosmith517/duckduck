import { useEffect, useCallback, useRef } from 'react'
import { useCustomerJourneyStore, useJourneyAI, journeyEventBus, JOURNEY_EVENTS } from '../stores/customerJourneyStore'
import type { JourneyStep, AIAction } from '../contexts/CustomerJourneyContext'
import { showToast } from '../utils/toast'

interface SmartAssistantConfig {
  enabled?: boolean
  maxSuggestions?: number
  autoSuggest?: boolean
  contextWindow?: number // How many previous actions to consider
}

interface AssistantContext {
  currentStep: JourneyStep
  completedSteps: JourneyStep[]
  hasLead: boolean
  hasSiteVisit: boolean
  hasEstimate: boolean
  hasJob: boolean
  recentActions: string[]
  timeOnStep: number // Minutes on current step
}

// Predefined suggestions based on journey state
const stepSuggestions: Record<JourneyStep, (context: AssistantContext) => AIAction[]> = {
  new_inquiry: (context) => [
    {
      id: 'ai-1',
      type: 'suggestion',
      title: 'Qualify Lead',
      description: 'Review lead information and determine service requirements',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Opening lead qualification...')
        // Navigate to lead edit modal
      }
    },
    {
      id: 'ai-2',
      type: 'suggestion',
      title: 'Schedule Site Visit',
      description: 'Book an on-site assessment to gather requirements',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('open:site_visit_modal')
      }
    }
  ],
  
  site_visit: (context) => [
    {
      id: 'ai-3',
      type: 'suggestion',
      title: 'Prepare Visit Checklist',
      description: 'Review standard inspection points for this service type',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Loading inspection checklist...')
      }
    },
    {
      id: 'ai-4',
      type: 'suggestion',
      title: 'Send Reminder',
      description: 'Send automated reminder to customer 24 hours before visit',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('send:visit_reminder')
      }
    }
  ],
  
  estimate: (context) => [
    {
      id: 'ai-5',
      type: 'suggestion',
      title: 'Use AI Estimation',
      description: 'Generate estimate using AI based on similar jobs',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('open:ai_estimate_modal')
      }
    },
    {
      id: 'ai-6',
      type: 'suggestion',
      title: 'Add Photos',
      description: 'Attach site visit photos to support estimate',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('open:photo_capture')
      }
    }
  ],
  
  conversion: (context) => [
    {
      id: 'ai-7',
      type: 'suggestion',
      title: 'Send Estimate',
      description: 'Email the estimate to customer for approval',
      confidence: 0.9,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('send:estimate_email')
      }
    },
    {
      id: 'ai-8',
      type: 'suggestion',
      title: 'Schedule Follow-up',
      description: 'Set reminder to follow up in 2 days',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Creating follow-up reminder...')
      }
    }
  ],
  
  job_tracking: (context) => [
    {
      id: 'ai-9',
      type: 'suggestion',
      title: 'Assign Crew',
      description: 'Assign available technicians to this job',
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('open:crew_assignment')
      }
    },
    {
      id: 'ai-10',
      type: 'suggestion',
      title: 'Update Progress',
      description: 'Log current job status and upload progress photos',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('open:job_update_modal')
      }
    }
  ],
  
  portal: (context) => [
    {
      id: 'ai-11',
      type: 'suggestion',
      title: 'Request Review',
      description: 'Ask customer to leave a review',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      action: () => {
        journeyEventBus.emit('send:review_request')
      }
    },
    {
      id: 'ai-12',
      type: 'suggestion',
      title: 'Offer Maintenance Plan',
      description: 'Suggest recurring maintenance schedule',
      confidence: 0.75,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Loading maintenance plans...')
      }
    }
  ],
  
  completed: () => [],
  estimate_revision: (context) => [
    {
      id: 'ai-revision',
      type: 'suggestion',
      title: 'Quick Revision',
      description: 'Use AI to quickly adjust estimate based on customer feedback',
      confidence: 0.8,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Opening revision assistant...')
      }
    }
  ],
  approval: (context) => [
    {
      id: 'ai-approval',
      type: 'suggestion',
      title: 'Follow Up',
      description: 'Send a follow-up message to customer about the estimate',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      action: () => {
        showToast.info('Opening communication tools...')
      }
    }
  ]
}

// Analyze journey state and provide intelligent suggestions
export const useSmartAssistant = (config: SmartAssistantConfig = {}) => {
  const {
    enabled = true,
    maxSuggestions = 3,
    autoSuggest = true,
    contextWindow = 10
  } = config
  
  const store = useCustomerJourneyStore()
  const { suggestions, addSuggestion, clearSuggestions } = useJourneyAI()
  const stepTimerRef = useRef<Date>(new Date())
  const recentActionsRef = useRef<string[]>([])
  
  // Build context for AI decisions
  const buildContext = useCallback((): AssistantContext => {
    const timeOnStep = (new Date().getTime() - stepTimerRef.current.getTime()) / 60000 // minutes
    
    return {
      currentStep: store.step,
      completedSteps: store.completedSteps,
      hasLead: !!store.leadId,
      hasSiteVisit: !!store.siteVisitId,
      hasEstimate: !!store.estimateId,
      hasJob: !!store.jobId,
      recentActions: recentActionsRef.current.slice(-contextWindow),
      timeOnStep
    }
  }, [store, contextWindow])
  
  // Generate suggestions based on current context
  const generateSuggestions = useCallback(() => {
    if (!enabled || !autoSuggest) return
    
    const context = buildContext()
    const stepSuggestionFn = stepSuggestions[context.currentStep]
    
    if (!stepSuggestionFn) return
    
    // Get base suggestions for current step
    const baseSuggestions = stepSuggestionFn(context)
    
    // Add contextual suggestions based on time spent
    const contextualSuggestions: AIAction[] = []
    
    // If stuck on a step for too long, suggest help
    if (context.timeOnStep > 10) {
      contextualSuggestions.push({
        id: 'ai-help',
        type: 'warning',
        title: 'Need Help?',
        description: `You've been on this step for ${Math.round(context.timeOnStep)} minutes. Would you like assistance?`,
        confidence: 0.7,
        timestamp: new Date().toISOString(),
        action: () => {
          journeyEventBus.emit('open:help_modal')
        }
      })
    }
    
    // If estimate approved but no job, suggest conversion
    if (context.currentStep === 'estimate' && store.estimate?.status === 'approved' && !context.hasJob) {
      contextualSuggestions.push({
        id: 'ai-convert',
        type: 'automation',
        title: 'Convert to Job',
        description: 'Estimate is approved! Convert to job now?',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        action: () => {
          journeyEventBus.emit('convert:estimate_to_job')
        }
      })
    }
    
    // Combine and limit suggestions
    const allSuggestions = [...contextualSuggestions, ...baseSuggestions]
      .slice(0, maxSuggestions)
    
    // Clear old and add new suggestions
    clearSuggestions()
    allSuggestions.forEach(suggestion => addSuggestion(suggestion))
  }, [enabled, autoSuggest, buildContext, maxSuggestions, store]) // Remove clearSuggestions and addSuggestion from deps
  
  // Track actions for context
  const trackAction = useCallback((action: string) => {
    recentActionsRef.current = [...recentActionsRef.current.slice(-contextWindow + 1), action]
  }, [contextWindow])
  
  // Manual suggestion trigger
  const requestSuggestion = useCallback(async (query?: string) => {
    const context = buildContext()
    
    // In a real implementation, this would call an AI service
    // For now, return contextual suggestions
    generateSuggestions()
    
    // Simulate AI processing
    showToast.info('Analyzing journey context...')
    
    return suggestions
  }, [buildContext, generateSuggestions, suggestions])
  
  // Set up listeners and effects
  useEffect(() => {
    if (!enabled) return
    
    // Reset step timer when step changes
    const handleStepChange = () => {
      stepTimerRef.current = new Date()
      generateSuggestions()
    }
    
    // Track various events
    const events = [
      JOURNEY_EVENTS.STEP_CHANGED,
      JOURNEY_EVENTS.LEAD_CREATED,
      JOURNEY_EVENTS.SITE_VISIT_SCHEDULED,
      JOURNEY_EVENTS.ESTIMATE_CREATED,
      JOURNEY_EVENTS.JOB_CREATED
    ]
    
    events.forEach(event => {
      journeyEventBus.on(event, handleStepChange)
    })
    
    // Generate initial suggestions after a small delay to avoid infinite loop
    const timer = setTimeout(() => {
      generateSuggestions()
    }, 100)
    
    // Cleanup
    return () => {
      clearTimeout(timer)
      events.forEach(event => {
        journeyEventBus.off(event, handleStepChange)
      })
    }
  }, [enabled, generateSuggestions])
  
  // Periodic suggestion refresh
  useEffect(() => {
    if (!enabled || !autoSuggest) return
    
    const interval = setInterval(() => {
      generateSuggestions()
    }, 60000) // Refresh every minute
    
    return () => clearInterval(interval)
  }, [enabled, autoSuggest, generateSuggestions])
  
  return {
    suggestions,
    requestSuggestion,
    trackAction,
    clearSuggestions,
    context: buildContext()
  }
}

// Hook for components to respond to AI suggestions
export const useAIActionHandler = () => {
  useEffect(() => {
    const handlers: Record<string, () => void> = {
      'open:site_visit_modal': () => {
        // Implementation would open the actual modal
        console.log('Opening site visit modal...')
      },
      'open:ai_estimate_modal': () => {
        console.log('Opening AI estimate modal...')
      },
      'open:photo_capture': () => {
        console.log('Opening photo capture...')
      },
      'send:estimate_email': () => {
        console.log('Sending estimate email...')
      },
      'open:crew_assignment': () => {
        console.log('Opening crew assignment...')
      },
      'open:job_update_modal': () => {
        console.log('Opening job update modal...')
      },
      'send:review_request': () => {
        console.log('Sending review request...')
      },
      'convert:estimate_to_job': () => {
        console.log('Converting estimate to job...')
      }
    }
    
    // Register all handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      journeyEventBus.on(event, handler)
    })
    
    // Cleanup
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        journeyEventBus.off(event, handler)
      })
    }
  }, [])
}