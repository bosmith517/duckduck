import React from 'react'
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { supabase } from '../../supabaseClient'
import { EventEmitter } from 'events'
import { showToast } from '../utils/toast'
import { config, isFeatureEnabled } from '../../lib/config'
import { journeyLogger, trackStepChange, logError } from '../../lib/sentry'

// Re-export types from context (we'll keep using the same schemas)
export type { 
  JourneyStep, 
  LeadSchema, 
  SiteVisitSchema, 
  EstimateSchema, 
  JobSchema,
  PhotoBatch,
  AIAction,
  JourneyData 
} from '../contexts/CustomerJourneyContext'

import type {
  JourneyStep,
  LeadSchema,
  SiteVisitSchema,
  EstimateSchema,
  JobSchema,
  PhotoBatch,
  AIAction,
  JourneyData
} from '../contexts/CustomerJourneyContext'

// Journey store interface
interface CustomerJourneyStore extends JourneyData {
  // State
  isConnected: boolean
  lastSyncTime?: string
  
  // Actions - State updates
  setJourney: (data: Partial<JourneyData>) => void
  updateStep: (step: JourneyStep) => void
  
  // Actions - Entity management
  setLead: (lead: LeadSchema) => void
  setSiteVisit: (visit: SiteVisitSchema) => void
  setEstimate: (estimate: EstimateSchema) => void
  setJob: (job: JobSchema) => void
  setQuote: (quote: any) => void
  setInvoice: (invoice: any) => void
  
  // Actions - Photo management
  addPhotosToQueue: (files: File[]) => void
  updatePhotoProgress: (progress: number, uploadedCount?: number) => void
  clearPhotoQueue: () => void
  setPhotoStatus: (status: PhotoBatch['status']) => void
  
  // Actions - AI assistance
  addAISuggestion: (suggestion: AIAction) => void
  removeAISuggestion: (id: string) => void
  clearAISuggestions: () => void
  
  // Actions - Journey operations
  startNewJourney: () => void
  completeCurrentStep: () => void
  goToPreviousStep: () => void
  markStepCompleted: (step: JourneyStep) => void
  approveEstimate: (estimateId: string) => void
  
  // Actions - Real-time sync
  setConnected: (connected: boolean) => void
  updateSyncTime: () => void
  
  // Subscriptions
  subscribeToRealtimeUpdates: () => () => void
}

// Event bus for component communication
export const journeyEventBus = new EventEmitter()

// Journey events
export const JOURNEY_EVENTS = {
  STEP_CHANGED: 'journey:step_changed',
  LEAD_CREATED: 'journey:lead_created',
  LEAD_QUALIFIED: 'journey:lead_qualified',
  SITE_VISIT_SCHEDULED: 'journey:site_visit_scheduled',
  SITE_VISIT_COMPLETED: 'journey:site_visit_completed',
  ESTIMATE_CREATED: 'journey:estimate_created',
  ESTIMATE_VERSION_CREATED: 'journey:estimate_version_created',
  ESTIMATE_STATUS_UPDATED: 'journey:estimate_status_updated',
  ESTIMATE_APPROVED: 'journey:estimate_approved',
  JOB_CREATED: 'journey:job_created',
  JOB_STARTED: 'journey:job_started',
  JOB_COMPLETED: 'journey:job_completed',
  QUOTE_CREATED: 'journey:quote_created',
  QUOTE_SENT: 'journey:quote_sent',
  INVOICE_CREATED: 'journey:invoice_created',
  INVOICE_SENT: 'journey:invoice_sent',
  PAYMENT_RECEIVED: 'journey:payment_received',
  PHOTO_BATCH_UPLOADED: 'journey:photo_batch_uploaded',
  AI_SUGGESTION_ADDED: 'journey:ai_suggestion_added',
  ERROR_OCCURRED: 'journey:error_occurred'
} as const

// Initial state
const initialState: Partial<CustomerJourneyStore> = {
  step: 'new_inquiry',
  completedSteps: [],
  photoQueue: {
    files: [],
    uploadProgress: 0,
    uploadedCount: 0,
    totalCount: 0,
    status: 'pending'
  },
  aiSuggestions: [],
  startedAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  isConnected: false
}

// Create the store
export const useCustomerJourneyStore = create<CustomerJourneyStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial state
        ...initialState as CustomerJourneyStore,
        
        // State updates
        setJourney: (data) => {
          const previousStep = get().step
          set((state) => ({
            ...state,
            ...data,
            lastUpdated: new Date().toISOString()
          }))
          
          // Emit event if step changed and unified journey is enabled
          if (data.step && data.step !== previousStep && isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.STEP_CHANGED, {
              from: previousStep,
              to: data.step,
              journey: get()
            })
          }
        },
        
        updateStep: (step) => {
          const currentStep = get().step
          const completedSteps = [...get().completedSteps]
          
          if (!completedSteps.includes(currentStep)) {
            completedSteps.push(currentStep)
          }
          
          set({
            step,
            previousStep: currentStep,
            completedSteps,
            lastUpdated: new Date().toISOString()
          })
          
          // Track step change with Sentry
          trackStepChange(currentStep, step, {
            journeyStep: step,
            leadId: get().leadId,
            jobId: get().jobId,
            tenantId: get().tenantId,
            userId: get().userId
          })
          
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.STEP_CHANGED, { 
              from: currentStep, 
              to: step 
            })
          }
        },
        
        // Entity management
        setLead: (lead) => {
          set({ 
            lead, 
            leadId: lead.id,
            // Also set account/contact IDs from lead if available
            accountId: lead.account_id || undefined,
            contactId: lead.contact_id || undefined
          })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.LEAD_CREATED, { lead })
          }
        },
        
        setSiteVisit: (visit) => {
          set({ siteVisit: visit, siteVisitId: visit.id })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.SITE_VISIT_SCHEDULED, { visit })
          }
          
          // Auto-advance to site visit step if still on inquiry and journey is enabled
          if (get().step === 'new_inquiry' && config.journey.autoAdvanceSteps) {
            get().updateStep('site_visit')
          }
        },
        
        setEstimate: (estimate) => {
          set({ estimate, estimateId: estimate.id })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_CREATED, { estimate })
          }
          
          // Auto-advance to estimate step if on site visit and journey is enabled
          if (get().step === 'site_visit' && config.journey.autoAdvanceSteps) {
            get().updateStep('estimate')
          }
        },
        
        setJob: (job) => {
          set({ job, jobId: job.id })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.JOB_CREATED, { job })
          }
          
          // Auto-advance to job tracking if journey is enabled
          if (get().step === 'approval' && config.journey.autoAdvanceSteps) {
            get().updateStep('job_tracking')
          }
        },
        
        setQuote: (quote) => {
          set({ quote, quoteId: quote.id })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.QUOTE_CREATED, { quote })
          }
        },
        
        setInvoice: (invoice) => {
          set({ invoice, invoiceId: invoice.id })
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.INVOICE_CREATED, { invoice })
          }
        },
        
        // Photo management
        addPhotosToQueue: (files) => {
          const currentQueue = get().photoQueue
          set({
            photoQueue: {
              ...currentQueue,
              files: [...currentQueue.files, ...files],
              totalCount: currentQueue.totalCount + files.length,
              status: 'pending'
            }
          })
        },
        
        updatePhotoProgress: (progress, uploadedCount) => {
          set((state) => ({
            photoQueue: {
              ...state.photoQueue,
              uploadProgress: progress,
              uploadedCount: uploadedCount ?? state.photoQueue.uploadedCount,
              status: progress === 100 ? 'completed' : 'uploading'
            }
          }))
        },
        
        clearPhotoQueue: () => {
          set({
            photoQueue: {
              files: [],
              uploadProgress: 0,
              uploadedCount: 0,
              totalCount: 0,
              status: 'pending'
            }
          })
        },
        
        setPhotoStatus: (status) => {
          set((state) => ({
            photoQueue: {
              ...state.photoQueue,
              status
            }
          }))
        },
        
        // AI assistance
        addAISuggestion: (suggestion) => {
          if (!config.journey.ai.enabled) {
            console.log('AI suggestions disabled by feature flag')
            return
          }
          
          set((state) => ({
            aiSuggestions: [...state.aiSuggestions, suggestion]
          }))
          
          if (isFeatureEnabled('aiSuggestions')) {
            journeyEventBus.emit(JOURNEY_EVENTS.AI_SUGGESTION_ADDED, { suggestion })
          }
        },
        
        removeAISuggestion: (id) => {
          set((state) => ({
            aiSuggestions: state.aiSuggestions.filter(s => s.id !== id)
          }))
        },
        
        clearAISuggestions: () => {
          set({ aiSuggestions: [] })
        },
        
        // Journey operations
        startNewJourney: () => {
          set({
            ...initialState as CustomerJourneyStore,
            startedAt: new Date().toISOString()
          })
        },
        
        completeCurrentStep: () => {
          const stepOrder: JourneyStep[] = [
            'new_inquiry',
            'site_visit',
            'estimate',
            'estimate_revision',
            'approval',
            'job_tracking',
            'portal',
            'completed'
          ]
          
          const currentIndex = stepOrder.indexOf(get().step)
          if (currentIndex < stepOrder.length - 1) {
            get().updateStep(stepOrder[currentIndex + 1])
          }
        },
        
        goToPreviousStep: () => {
          const previousStep = get().previousStep
          if (previousStep) {
            get().updateStep(previousStep)
          }
        },
        
        markStepCompleted: (step) => {
          const completedSteps = [...get().completedSteps]
          if (!completedSteps.includes(step)) {
            completedSteps.push(step)
            set({ completedSteps })
          }
        },
        
        approveEstimate: (estimateId) => {
          // Mark estimate step as completed
          get().markStepCompleted('estimate')
          
          // Advance to approval step
          get().updateStep('approval')
          
          // Emit ESTIMATE_APPROVED event for components to listen to
          if (isFeatureEnabled('unifiedJourney')) {
            journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_APPROVED, { 
              estimateId,
              leadId: get().leadId,
              step: 'approval'
            })
          }
        },
        
        // Real-time sync
        setConnected: (connected) => {
          set({ isConnected: connected })
        },
        
        updateSyncTime: () => {
          set({ lastSyncTime: new Date().toISOString() })
        },
        
        // Subscribe to real-time updates
        subscribeToRealtimeUpdates: () => {
          // Check if real-time sync is enabled
          if (!config.realTime.enabled) {
            console.log('Real-time sync is disabled by feature flag')
            return () => {} // Return empty cleanup function
          }

          const state = get()
          const channels: any[] = []
          
          try {
          
          // Subscribe to leads table
          if (state.leadId && config.realTime.channels.leads) {
            const channelName = `tenant-${state.tenantId}-lead-${state.leadId}`
            const leadChannel = supabase
              .channel(channelName)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'leads',
                filter: `id=eq.${state.leadId}`
              }, (payload) => {
                if (payload.new && isFeatureEnabled('realTimeSync')) {
                  get().setLead(payload.new as LeadSchema)
                  get().updateSyncTime()
                }
              })
              .subscribe()
            
            channels.push(leadChannel)
          }
          
          // Subscribe to site visits
          if (state.leadId && config.realTime.channels.siteVisits) {
            const channelName = `tenant-${state.tenantId}-visits-${state.leadId}`
            const visitChannel = supabase
              .channel(channelName)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'site_visits',
                filter: `lead_id=eq.${state.leadId}`
              }, (payload) => {
                if (payload.new && isFeatureEnabled('realTimeSync')) {
                  get().setSiteVisit(payload.new as SiteVisitSchema)
                  get().updateSyncTime()
                }
              })
              .subscribe()
            
            channels.push(visitChannel)
          }
          
          // Subscribe to estimates
          if ((state.leadId || state.jobId) && config.realTime.channels.estimates) {
            const filter = state.jobId 
              ? `job_id=eq.${state.jobId}` 
              : `lead_id=eq.${state.leadId}`
            
            const channelName = `tenant-${state.tenantId}-estimates-${state.leadId || state.jobId}`
            const estimateChannel = supabase
              .channel(channelName)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'estimates',
                filter
              }, (payload) => {
                if (payload.new && isFeatureEnabled('realTimeSync')) {
                  get().setEstimate(payload.new as EstimateSchema)
                  get().updateSyncTime()
                }
              })
              .subscribe()
            
            channels.push(estimateChannel)
          }
          
          // Subscribe to jobs
          if (state.jobId && config.realTime.channels.jobs) {
            const channelName = `tenant-${state.tenantId}-job-${state.jobId}`
            const jobChannel = supabase
              .channel(channelName)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'jobs',
                filter: `id=eq.${state.jobId}`
              }, (payload) => {
                if (payload.new && isFeatureEnabled('realTimeSync')) {
                  get().setJob(payload.new as JobSchema)
                  get().updateSyncTime()
                }
              })
              .subscribe()
            
            channels.push(jobChannel)
          }

          // Subscribe to photos if feature is enabled
          if ((state.leadId || state.jobId) && config.realTime.channels.photos) {
            const filter = state.jobId 
              ? `job_id=eq.${state.jobId}` 
              : `lead_id=eq.${state.leadId}`
            
            const channelName = `tenant-${state.tenantId}-photos-${state.leadId || state.jobId}`
            const photoChannel = supabase
              .channel(channelName)
              .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'job_photos',
                filter
              }, (payload) => {
                if (isFeatureEnabled('photoBatching')) {
                  // Emit photo update event
                  journeyEventBus.emit(JOURNEY_EVENTS.PHOTO_BATCH_UPLOADED, {
                    photo: payload.new,
                    action: payload.eventType
                  })
                  get().updateSyncTime()
                }
              })
              .subscribe()
            
            channels.push(photoChannel)
          }
          
            // Update connection status
            get().setConnected(true)
            
            // Return cleanup function
            return () => {
              try {
                channels.forEach(channel => {
                  supabase.removeChannel(channel)
                })
                get().setConnected(false)
              } catch (error) {
                logError(error as Error, {
                  journeyStep: get().step,
                  leadId: get().leadId,
                  jobId: get().jobId,
                  tenantId: get().tenantId
                }, 'warning')
              }
            }
          } catch (error) {
            logError(error as Error, {
              journeyStep: get().step,
              leadId: get().leadId,
              jobId: get().jobId,
              tenantId: get().tenantId
            }, 'error')
            
            get().setConnected(false)
            
            // Return empty cleanup function on error
            return () => {}
          }
        }
      })),
      {
        name: 'customer-journey-storage',
        // Only persist essential data, not File objects
        partialize: (state) => ({
          step: state.step,
          previousStep: state.previousStep,
          leadId: state.leadId,
          siteVisitId: state.siteVisitId,
          estimateId: state.estimateId,
          jobId: state.jobId,
          contactId: state.contactId,
          accountId: state.accountId,
          completedSteps: state.completedSteps,
          startedAt: state.startedAt,
          lastUpdated: state.lastUpdated,
          userId: state.userId,
          tenantId: state.tenantId
        })
      }
    ),
    {
      name: 'CustomerJourneyStore'
    }
  )
)

// Selector hooks for specific parts of the store
export const useJourneyStep = () => {
  const step = useCustomerJourneyStore(state => state.step)
  const updateStep = useCustomerJourneyStore(state => state.updateStep)
  const completedSteps = useCustomerJourneyStore(state => state.completedSteps)
  
  return { currentStep: step, updateStep, completedSteps }
}

export const useJourneyPhotos = () => {
  const photoQueue = useCustomerJourneyStore(state => state.photoQueue)
  const addPhotos = useCustomerJourneyStore(state => state.addPhotosToQueue)
  const updateProgress = useCustomerJourneyStore(state => state.updatePhotoProgress)
  const clearQueue = useCustomerJourneyStore(state => state.clearPhotoQueue)
  const setStatus = useCustomerJourneyStore(state => state.setPhotoStatus)
  
  return { photoQueue, addPhotos, updateProgress, clearQueue, setStatus }
}

export const useJourneyAI = () => {
  const suggestions = useCustomerJourneyStore(state => state.aiSuggestions)
  const addSuggestion = useCustomerJourneyStore(state => state.addAISuggestion)
  const removeSuggestion = useCustomerJourneyStore(state => state.removeAISuggestion)
  const clearSuggestions = useCustomerJourneyStore(state => state.clearAISuggestions)
  
  return { suggestions, addSuggestion, removeSuggestion, clearSuggestions }
}

export const useJourneyEntities = () => {
  const lead = useCustomerJourneyStore(state => state.lead)
  const siteVisit = useCustomerJourneyStore(state => state.siteVisit)
  const estimate = useCustomerJourneyStore(state => state.estimate)
  const job = useCustomerJourneyStore(state => state.job)
  
  return { lead, siteVisit, estimate, job }
}

// Hook to automatically manage real-time subscriptions with feature flag support
export const useJourneySubscriptions = () => {
  const leadId = useCustomerJourneyStore(state => state.leadId)
  const jobId = useCustomerJourneyStore(state => state.jobId)
  const subscribeToRealtimeUpdates = useCustomerJourneyStore(state => state.subscribeToRealtimeUpdates)
  
  React.useEffect(() => {
    // Only subscribe if feature is enabled and we have an ID to track
    if (!config.journey.enabled || (!leadId && !jobId)) {
      return
    }

    // Initialize subscriptions
    const cleanup = subscribeToRealtimeUpdates()
    
    // Return cleanup function
    return cleanup
  }, [leadId, jobId, subscribeToRealtimeUpdates])
  
  return { leadId, jobId, isEnabled: config.journey.enabled }
}