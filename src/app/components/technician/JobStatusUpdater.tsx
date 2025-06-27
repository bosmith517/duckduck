import React, { useState } from 'react'
import { trackingService } from '../../services/trackingService'
import { showToast } from '../../utils/toast'

interface JobStatusUpdaterProps {
  jobId: string
  currentStatus: string
  onStatusUpdate?: (newStatus: string) => void
}

const JobStatusUpdater: React.FC<JobStatusUpdaterProps> = ({
  jobId,
  currentStatus,
  onStatusUpdate
}) => {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [notes, setNotes] = useState('')
  const [showTrackingPrompt, setShowTrackingPrompt] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled', color: 'primary' },
    { value: 'on_the_way', label: 'On the Way', color: 'warning' },
    { value: 'arrived', label: 'Arrived at Site', color: 'info' },
    { value: 'in_progress', label: 'Work in Progress', color: 'primary' },
    { value: 'completed', label: 'Completed', color: 'success' },
    { value: 'cancelled', label: 'Cancelled', color: 'danger' },
    { value: 'delayed', label: 'Delayed', color: 'warning' }
  ]

  const handleStatusUpdate = async (newStatus: string) => {
    if (isUpdating) return

    try {
      setIsUpdating(true)

      // Update job status via tracking service
      const result = await trackingService.updateJobStatus(jobId, newStatus, notes)

      if (!result.success) {
        throw new Error(result.error || 'Failed to update status')
      }

      // If this status should trigger tracking, prompt user
      if (result.shouldStartTracking) {
        setPendingStatus(newStatus)
        setShowTrackingPrompt(true)
        return
      }

      // Status updated successfully
      showToast.success(`Job status updated to: ${newStatus.replace('_', ' ')}`)
      onStatusUpdate?.(newStatus)
      setNotes('')

    } catch (error: any) {
      console.error('Error updating status:', error)
      showToast.error(error.message || 'Failed to update job status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartTracking = async () => {
    if (!pendingStatus || isTracking) return

    try {
      setIsTracking(true)
      showToast.loading('Starting location tracking...')

      const result = await trackingService.startTracking(jobId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to start tracking')
      }

      showToast.dismiss()
      showToast.success('Location tracking started! Customer has been notified.')
      
      // Complete the status update
      onStatusUpdate?.(pendingStatus)
      setShowTrackingPrompt(false)
      setPendingStatus(null)
      setNotes('')

    } catch (error: any) {
      console.error('Error starting tracking:', error)
      showToast.dismiss()
      showToast.error(error.message || 'Failed to start tracking')
    } finally {
      setIsTracking(false)
    }
  }

  const handleDeclineTracking = () => {
    // Update status without tracking
    if (pendingStatus) {
      showToast.success(`Job status updated to: ${pendingStatus.replace('_', ' ')}`)
      onStatusUpdate?.(pendingStatus)
      setShowTrackingPrompt(false)
      setPendingStatus(null)
      setNotes('')
    }
  }

  const getCurrentStatusInfo = () => {
    const status = statusOptions.find(s => s.value === currentStatus)
    return status || { value: currentStatus, label: currentStatus, color: 'secondary' }
  }

  const currentStatusInfo = getCurrentStatusInfo()

  return (
    <>
      <div className="card shadow-sm">
        <div className="card-header">
          <h6 className="card-title mb-0">
            <i className="ki-duotone ki-notepad fs-3 text-primary me-2">
              <span className="path1"></span>
              <span className="path2"></span>
              <span className="path3"></span>
            </i>
            Update Job Status
          </h6>
        </div>
        <div className="card-body">
          {/* Current Status */}
          <div className="mb-4">
            <label className="form-label fw-bold">Current Status:</label>
            <div>
              <span className={`badge badge-light-${currentStatusInfo.color} fs-6 px-3 py-2`}>
                {currentStatusInfo.label}
              </span>
            </div>
          </div>

          {/* Status Options */}
          <div className="mb-4">
            <label className="form-label fw-bold">Update to:</label>
            <div className="row g-2">
              {statusOptions
                .filter(option => option.value !== currentStatus)
                .map((option) => (
                <div key={option.value} className="col-6">
                  <button
                    type="button"
                    className={`btn btn-light-${option.color} w-100 text-start`}
                    onClick={() => handleStatusUpdate(option.value)}
                    disabled={isUpdating}
                  >
                    <div className="d-flex align-items-center">
                      <i className={`ki-duotone ki-${
                        option.value === 'on_the_way' ? 'truck' :
                        option.value === 'arrived' ? 'geolocation' :
                        option.value === 'in_progress' ? 'wrench' :
                        option.value === 'completed' ? 'check' :
                        option.value === 'cancelled' ? 'cross' :
                        'time'
                      } fs-3 me-3 text-${option.color}`}>
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      <span className="fw-bold">{option.label}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="form-label fw-bold">Notes (optional):</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Add any notes about this status update..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isUpdating}
            />
          </div>

          {/* Tracking Status */}
          {trackingService.isCurrentlyTracking && (
            <div className="alert alert-success d-flex align-items-center">
              <i className="ki-duotone ki-geolocation fs-2x text-success me-3">
                <span className="path1"></span>
                <span className="path2"></span>
              </i>
              <div>
                <h6 className="mb-1">Location Tracking Active</h6>
                <p className="mb-0 fs-7">Customer can see your real-time location</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tracking Prompt Modal */}
      {showTrackingPrompt && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="ki-duotone ki-geolocation fs-2 text-primary me-2">
                    <span className="path1"></span>
                    <span className="path2"></span>
                  </i>
                  Start Location Tracking?
                </h5>
              </div>
              <div className="modal-body">
                <div className="text-center mb-4">
                  <i className="ki-duotone ki-truck fs-5x text-warning mb-3">
                    <span className="path1"></span>
                    <span className="path2"></span>
                    <span className="path3"></span>
                    <span className="path4"></span>
                    <span className="path5"></span>
                  </i>
                </div>
                <p className="fs-6 text-center mb-4">
                  Since you're marking this job as "<strong>{pendingStatus?.replace('_', ' ')}</strong>", 
                  would you like to start location tracking so the customer can see your arrival progress?
                </p>
                <div className="alert alert-light-info">
                  <h6 className="mb-2">
                    <i className="ki-duotone ki-information fs-3 text-info me-2">
                      <span className="path1"></span>
                      <span className="path2"></span>
                      <span className="path3"></span>
                    </i>
                    What happens next:
                  </h6>
                  <ul className="mb-0 fs-7">
                    <li>Your location will be shared with the customer via SMS</li>
                    <li>They'll receive a link to track your progress on a map</li>
                    <li>Tracking stops automatically when you complete the job</li>
                    <li>You can stop tracking manually at any time</li>
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light-secondary"
                  onClick={handleDeclineTracking}
                  disabled={isTracking}
                >
                  No, Just Update Status
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartTracking}
                  disabled={isTracking}
                >
                  {isTracking ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Starting Tracking...
                    </>
                  ) : (
                    <>
                      <i className="ki-duotone ki-geolocation fs-4 me-2">
                        <span className="path1"></span>
                        <span className="path2"></span>
                      </i>
                      Yes, Start Tracking
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default JobStatusUpdater