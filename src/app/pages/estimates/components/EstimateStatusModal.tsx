import React, { useState } from 'react'
import { showToast } from '../../../utils/toast'

interface EstimateStatusModalProps {
  estimateId: string
  currentStatus: string
  newStatus: string
  onConfirm: (feedback?: string) => Promise<void>
  onCancel: () => void
}

export const EstimateStatusModal: React.FC<EstimateStatusModalProps> = ({
  estimateId,
  currentStatus,
  newStatus,
  onConfirm,
  onCancel
}) => {
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)

  const requiresFeedback = ['under_negotiation', 'rejected'].includes(newStatus)

  const handleConfirm = async () => {
    if (requiresFeedback && !feedback.trim()) {
      showToast.error('Please provide feedback for this status change')
      return
    }

    setLoading(true)
    try {
      await onConfirm(feedback || undefined)
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  const getModalTitle = () => {
    switch (newStatus) {
      case 'under_negotiation':
        return 'Customer Requesting Changes'
      case 'rejected':
        return 'Estimate Rejected'
      case 'approved':
        return 'Estimate Approved'
      case 'sent':
        return 'Send Estimate'
      default:
        return 'Update Estimate Status'
    }
  }

  const getPromptText = () => {
    switch (newStatus) {
      case 'under_negotiation':
        return 'What changes is the customer requesting?'
      case 'rejected':
        return 'Why was the estimate rejected?'
      case 'approved':
        return 'Add any notes about the approval (optional)'
      case 'sent':
        return 'Add any notes about sending this estimate (optional)'
      default:
        return 'Add notes about this status change (optional)'
    }
  }

  const getPlaceholder = () => {
    switch (newStatus) {
      case 'under_negotiation':
        return 'e.g., Customer wants to reduce scope, asking for 10% discount, wants different materials...'
      case 'rejected':
        return 'e.g., Price too high, went with competitor, project cancelled...'
      default:
        return 'Enter any relevant notes...'
    }
  }

  return (
    <div className='modal fade show d-block' tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className='modal-dialog modal-dialog-centered'>
        <div className='modal-content'>
          <div className='modal-header'>
            <h3 className='modal-title'>{getModalTitle()}</h3>
            <button
              type='button'
              className='btn-close'
              onClick={onCancel}
              disabled={loading}
            ></button>
          </div>
          <div className='modal-body'>
            <div className='mb-4'>
              <p className='text-muted'>
                Changing status from <strong>{currentStatus}</strong> to <strong>{newStatus}</strong>
              </p>
            </div>
            
            <div className='mb-3'>
              <label className='form-label'>
                {getPromptText()}
                {requiresFeedback && <span className='text-danger ms-1'>*</span>}
              </label>
              <textarea
                className='form-control'
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={getPlaceholder()}
                disabled={loading}
              />
            </div>

            {newStatus === 'under_negotiation' && (
              <div className='alert alert-info d-flex align-items-start'>
                <i className='ki-duotone ki-information fs-2 me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                  <span className='path3'></span>
                </i>
                <div>
                  <strong>Tip:</strong> After marking as under negotiation, you can create a revised estimate with updated pricing.
                </div>
              </div>
            )}

            {newStatus === 'approved' && (
              <div className='alert alert-success d-flex align-items-start'>
                <i className='ki-duotone ki-check-circle fs-2 me-3'>
                  <span className='path1'></span>
                  <span className='path2'></span>
                </i>
                <div>
                  <strong>Next Step:</strong> After approval, you can convert this estimate to a job with payment schedule.
                </div>
              </div>
            )}
          </div>
          <div className='modal-footer'>
            <button
              type='button'
              className='btn btn-light'
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type='button'
              className='btn btn-primary'
              onClick={handleConfirm}
              disabled={loading || (requiresFeedback && !feedback.trim())}
            >
              {loading ? (
                <>
                  <span className='spinner-border spinner-border-sm align-middle me-2'></span>
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}