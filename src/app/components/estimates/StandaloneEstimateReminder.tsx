import React, { useState, useEffect } from 'react'
import { KTIcon } from '../../../_metronic/helpers'

interface StandaloneEstimateReminderProps {
  estimateId: string
  isStandalone: boolean
  onLinkToJourney?: () => void
}

export const StandaloneEstimateReminder: React.FC<StandaloneEstimateReminderProps> = ({
  estimateId,
  isStandalone,
  onLinkToJourney
}) => {
  const [isDismissed, setIsDismissed] = useState(false)

  // Check if this reminder was previously dismissed
  useEffect(() => {
    const dismissedKey = `estimate_reminder_dismissed_${estimateId}`
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true'
    setIsDismissed(wasDismissed)
  }, [estimateId])

  const handleDismiss = () => {
    const dismissedKey = `estimate_reminder_dismissed_${estimateId}`
    localStorage.setItem(dismissedKey, 'true')
    setIsDismissed(true)
  }

  // Don't show if not standalone, already dismissed, or no estimateId
  if (!isStandalone || isDismissed || !estimateId) {
    return null
  }

  return (
    <div className="alert alert-light-warning d-flex align-items-center p-5 mb-6 position-relative">
      <button
        type="button"
        className="btn-close position-absolute top-0 end-0 m-2"
        onClick={handleDismiss}
        aria-label="Dismiss reminder"
      />
      
      <KTIcon iconName="information-5" className="fs-2hx text-warning me-4" />
      
      <div className="d-flex flex-column flex-grow-1">
        <h4 className="mb-1">Standalone Estimate</h4>
        <span>
          This estimate is not linked to any customer journey. 
          {onLinkToJourney && (
            <>
              {' '}You can{' '}
              <a 
                href="#" 
                className="fw-bold text-warning-hover"
                onClick={(e) => {
                  e.preventDefault()
                  onLinkToJourney()
                }}
              >
                link it to a lead
              </a>
              {' '}to track it in the customer journey.
            </>
          )}
        </span>
        <div className="mt-2 text-muted fs-7">
          <strong>Tip:</strong> Linking estimates to leads helps track conversion rates and customer history.
        </div>
      </div>
    </div>
  )
}