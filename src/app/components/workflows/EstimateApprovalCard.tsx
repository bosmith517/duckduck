import React, { useState } from 'react'
import { useCustomerJourneyStore, journeyEventBus, JOURNEY_EVENTS } from '../../stores/customerJourneyStore'
import { supabase } from '../../../supabaseClient'
import { useSupabaseAuth } from '../../modules/auth/core/SupabaseAuth'
import { featureFlags } from '../../../lib/config'

interface EstimateApprovalCardProps {
  estimateId: string
  leadId?: string
  estimate?: {
    id: string
    description: string
    total_amount: number
    status: 'draft' | 'sent' | 'approved' | 'declined'
    created_at: string
  }
  isCustomerView?: boolean
  onApprove?: (estimateId: string) => void
  onRequestChanges?: (estimateId: string, feedback: string) => void
}

export const EstimateApprovalCard: React.FC<EstimateApprovalCardProps> = ({
  estimateId,
  leadId,
  estimate,
  isCustomerView = false,
  onApprove,
  onRequestChanges
}) => {
  const { userProfile } = useSupabaseAuth()
  const { leadId: storeLeadId, approveEstimate } = useCustomerJourneyStore()
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const effectiveLeadId = leadId || storeLeadId

  const handleApprove = async () => {
    if (!userProfile?.tenant_id) {
      alert('Authentication error. Please refresh and try again.')
      return
    }

    setLoading(true)
    try {
      // Check if new approval flow is enabled
      if (featureFlags.estimateApprovalFlow) {
        // Call the new approve-estimate Edge Function
        const { data, error } = await supabase.functions.invoke('approve-estimate', {
          body: {
            estimateId,
            leadId: effectiveLeadId,
            userId: userProfile.id
          }
        })

        if (error) throw error

        // Update journey store with the new job
        if (data.job) {
          const { setJob } = useCustomerJourneyStore.getState()
          setJob(data.job)
        }

        // Emit success event
        journeyEventBus.emit(JOURNEY_EVENTS.ESTIMATE_APPROVED, {
          estimateId,
          leadId: effectiveLeadId,
          jobId: data.job?.id
        })

        // Call custom handler if provided
        if (onApprove) {
          onApprove(estimateId)
        }
      } else {
        // Legacy flow - just update estimate status
        const { error } = await supabase
          .from('estimates')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', estimateId)

        if (error) throw error

        // Call custom handler
        if (onApprove) {
          onApprove(estimateId)
        }
      }

    } catch (error) {
      console.error('Error approving estimate:', error)
      alert('Failed to approve estimate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestChanges = async () => {
    if (!feedback.trim()) {
      alert('Please provide feedback for the requested changes.')
      return
    }

    setLoading(true)
    try {
      // Update estimate status and add feedback
      const { error } = await supabase
        .from('estimates')
        .update({ 
          status: 'declined',
          feedback,
          updated_at: new Date().toISOString()
        })
        .eq('id', estimateId)

      if (error) throw error

      // Call custom handler
      if (onRequestChanges) {
        onRequestChanges(estimateId, feedback)
      }

      setShowFeedback(false)
      setFeedback('')

    } catch (error) {
      console.error('Error requesting changes:', error)
      alert('Failed to request changes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card bg-light-success border border-success">
      <div className="card-body p-6">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div className="d-flex align-items-center">
            <i className="ki-duotone ki-price-tag fs-2x text-success me-3">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            <div>
              <h5 className="mb-1">
                {isCustomerView ? 'Your Estimate is Ready!' : 'Estimate Awaiting Approval'}
              </h5>
              <p className="text-muted mb-0">
                {isCustomerView 
                  ? 'Please review and approve your estimate to proceed'
                  : 'Customer estimate is ready for approval'
                }
              </p>
            </div>
          </div>
          
          {estimate && (
            <div className="text-end">
              <div className="fw-bold text-success fs-3">
                ${estimate.total_amount.toLocaleString()}
              </div>
              <div className="text-muted fs-7">
                Total Amount
              </div>
            </div>
          )}
        </div>

        {estimate && (
          <div className="bg-white rounded p-4 mb-4">
            <h6 className="mb-3">Estimate Details:</h6>
            <p className="mb-2">{estimate.description}</p>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Created:</span>
              <span>{new Date(estimate.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        {showFeedback && (
          <div className="bg-white rounded p-4 mb-4">
            <h6 className="mb-3">Request Changes:</h6>
            <textarea
              className="form-control form-control-solid"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Please describe what changes you'd like to see..."
            />
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center">
          <div className="text-muted fs-7">
            {isCustomerView ? (
              <>
                <i className="ki-duotone ki-information fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                  <span className="path3"></span>
                </i>
                Approving will convert this to a job and begin scheduling
              </>
            ) : (
              <>
                <i className="ki-duotone ki-time fs-6 me-1">
                  <span className="path1"></span>
                  <span className="path2"></span>
                </i>
                Waiting for customer approval
              </>
            )}
          </div>
          
          <div className="d-flex gap-2">
            {!showFeedback ? (
              <>
                <button
                  className="btn btn-light-warning btn-sm"
                  onClick={() => setShowFeedback(true)}
                  disabled={loading}
                >
                  <i className="ki-duotone ki-pencil fs-5 me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Request Changes
                </button>
                
                <button
                  className="btn btn-success"
                  onClick={handleApprove}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Approving...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-check fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Approve Estimate
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-light"
                  onClick={() => {
                    setShowFeedback(false)
                    setFeedback('')
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                
                <button
                  className="btn btn-warning"
                  onClick={handleRequestChanges}
                  disabled={loading || !feedback.trim()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-send fs-5 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Send Feedback
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default EstimateApprovalCard