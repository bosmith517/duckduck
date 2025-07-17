import React, { useMemo } from 'react'
import { useCustomerJourneyStore, useJourneyStep, useJourneyAI } from '../../stores/customerJourneyStore'
import type { JourneyStep } from '../../contexts/CustomerJourneyContext'
import clsx from 'clsx'

interface StepConfig {
  key: JourneyStep
  label: string
  icon: string
  description: string
}

interface StepTrackerProps {
  className?: string
  showDescriptions?: boolean
  showAISuggestions?: boolean
  onStepClick?: (step: JourneyStep) => void
  compact?: boolean
}

const steps: StepConfig[] = [
  {
    key: 'new_inquiry',
    label: 'New Inquiry',
    icon: 'ki-information',
    description: 'Capture lead information'
  },
  {
    key: 'site_visit',
    label: 'Site Visit',
    icon: 'ki-geolocation',
    description: 'Schedule property inspection'
  },
  {
    key: 'estimate',
    label: 'Estimate',
    icon: 'ki-calculator',
    description: 'Create project estimate'
  },
  {
    key: 'approval',
    label: 'Approval',
    icon: 'ki-check-circle',
    description: 'Customer approval'
  },
  {
    key: 'conversion',
    label: 'Conversion',
    icon: 'ki-handshake',
    description: 'Convert to job'
  },
  {
    key: 'job_tracking',
    label: 'Job Tracking',
    icon: 'ki-gear',
    description: 'Track work progress'
  },
  {
    key: 'portal',
    label: 'Customer Portal',
    icon: 'ki-user',
    description: 'Customer access'
  }
]

const StepTracker: React.FC<StepTrackerProps> = ({
  className = '',
  showDescriptions = false,
  showAISuggestions = true,
  onStepClick,
  compact = false
}) => {
  const { currentStep, completedSteps } = useJourneyStep()
  const { suggestions } = useJourneyAI()
  const isConnected = useCustomerJourneyStore(state => state.isConnected)
  
  // Get suggestions for current step
  const currentStepSuggestions = useMemo(() => {
    return suggestions.filter(s => s.type === 'suggestion').slice(0, 2)
  }, [suggestions])
  
  const getStepStatus = (step: JourneyStep): 'completed' | 'current' | 'upcoming' => {
    if (completedSteps.includes(step)) return 'completed'
    if (currentStep === step) return 'current'
    return 'upcoming'
  }
  
  const getStepIndex = (step: JourneyStep): number => {
    return steps.findIndex(s => s.key === step)
  }
  
  const currentStepIndex = getStepIndex(currentStep)
  
  const handleStepClick = (step: JourneyStep) => {
    if (onStepClick && (completedSteps.includes(step) || step === currentStep)) {
      onStepClick(step)
    }
  }
  
  if (compact) {
    return (
      <div className={`card ${className}`}>
        <div className="card-body py-3">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <div className="symbol symbol-40px me-3">
                <div className="symbol-label bg-light-primary">
                  <i className={`ki-duotone ${steps[currentStepIndex]?.icon || 'ki-information'} fs-2 text-primary`}>
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                </div>
              </div>
              <div>
                <div className="fs-6 fw-bold text-gray-800">
                  {steps[currentStepIndex]?.label || 'Unknown Step'}
                </div>
                <div className="fs-7 text-gray-600">
                  Step {currentStepIndex + 1} of {steps.length}
                </div>
              </div>
            </div>
            
            <div className="d-flex align-items-center">
              {/* Progress indicator */}
              <div className="progress h-6px w-100px me-3">
                <div
                  className="progress-bar bg-primary"
                  role="progressbar"
                  style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
              
              {/* Connection status */}
              <div className={`badge badge-sm ${isConnected ? 'badge-light-success' : 'badge-light-danger'}`}>
                {isConnected ? 'Live' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        {/* Steps */}
        <div className="stepper stepper-pills stepper-column d-flex flex-column flex-xl-row flex-row-fluid">
          {steps.map((step, index) => {
            const status = getStepStatus(step.key)
            const isClickable = onStepClick && (status === 'completed' || status === 'current')
            
            return (
              <React.Fragment key={step.key}>
                {/* Step */}
                <div
                  className={clsx('stepper-item d-flex align-items-center flex-1', {
                    'current': status === 'current',
                    'completed': status === 'completed',
                    'cursor-pointer': isClickable
                  })}
                  onClick={() => isClickable && handleStepClick(step.key)}
                >
                  <div className="stepper-wrapper">
                    {/* Step number/icon */}
                    <div className={clsx('stepper-icon rounded-3', {
                      'bg-primary': status === 'current',
                      'bg-success': status === 'completed',
                      'bg-light': status === 'upcoming'
                    })}>
                      {status === 'completed' ? (
                        <i className="ki-duotone ki-check fs-2 text-white">
                          <span className="path1"></span>
                          <span className="path2"></span>
                        </i>
                      ) : (
                        <i className={clsx(`ki-duotone ${step.icon} fs-2`, {
                          'text-white': status === 'current',
                          'text-gray-400': status === 'upcoming'
                        })}>
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                          <span className="path4"></span>
                        </i>
                      )}
                    </div>
                    
                    {/* Step label and description */}
                    <div className="stepper-label">
                      <h3 className={clsx('stepper-title fs-7', {
                        'text-primary': status === 'current',
                        'text-gray-800': status === 'completed',
                        'text-gray-400': status === 'upcoming'
                      })}>
                        {step.label}
                      </h3>
                      
                      {showDescriptions && (
                        <div className={clsx('stepper-desc fs-8', {
                          'text-gray-600': status !== 'upcoming',
                          'text-gray-400': status === 'upcoming'
                        })}>
                          {step.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Line between steps */}
                  {index < steps.length - 1 && (
                    <div className={clsx('stepper-line h-40px mx-4', {
                      'bg-primary': index < currentStepIndex,
                      'bg-gray-300': index >= currentStepIndex
                    })}></div>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>
        
        {/* AI Suggestions */}
        {showAISuggestions && currentStepSuggestions.length > 0 && (
          <div className="mt-6">
            <div className="d-flex align-items-center mb-3">
              <i className="ki-duotone ki-artificial-intelligence fs-2 text-primary me-2">
                <span className="path1"></span>
                <span className="path2"></span>
                <span className="path3"></span>
              </i>
              <h5 className="mb-0">AI Suggestions</h5>
            </div>
            
            <div className="row g-3">
              {currentStepSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="col-md-6">
                  <div className="card bg-light-primary border-0">
                    <div className="card-body py-3">
                      <div className="d-flex align-items-start">
                        <i className="ki-duotone ki-information-5 fs-2 text-primary me-3">
                          <span className="path1"></span>
                          <span className="path2"></span>
                          <span className="path3"></span>
                        </i>
                        <div className="flex-1">
                          <h6 className="mb-1">{suggestion.title}</h6>
                          <p className="mb-2 fs-7 text-gray-700">{suggestion.description}</p>
                          {suggestion.action && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={suggestion.action}
                            >
                              Take Action
                            </button>
                          )}
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

export default StepTracker

// Mini version for embedding in modals
export const StepTrackerMini: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { currentStep, completedSteps } = useJourneyStep()
  
  const currentIndex = steps.findIndex(s => s.key === currentStep)
  const progress = ((completedSteps.length + 1) / steps.length) * 100
  
  return (
    <div 
      className={`d-flex align-items-center ${className}`}
      role="progressbar"
      aria-label="Customer journey progress"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="me-3">
        <span className="fs-7 text-gray-600">Journey Progress</span>
      </div>
      <div className="progress h-5px flex-1">
        <div
          className="progress-bar bg-primary"
          role="progressbar"
          style={{ width: `${progress}%` }}
          aria-label={`Journey ${Math.round(progress)}% complete`}
        ></div>
      </div>
      <div className="ms-3">
        <span 
          className="badge badge-light-primary"
          aria-current={currentStep ? "step" : undefined}
          aria-label={`Current step: ${steps[currentIndex]?.label || 'Unknown'}`}
        >
          {steps[currentIndex]?.label || 'Unknown'}
        </span>
      </div>
    </div>
  )
}