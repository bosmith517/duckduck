import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import { EventEmitter } from 'events'
import { showToast } from '../utils/toast'

// Journey step types
export type JourneyStep = 
  | 'new_inquiry' 
  | 'site_visit' 
  | 'estimate' 
  | 'estimate_revision'
  | 'approval' 
  | 'conversion'
  | 'job_tracking' 
  | 'portal'
  | 'completed'

// Schema definitions for AI-friendly data structures
export interface LeadSchema {
  id: string
  name: string
  contact: {
    email?: string
    phone?: string
  }
  service_type: string
  urgency: 'low' | 'medium' | 'high'
  source?: string
  notes?: string
  status: 'new' | 'qualified' | 'converted'
  site_visit_date?: string
  full_address?: string
  created_at: string
  updated_at: string
  // Customer relationship fields
  account_id?: string
  contact_id?: string
  contact_type?: 'residential' | 'business'
  converted_account_id?: string
  converted_contact_id?: string
  phone_number?: string
}

export interface SiteVisitSchema {
  id: string
  lead_id: string
  scheduled_at: string
  duration_minutes: number
  assigned_to?: string
  notes?: string
  status: 'scheduled' | 'completed' | 'cancelled'
  photos?: string[]
  created_at: string
}

export interface EstimateSchema {
  id: string
  job_id?: string
  lead_id?: string
  number: string
  estimate_number?: string
  line_items: Array<{
    title: string
    description?: string
    quantity: number
    unit_price: number
    total: number
  }>
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  total_amount?: number
  valid_until: string
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected'
  created_at: string
  approved_at?: string
  approved_by?: string
  version?: number
  is_approved?: boolean
  project_title?: string
  description?: string
  estimated_hours?: number
}

export interface JobSchema {
  id: string
  title: string
  description?: string
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  scheduled_start?: string
  scheduled_end?: string
  actual_start?: string
  actual_end?: string
  assigned_team?: string[]
  lead_id?: string
  contact_id?: string
  account_id?: string
  estimate_id?: string
  milestones?: Array<{
    id: string
    title: string
    completed: boolean
    completed_at?: string
  }>
  created_at: string
  updated_at: string
}

export interface PhotoBatch {
  files: File[]
  uploadProgress: number
  uploadedCount: number
  totalCount: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
}

export interface AIAction {
  id: string
  type: 'suggestion' | 'warning' | 'automation'
  title: string
  description: string
  action?: () => void
  confidence: number
  timestamp: string
}

// Journey data structure
export interface JourneyData {
  // Current state
  step: JourneyStep
  previousStep?: JourneyStep
  
  // Entity IDs
  leadId?: string
  siteVisitId?: string
  estimateId?: string
  jobId?: string
  contactId?: string
  accountId?: string
  quoteId?: string
  invoiceId?: string
  
  // Entity data (cached for quick access)
  lead?: LeadSchema
  siteVisit?: SiteVisitSchema
  estimate?: EstimateSchema
  job?: JobSchema
  quote?: any // Will be typed when quote schema is defined
  invoice?: any // Will be typed when invoice schema is defined
  
  // Photo management
  photoQueue: PhotoBatch
  
  // AI assistance
  aiSuggestions: AIAction[]
  aiContext?: any
  
  // Metadata
  startedAt: string
  lastUpdated: string
  completedSteps: JourneyStep[]
  
  // User info
  userId?: string
  tenantId?: string
}

// Context type definition
interface CustomerJourneyContextType {
  journey: JourneyData
  
  // State updates
  setJourney: (data: Partial<JourneyData>) => void
  updateStep: (step: JourneyStep) => void
  
  // Entity management
  setLead: (lead: LeadSchema) => void
  setSiteVisit: (visit: SiteVisitSchema) => void
  setEstimate: (estimate: EstimateSchema) => void
  setJob: (job: JobSchema) => void
  
  // Photo management
  addPhotosToQueue: (files: File[]) => void
  updatePhotoProgress: (progress: number) => void
  clearPhotoQueue: () => void
  
  // AI assistance
  addAISuggestion: (suggestion: AIAction) => void
  clearAISuggestions: () => void
  
  // Journey operations
  startNewJourney: () => void
  completeCurrentStep: () => void
  goToPreviousStep: () => void
  
  // Real-time sync
  isConnected: boolean
  lastSyncTime?: string
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
  PHOTO_BATCH_UPLOADED: 'journey:photo_batch_uploaded',
  AI_SUGGESTION_ADDED: 'journey:ai_suggestion_added',
  ERROR_OCCURRED: 'journey:error_occurred'
} as const

// Create context
const CustomerJourneyContext = createContext<CustomerJourneyContextType | undefined>(undefined)

// Initial journey state
const initialJourneyState: JourneyData = {
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
  lastUpdated: new Date().toISOString()
}

// Provider component
export const CustomerJourneyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [journey, setJourneyState] = useState<JourneyData>(initialJourneyState)
  const [isConnected, setIsConnected] = useState(false)
  const subscriptionRef = useRef<any>(null)

  // Update journey state
  const setJourney = useCallback((data: Partial<JourneyData>) => {
    setJourneyState(prev => {
      const updated = {
        ...prev,
        ...data,
        lastUpdated: new Date().toISOString()
      }
      
      // Emit event for state changes
      if (data.step && data.step !== prev.step) {
        journeyEventBus.emit(JOURNEY_EVENTS.STEP_CHANGED, {
          from: prev.step,
          to: data.step,
          journey: updated
        })
      }
      
      return updated
    })
  }, [])

  // Update current step
  const updateStep = useCallback((step: JourneyStep) => {
    setJourneyState(prev => {
      const completedSteps = [...prev.completedSteps]
      if (!completedSteps.includes(prev.step)) {
        completedSteps.push(prev.step)
      }
      
      return {
        ...prev,
        step,
        previousStep: prev.step,
        completedSteps,
        lastUpdated: new Date().toISOString()
      }
    })
    
    journeyEventBus.emit(JOURNEY_EVENTS.STEP_CHANGED, { step })
  }, [])

  // Entity setters
  const setLead = useCallback((lead: LeadSchema) => {
    setJourney({ lead, leadId: lead.id })
    journeyEventBus.emit(JOURNEY_EVENTS.LEAD_CREATED, { lead })
  }, [setJourney])

  const setSiteVisit = useCallback((visit: SiteVisitSchema) => {
    setJourney({ siteVisit: visit, siteVisitId: visit.id })
    journeyEventBus.emit(JOURNEY_EVENTS.SITE_VISIT_SCHEDULED, { visit })
  }, [setJourney])

  const setEstimate = useCallback((estimate: EstimateSchema) => {
    setJourney({ estimate, estimateId: estimate.id })
    journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_CREATED, { estimate })
  }, [setJourney])

  const setJob = useCallback((job: JobSchema) => {
    setJourney({ job, jobId: job.id })
    journeyEventBus.emit(JOURNEY_EVENTS.JOB_CREATED, { job })
  }, [setJourney])

  // Photo management
  const addPhotosToQueue = useCallback((files: File[]) => {
    setJourneyState(prev => ({
      ...prev,
      photoQueue: {
        ...prev.photoQueue,
        files: [...prev.photoQueue.files, ...files],
        totalCount: prev.photoQueue.totalCount + files.length,
        status: 'pending'
      }
    }))
  }, [])

  const updatePhotoProgress = useCallback((progress: number) => {
    setJourneyState(prev => ({
      ...prev,
      photoQueue: {
        ...prev.photoQueue,
        uploadProgress: progress
      }
    }))
  }, [])

  const clearPhotoQueue = useCallback(() => {
    setJourneyState(prev => ({
      ...prev,
      photoQueue: initialJourneyState.photoQueue
    }))
  }, [])

  // AI assistance
  const addAISuggestion = useCallback((suggestion: AIAction) => {
    setJourneyState(prev => ({
      ...prev,
      aiSuggestions: [...prev.aiSuggestions, suggestion]
    }))
    journeyEventBus.emit(JOURNEY_EVENTS.AI_SUGGESTION_ADDED, { suggestion })
  }, [])

  const clearAISuggestions = useCallback(() => {
    setJourneyState(prev => ({
      ...prev,
      aiSuggestions: []
    }))
  }, [])

  // Journey operations
  const startNewJourney = useCallback(() => {
    setJourneyState({
      ...initialJourneyState,
      startedAt: new Date().toISOString()
    })
  }, [])

  const completeCurrentStep = useCallback(() => {
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
    
    const currentIndex = stepOrder.indexOf(journey.step)
    if (currentIndex < stepOrder.length - 1) {
      updateStep(stepOrder[currentIndex + 1])
    }
  }, [journey.step, updateStep])

  const goToPreviousStep = useCallback(() => {
    if (journey.previousStep) {
      updateStep(journey.previousStep)
    }
  }, [journey.previousStep, updateStep])

  // Set up real-time subscriptions
  useEffect(() => {
    const setupSubscriptions = async () => {
      try {
        // Get current user/tenant info
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Subscribe to journey-related tables
        const channel = supabase.channel('journey-updates')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'leads',
            filter: journey.leadId ? `id=eq.${journey.leadId}` : undefined
          }, (payload) => {
            console.log('Lead update:', payload)
            if (payload.new) {
              setLead(payload.new as LeadSchema)
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'site_visits',
            filter: journey.leadId ? `lead_id=eq.${journey.leadId}` : undefined
          }, (payload) => {
            console.log('Site visit update:', payload)
            if (payload.new) {
              setSiteVisit(payload.new as SiteVisitSchema)
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'estimates',
            filter: journey.leadId ? `lead_id=eq.${journey.leadId}` : undefined
          }, (payload) => {
            console.log('Estimate update:', payload)
            if (payload.new) {
              setEstimate(payload.new as EstimateSchema)
            }
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: journey.jobId ? `id=eq.${journey.jobId}` : undefined
          }, (payload) => {
            console.log('Job update:', payload)
            if (payload.new) {
              setJob(payload.new as JobSchema)
            }
          })
          .subscribe((status) => {
            setIsConnected(status === 'SUBSCRIBED')
          })

        subscriptionRef.current = channel
      } catch (error) {
        console.error('Error setting up subscriptions:', error)
        showToast.error('Failed to connect to real-time updates')
      }
    }

    setupSubscriptions()

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [journey.leadId, journey.jobId, setLead, setSiteVisit, setEstimate, setJob])

  // Cross-tab synchronization using localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customerJourney' && e.newValue) {
        try {
          const newJourney = JSON.parse(e.newValue)
          setJourneyState(newJourney)
        } catch (error) {
          console.error('Error parsing journey from storage:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Save journey to localStorage for cross-tab sync
  useEffect(() => {
    localStorage.setItem('customerJourney', JSON.stringify(journey))
  }, [journey])

  const value: CustomerJourneyContextType = {
    journey,
    setJourney,
    updateStep,
    setLead,
    setSiteVisit,
    setEstimate,
    setJob,
    addPhotosToQueue,
    updatePhotoProgress,
    clearPhotoQueue,
    addAISuggestion,
    clearAISuggestions,
    startNewJourney,
    completeCurrentStep,
    goToPreviousStep,
    isConnected
  }

  return (
    <CustomerJourneyContext.Provider value={value}>
      {children}
    </CustomerJourneyContext.Provider>
  )
}

// Hook to use the context
export const useCustomerJourney = () => {
  const context = useContext(CustomerJourneyContext)
  if (!context) {
    throw new Error('useCustomerJourney must be used within CustomerJourneyProvider')
  }
  return context
}

// Helper hooks for specific journey aspects
export const useJourneyStep = () => {
  const { journey, updateStep } = useCustomerJourney()
  return { currentStep: journey.step, updateStep }
}

export const useJourneyPhotos = () => {
  const { journey, addPhotosToQueue, updatePhotoProgress, clearPhotoQueue } = useCustomerJourney()
  return {
    photoQueue: journey.photoQueue,
    addPhotos: addPhotosToQueue,
    updateProgress: updatePhotoProgress,
    clearQueue: clearPhotoQueue
  }
}

export const useJourneyAI = () => {
  const { journey, addAISuggestion, clearAISuggestions } = useCustomerJourney()
  return {
    suggestions: journey.aiSuggestions,
    addSuggestion: addAISuggestion,
    clearSuggestions: clearAISuggestions
  }
}